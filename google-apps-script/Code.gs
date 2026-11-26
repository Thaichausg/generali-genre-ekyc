/**
 * ============================================================================
 * GOOGLE APPS SCRIPT KẾT NỐI WEB FORM MOBILE VỚI GOOGLE SHEETS GENRE (GENERALI)
 * File Google Sheets ID: 1MRgOcAVzDqfZy4VbH2Xt_noqCaGX6HWBoFZY5ydnAWY
 * Tên Sheet: Danh_Sach_Tong_Hop
 * Email nhận thông báo hồ sơ mới: huynhthaichau.generali@gmail.com
 *
 * Chức năng:
 * 1. Nhận toàn bộ 32 trường thông tin từ Web Form Mobile (Cột B -> Cột AG)
 * 2. Tự động tìm dòng trống tiếp theo từ Dòng 4 trở đi (bảo toàn công thức cột A - STT)
 * 3. Tự động lưu 2 ảnh chụp Scan CCCD (Mặt trước & Mặt sau) vào Google Drive
 * 4. Ghi trạng thái "Đã tải lên" vào cột AF & AG kèm đường link xem ảnh trực tiếp
 * 5. Tự động gửi Email thông báo hồ sơ CTV GenRe mới về huynhthaichau.generali@gmail.com
 * ============================================================================
 */

const SPREADSHEET_ID = '1MRgOcAVzDqfZy4VbH2Xt_noqCaGX6HWBoFZY5ydnAWY';
const TARGET_SHEET_NAME = 'Danh_Sach_Tong_Hop';
const DRIVE_FOLDER_NAME = 'GENRE_2026_ANH_CCCD_KHACH_HANG';
const ADMIN_NOTIFY_EMAIL = 'huynhthaichau.generali@gmail.com';

/**
 * Hỗ trợ kiểm tra trạng thái hoạt động của Web App
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ACTIVE',
      message: 'API Kết nối Đăng Ký Thông Tin Cộng Tác Viên GenRe đang hoạt động!',
      spreadsheetId: SPREADSHEET_ID,
      sheetName: TARGET_SHEET_NAME,
      notifyEmail: ADMIN_NOTIFY_EMAIL
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Nhận dữ liệu POST từ Web Form khi Cộng tác viên GenRe bấm "Gửi Hồ Sơ Đăng Ký"
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
        backImageUrl: result.backImageUrl,
        emailSent: result.emailSent
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
 * Xử lý ghi dữ liệu vào cột B -> AG, lưu 2 mặt ảnh CCCD và gửi Gmail thông báo
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

    // 2. Tìm dòng trống đầu tiên tính từ Dòng 4 trở đi dựa vào Cột C (Họ*)
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

    // 4. Chuẩn bị mảng 32 cột từ Cột B (2) đến Cột AG (33)
    const rowValues = [
      f.danhXung || '',
      f.ho || '',
      f.tenDem || '',
      f.ten || '',
      f.ngaySinh || '',
      f.gioiTinh || '',
      f.noiSinh || '',
      f.tinhTrangHonNhan || '',
      f.quocTich || 'Việt Nam',
      f.loaiGiayTo || 'Căn cước Công dân',
      f.soGiayTo ? `'${f.soGiayTo}` : '',
      f.noiCap || '',
      f.ngayCap || '',
      f.loaiGiayToCu || '',
      f.soGiayToCu ? `'${f.soGiayToCu}` : '',
      f.noiCapCu || '',
      f.ngayCapCu || '',
      f.thanhPhoTinh || '',
      f.phuongXa || '',
      f.soNhaTenDuong || '',
      f.email || '',
      f.dienThoai ? `'${f.dienThoai}` : '',
      f.dongYNhanThongTin || 'Đồng ý',
      f.soTaiKhoan ? `'${f.soTaiKhoan}` : '',
      f.tenTaiKhoan || '',
      f.maSoNganHang || '',
      f.tenNganHang || '',
      f.maSoChiNhanh || '',
      f.tenChiNhanh || '',
      f.diaChiChiNhanh || '',
      frontImageUrl ? 'Đã tải lên' : (f.cccdMatTruocStatus || 'Chưa đính kèm'),
      backImageUrl ? 'Đã tải lên' : (f.cccdMatSauStatus || 'Chưa đính kèm')
    ];

    sheet.getRange(targetRow, 2, 1, rowValues.length).setValues([rowValues]);

    // 5. Gắn Link bấm trực tiếp vào chữ "Đã tải lên" ở cột AF (32) và AG (33)
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

    // 6. Gửi Email thông báo về huynhthaichau.generali@gmail.com
    const emailSent = sendNewApplicantNotificationEmail(
      f,
      targetRow,
      frontImageUrl,
      backImageUrl,
      payload.notifyEmail || ADMIN_NOTIFY_EMAIL
    );

    return {
      rowNumber: targetRow,
      frontImageUrl: frontImageUrl,
      backImageUrl: backImageUrl,
      emailSent: emailSent
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Gửi Gmail thông báo tóm tắt thông tin Cộng tác viên / Ứng viên GenRe vừa đăng ký
 */
