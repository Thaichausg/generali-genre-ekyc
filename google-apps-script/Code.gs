/**
 * ============================================================================
 * GOOGLE APPS SCRIPT KẾT NỐI WEB FORM MOBILE VỚI GOOGLE SHEETS GENRE (GENERALI)
 * File Google Sheets ID: 1MRgOcAVzDqfZy4VbH2Xt_noqCaGX6HWBoFZY5ydnAWY
 * Tên Sheet: Danh_Sach_Tong_Hop
 *
 * Chức năng:
 * 1. Nhận toàn bộ 32 trường thông tin từ Web Form Mobile (Cột B -> Cột AG)
 * 2. Tự động tìm dòng trống tiếp theo từ Dòng 4 trở đi (bảo toàn công thức cột A - STT)
 * 3. Tự động lưu 2 ảnh chụp Scan CCCD (Mặt trước & Mặt sau) vào Google Drive
 * 4. Ghi trạng thái "Đã tải lên" vào cột AF & AG (đúng chuẩn Data Validation của Sheet)
 *    đồng thời gắn đường link (Hyperlink + Ghi chú Note) để Quản lý bấm vào xem ảnh CCCD ngay!
 * ============================================================================
 */

const SPREADSHEET_ID = '1MRgOcAVzDqfZy4VbH2Xt_noqCaGX6HWBoFZY5ydnAWY';
const TARGET_SHEET_NAME = 'Danh_Sach_Tong_Hop';
const DRIVE_FOLDER_NAME = 'GENRE_2026_ANH_CCCD_KHACH_HANG';

/**
 * Hỗ trợ mở trực tiếp thông báo trạng thái khi truy cập link Web App bằng trình duyệt
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ACTIVE',
      message: 'API Kết nối Web Form Đăng ký Hồ sơ GENRE (Generali) đang hoạt động!',
      spreadsheetId: SPREADSHEET_ID,
      sheetName: TARGET_SHEET_NAME
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Nhận dữ liệu POST từ Web Form Mobile khi khách hàng bấm "GỬI HỒ SƠ ĐĂNG KÝ"
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Không nhận được dữ liệu gửi lên (Empty Payload)');
    }

    const payload = JSON.parse(e.postData.contents);
    const result = processFormSubmission(payload);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        rowNumber: result.rowNumber,
        frontImageUrl: result.frontImageUrl,
        backImageUrl: result.backImageUrl
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Xử lý ghi dữ liệu vào đúng các cột B -> AG và lưu 2 mặt ảnh CCCD vào Google Drive
 */
