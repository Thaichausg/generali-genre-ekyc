# Hướng Dẫn Cài Đặt & Kết Nối Web Form Mobile Với File Google Sheets GENRE

Bộ mã nguồn **Web Form Mobile Đăng Ký Hồ Sơ GENRE (Generali Việt Nam)** đã được thiết kế khớp 100% với 33 cột của file Google Sheets:
🔗 **Link Google Sheets của anh/chị:** [DANH SÁCH TỔNG HỢP ĐĂNG KÝ HỒ SƠ GENRE](https://docs.google.com/spreadsheets/d/1MRgOcAVzDqfZy4VbH2Xt_noqCaGX6HWBoFZY5ydnAWY/edit?usp=sharing)

---

## 1. Các Tính Năng Đã Tích Hợp Sẵn Trong Web Form

1. **Chụp Scan 2 mặt CCCD trực tiếp hoặc Tải hình lên:**
   - **Chụp Scan Trực Tiếp (Live Camera):** Mở camera sau của điện thoại với khung căn chỉnh chuẩn tỷ lệ thẻ CCCD (`85.6 × 53.98 mm`) kèm tia laser quét, tự động cắt gọn khung thẻ, hỗ trợ xoay ảnh 90° và bật chế độ **"Bản Scan Rõ Nét"** (tăng tương phản chữ).
   - **Tải Hình Từ Máy:** Cho phép chọn ảnh có sẵn từ thư viện điện thoại hoặc máy tính, tự động nén ảnh nhẹ và rõ nét.
   - **Quét Mã QR CCCD Tự Điền Form:** Khi khách soi camera vào mặt trước CCCD gắn chip (hoặc tải ảnh mặt trước rõ mã QR), form tự động điền luôn *Họ, Tên đệm, Tên, Số CCCD, Số CMND cũ, Ngày sinh, Giới tính, Ngày cấp, Địa chỉ*.
2. **Chuẩn 33 cột của Sheet `Danh_Sach_Tong_Hop`:**
   - Bảo toàn công thức tự tính `STT` ở cột `A`.
   - Khớp toàn bộ quy tắc **Data Validation** trên Sheet (`Danh xưng`, `Giới tính`, `Tình trạng hôn nhân`, `Loại giấy tờ`, `Đồng ý / Chưa đồng ý`, `Đã tải lên / Chưa đính kèm`).
   - Tự động lưu 2 ảnh CCCD (Mặt trước & Mặt sau) vào thư mục Google Drive `GENRE_2026_ANH_CCCD_KHACH_HANG` và gắn link bấm xem trực tiếp vào chữ **`Đã tải lên`** tại cột `AF` và `AG`.

---

## 2. Cách Kết Nối Tự Động Đổ Dữ Liệu Về Google Sheets (Chỉ mất 2 phút)

### Bước 1: Dán mã Google Apps Script vào file Google Sheets
1. Mở file Google Sheets của anh/chị: [Mở Google Sheet tại đây](https://docs.google.com/spreadsheets/d/1MRgOcAVzDqfZy4VbH2Xt_noqCaGX6HWBoFZY5ydnAWY/edit?usp=sharing).
2. Trên thanh menu trên cùng, chọn **Tiện ích mở rộng (Extensions)** $\rightarrow$ **Apps Script**.
3. Xóa đoạn mã mặc định `function myFunction() {}` đang có, sau đó mở file [google-apps-script/Code.gs](file:///C:/Users/huynh/OneDrive/Desktop/GENERALI%202026/GENRE/google-apps-script/Code.gs) trong thư mục `GENRE`, copy toàn bộ nội dung và dán vào cửa sổ Apps Script.
4. Bấm biểu tượng **Lưu (Save / Ctrl+S)**.

### Bước 2: Phát hành (Deploy) thành Web App URL
1. Ở góc phải trên cùng của trang Apps Script, bấm nút **Triển khai (Deploy)** $\rightarrow$ **Tùy chọn triển khai mới (New deployment)**.
2. Bấm vào biểu tượng bánh răng ⚙️ cạnh mục *Chọn loại (Select type)* $\rightarrow$ chọn **Ứng dụng web (Web app)**.
3. Thiết lập 2 mục sau:
   - **Thực thi dưới dạng (Execute as):** Chọn **`Tôi (Me)`**.
   - **Ai có quyền truy cập (Who has access):** Chọn **`Bất kỳ ai (Anyone)`**.
4. Bấm **Triển khai (Deploy)** $\rightarrow$ Bấm **Cấp quyền truy cập (Authorize access)** (chọn tài khoản Google của anh/chị $\rightarrow$ bấm *Nâng cao (Advanced)* $\rightarrow$ *Đi tới Dự án (Go to project)* $\rightarrow$ *Cho phép (Allow)*).
5. Copy đường link **URL ứng dụng web (Web app URL)** có dạng:
   `https://script.google.com/macros/s/AKfycb.../exec`

### Bước 3: Gắn URL vào Web Form
- **Cách 1 (Ngay trên giao diện Web Form):** Mở file [index.html](file:///C:/Users/huynh/OneDrive/Desktop/GENERALI%202026/GENRE/index.html), bấm vào nút **Cài đặt** ở góc phải trên cùng $\rightarrow$ dán đường link Web App URL vào ô số 2 $\rightarrow$ bấm **Lưu cấu hình**.
- **Cách 2 (Cố định cho mọi khách hàng):** Mở file [js/app.js](file:///C:/Users/huynh/OneDrive/Desktop/GENERALI%202026/GENRE/js/app.js), dán đường link Web App URL vào dòng số 15:
  ```javascript
  DEFAULT_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycb.../exec'
  ```
bf
---

## 3. Cách Đưa Web Form Lên Mạng Cho Khách Hàng Điền Trên Điện Thoại

Để khách hàng quét mã QR hoặc bấm link trên Zalo/Điện thoại mở form(Lưu ý: Tính năng mở Camera trực tiếp trên điện thoại yêu cầu trang web chạy qua giao thức bảo mật `https://` hoặc `localhost`):
- **Cách nhanh nhất (Kéo thả miễn phí 30 giây với Netlify Drop):**
  1. Truy cập `https://app.netlify.com/drop` (hoặc GitHub Pages / Vercel).
  2. Kéo toàn bộ thư mục **`GENRE`** thả vào trang web.
  3. Anh/chị sẽ có ngay 1 đường link `https://...netlify.app` để gửi qua Zalo hoặc in mã QR cho khách hàng quét điền hồ sơ trên điện thoại!