function sendNewApplicantNotificationEmail(f, rowNumber, frontImageUrl, backImageUrl, recipientEmail) {
  try {
    const toEmail = recipientEmail || ADMIN_NOTIFY_EMAIL;
    const fullName = [f.ho, f.tenDem, f.ten].filter(Boolean).join(' ').trim() || 'Chưa rõ tên';
    const stt = Math.max(1, rowNumber - 3);
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
    const submittedTime = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'HH:mm - dd/MM/yyyy');
    const addressStr = [f.soNhaTenDuong, f.phuongXa, f.thanhPhoTinh].filter(Boolean).join(', ');
    const bankStr = [f.soTaiKhoan, f.tenTaiKhoan, f.tenNganHang || f.maSoNganHang].filter(Boolean).join(' — ');

    const subject = `[GenRe Mới #${stt}] Đăng ký CTV GenRe: ${fullName} - SĐT: ${f.dienThoai || ''}`;

    const plainBody = [
      `THÔNG BÁO HỒ SƠ ĐĂNG KÝ CỘNG TÁC VIÊN GENRE MỚI`,
      `Thời gian đăng ký: ${submittedTime}`,
      `--------------------------------------------------`,
      `• Họ và tên CTV / Ứng viên: ${f.danhXung ? f.danhXung + ' ' : ''}${fullName}`,
      `• Ngày sinh / Giới tính: ${f.ngaySinh || ''} (${f.gioiTinh || ''})`,
      `• Số CCCD: ${f.soGiayTo || ''} (Cấp ngày: ${f.ngayCap || ''})`,
      `• Điện thoại: ${f.dienThoai || ''}`,
      `• Email: ${f.email || ''}`,
      `• Địa chỉ liên lạc: ${addressStr}`,
      `• Tài khoản ngân hàng: ${bankStr}`,
      `• Dòng lưu trên Google Sheet: Dòng ${rowNumber} (STT #${stt})`,
      ``,
      `• Mở bảng Google Sheet: ${sheetUrl}`,
      frontImageUrl ? `• Ảnh CCCD Mặt trước: ${frontImageUrl}` : '',
      backImageUrl ? `• Ảnh CCCD Mặt sau: ${backImageUrl}` : ''
    ].filter(Boolean).join('\n');

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; color: #111827; border: 1px solid #E5E7EB; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #C21B17; color: #FFFFFF; padding: 16px 20px;">
          <div style="font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; opacity: 0.9;">GENERALI VIỆT NAM • HỒ SƠ GENRE</div>
          <h2 style="margin: 4px 0 0 0; font-size: 17px;">Có Cộng Tác Viên / Ứng Viên GenRe Mới Đăng Ký</h2>
        </div>

        <div style="padding: 20px;">
          <p style="margin: 0 0 14px 0; font-size: 14px; color: #374151;">
            Hệ thống vừa ghi nhận hồ sơ đăng ký mới lúc <strong>${submittedTime}</strong> (STT <strong>#${stt}</strong> — Dòng <strong>${rowNumber}</strong>):
          </p>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6; color: #6B7280; width: 38%;">CTV / Ứng viên:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6; font-weight: bold; color: #111827;">${f.danhXung ? f.danhXung + ' ' : ''}${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6; color: #6B7280;">Ngày sinh / Giới tính:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6;">${f.ngaySinh || '---'} (${f.gioiTinh || '---'})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6; color: #6B7280;">Số CCCD:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6; font-weight: bold;">${f.soGiayTo || '---'} <span style="font-weight: normal; color: #6B7280;">(Cấp: ${f.ngayCap || '---'})</span></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6; color: #6B7280;">Điện thoại:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6; font-weight: bold; color: #C21B17;">${f.dienThoai || '---'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6; color: #6B7280;">Email:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6;">${f.email || '---'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6; color: #6B7280;">Địa chỉ liên lạc:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6;">${addressStr || '---'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6; color: #6B7280;">Tài khoản NH:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6;">${bankStr || '---'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Ảnh CCCD đính kèm:</td>
              <td style="padding: 8px 0;">
                ${frontImageUrl ? `<a href="${frontImageUrl}" target="_blank" style="color: #C21B17; font-weight: bold; text-decoration: none; margin-right: 12px;">[Xem Mặt Trước]</a>` : 'Chưa có'}
                ${backImageUrl ? `<a href="${backImageUrl}" target="_blank" style="color: #C21B17; font-weight: bold; text-decoration: none;">[Xem Mặt Sau]</a>` : ''}
              </td>
            </tr>
          </table>

          <div style="margin-top: 18px;">
            <a href="${sheetUrl}" target="_blank" style="display: inline-block; background-color: #C21B17; color: #FFFFFF; font-weight: bold; font-size: 13px; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
              Mở Bảng Tổng Hợp Google Sheets
            </a>
          </div>
        </div>
      </div>
    `;

    MailApp.sendEmail({
      to: toEmail,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: 'Hệ Thống Đăng Ký GenRe - Generali'
    });

    return true;
  } catch (err) {
    Logger.log('Lỗi gửi email thông báo: ' + err);
    return false;
  }
}

/**
 * Chạy hàm này 1 lần trong Apps Script để cấp quyền gửi Email (MailApp) & gửi thử 1 email kiểm tra
 */
function testSendNotificationEmail() {
  sendNewApplicantNotificationEmail(
    {
      danhXung: 'Anh',
      ho: 'NGUYỄN',
      tenDem: 'VĂN',
      ten: 'AN',
      ngaySinh: '15/08/1995',
      gioiTinh: 'Nam',
      soGiayTo: '079095001234',
      ngayCap: '10/05/2022',
      dienThoai: '0901234567',
      email: 'nguyenvanan@gmail.com',
      soNhaTenDuong: '43-45 Tú Xương',
      phuongXa: 'Phường Xuân Hòa',
      thanhPhoTinh: 'Thành phố Hồ Chí Minh',
      soTaiKhoan: '0071001234567',
      tenTaiKhoan: 'NGUYEN VAN AN',
      tenNganHang: 'Vietcombank'
    },
    4,
    '',
    '',
    ADMIN_NOTIFY_EMAIL
  );
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

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    Logger.log('Lỗi lưu ảnh CCCD lên Drive: ' + err);
    return '';
  }
}