function processFormSubmission(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(TARGET_SHEET_NAME) || ss.getSheets()[0];
    const f = payload.fields || {};
    const imgs = payload.images || {};

    // 1. Lưu 2 ảnh CCCD Mặt trước & Mặt sau vào thư mục Google Drive
    const fullNameClean = [f.ho, f.tenDem, f.ten].filter(Boolean).join('_').replace(/\s+/g, '_');
    const cccdCode = f.soGiayTo || 'CCCD';
    let frontImageUrl = '';
    let backImageUrl = '';

    if (imgs.cccdFrontBase64) {
      frontImageUrl = saveBase64ImageToDrive(
        imgs.cccdFrontBase64,
        `${cccdCode}_${fullNameClean}_MAT_TRUOC.jpg`
      );
    }

    if (imgs.cccdBackBase64) {
      backImageUrl = saveBase64ImageToDrive(
        imgs.cccdBackBase64,
        `${cccdCode}_${fullNameClean}_MAT_SAU.jpg`
      );
    }

    // 2. Tìm dòng trống đầu tiên tính từ Dòng 4 trở đi dựa vào Cột C (Họ*) và Cột L (CMND/CCCD*)
    const maxRows = Math.max(sheet.getLastRow(), 33);
    const colCValues = sheet.getRange(4, 3, maxRows - 3 + 1, 1).getValues();
    let targetRow = 4;
    let foundEmpty = false;

    for (let i = 0; i < colCValues.length; i++) {
      if (!String(colCValues[i][0] || '').trim()) {
        targetRow = 4 + i;
        foundEmpty = true;
        break;
      }
    }
    if (!foundEmpty) {
      targetRow = maxRows + 1;
    }

    // 3. Đảm bảo Cột A (STT) có công thức tự đánh số thứ tự
    const sttCell = sheet.getRange(targetRow, 1);
    if (!sttCell.getFormula()) {
      sttCell.setFormula(`=IF(COUNTA(C${targetRow}:E${targetRow})>0, ROW()-3, "")`);
    }

    // 4. Chuẩn bị mảng 32 cột từ Cột B (Cột số 2) đến Cột AG (Cột số 33)
    const rowValues = [
      f.danhXung || '',                         // B (2): Danh xưng*
      f.ho || '',                               // C (3): Họ*
      f.tenDem || '',                           // D (4): Tên đệm
      f.ten || '',                              // E (5): Tên*
      f.ngaySinh || '',                         // F (6): Ngày sinh*
      f.gioiTinh || '',                         // G (7): Giới tính*
      f.noiSinh || '',                          // H (8): Nơi sinh*
      f.tinhTrangHonNhan || '',                 // I (9): Tình trạng hôn nhân*
      f.quocTich || 'Việt Nam',                 // J (10): Quốc tịch*
      f.loaiGiayTo || 'Căn cước Công dân',      // K (11): Loại giấy tờ*
      f.soGiayTo ? `'${f.soGiayTo}` : '',       // L (12): CMND/CCCD* (Thêm dấu ' để giữ số 0 ở đầu)
      f.noiCap || '',                           // M (13): Nơi cấp CMND/CCCD*
      f.ngayCap || '',                          // N (14): Ngày cấp CMND/CCCD*
      f.loaiGiayToCu || '',                     // O (15): Loại giấy tờ (cũ)
      f.soGiayToCu ? `'${f.soGiayToCu}` : '',   // P (16): CMND/CCCD Cũ
      f.noiCapCu || '',                         // Q (17): Nơi cấp CMND/CCCD Cũ
      f.ngayCapCu || '',                        // R (18): Ngày cấp CMND/CCCD Cũ
      f.thanhPhoTinh || '',                     // S (19): Thành phố/ Tỉnh*
      f.phuongXa || '',                         // T (20): Phường/ Xã*
      f.soNhaTenDuong || '',                    // U (21): Số nhà, tên đường*
      f.email || '',                            // V (22): Email/ thư điện tử*
      f.dienThoai ? `'${f.dienThoai}` : '',     // W (23): Điện thoại di động* (Giữ số 0 ở đầu)
      f.dongYNhanThongTin || 'Đồng ý',          // X (24): Đồng ý nhận thông tin từ Generali Việt Nam*
      f.soTaiKhoan ? `'${f.soTaiKhoan}` : '',   // Y (25): Số tài khoản*
      f.tenTaiKhoan || '',                      // Z (26): Tên tài khoản*
      f.maSoNganHang || '',                     // AA (27): Mã số ngân hàng*
      f.tenNganHang || '',                      // AB (28): Tên ngân hàng
      f.maSoChiNhanh || '',                     // AC (29): Mã số chi nhánh/ PGD*
      f.tenChiNhanh || '',                      // AD (30): Tên Chi nhánh/ PGD
      f.diaChiChiNhanh || '',                   // AE (31): Địa chỉ Chi nhánh
      frontImageUrl ? 'Đã tải lên' : (f.cccdMatTruocStatus || 'Chưa đính kèm'), // AF (32): CMND/CCCD* - Mặt trước
      backImageUrl ? 'Đã tải lên' : (f.cccdMatSauStatus || 'Chưa đính kèm')     // AG (33): CMND/CCCD* - Mặt sau
    ];

    // Ghi dữ liệu vào Cột B -> AG của dòng targetRow
    sheet.getRange(targetRow, 2, 1, rowValues.length).setValues([rowValues]);

    // 5. Gắn Link bấm trực tiếp vào chữ "Đã tải lên" ở cột AF (32) và AG (33) để vừa khớp Data Validation vừa xem được hình
    if (frontImageUrl) {
      const cellAF = sheet.getRange(targetRow, 32);
      const richAF = SpreadsheetApp.newRichTextValue()
        .setText('Đã tải lên')
        .setLinkUrl(frontImageUrl)
        .build();
      cellAF.setRichTextValue(richAF);
      cellAF.setNote('Link ảnh CCCD Mặt trước:\n' + frontImageUrl);
    }

    if (backImageUrl) {
      const cellAG = sheet.getRange(targetRow, 33);
      const richAG = SpreadsheetApp.newRichTextValue()
        .setText('Đã tải lên')
        .setLinkUrl(backImageUrl)
        .build();
      cellAG.setRichTextValue(richAG);
      cellAG.setNote('Link ảnh CCCD Mặt sau:\n' + backImageUrl);
    }

    return {
      rowNumber: targetRow,
      frontImageUrl: frontImageUrl,
      backImageUrl: backImageUrl
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Giải mã Base64 và lưu thành file ảnh JPG trong thư mục Google Drive
 */
function saveBase64ImageToDrive(base64DataUrl, fileName) {
  try {
    const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);

    const parts = base64DataUrl.split(',');
    const base64String = parts.length > 1 ? parts[1] : parts[0];
    const mimeMatch = parts[0].match(/:(.*?);/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const decodedBytes = Utilities.base64Decode(base64String);
    const blob = Utilities.newBlob(decodedBytes, contentType, fileName);
    const file = folder.createFile(blob);

    // Cho phép người có link xem được ảnh CCCD từ Google Sheet
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    Logger.log('Lỗi lưu ảnh CCCD lên Drive: ' + err);
    return '';
  }
}
