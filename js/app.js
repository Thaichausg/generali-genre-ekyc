/**
 * Điều khiển Native Mobile App UI cho Hồ Sơ GENRE (Generali Việt Nam)
 * - Segmented Pill Controls chạm 1 ngón cho Danh xưng, Giới tính, Hôn nhân, Loại giấy tờ
 * - Bank Quick Chips chạm 1 ngón chọn nhanh Ngân hàng
 * - Đồng bộ 2 chiều với bộ eKYC Scanner (Trích xuất QR/OCR & Đính kèm 2 mặt CCCD)
 */

const GENRE_CONFIG = {
    SPREADSHEET_ID: '1MRgOcAVzDqfZy4VbH2Xt_noqCaGX6HWBoFZY5ydnAWY',
    SHEET_NAME: 'Danh_Sach_Tong_Hop',
    LIVE_APP_URL: 'https://generali-genre-ekyc.vercel.app/',
    DEFAULT_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwshMtmAeufWH2gJ53AhmvuhkipbHwxzWsAITU7fnrtNzQj9B0VyhkNWi6YIfnK4i3Fgw/exec'
};

document.addEventListener('DOMContentLoaded', () => {
    initDropdownData();
    bindFormEvents();
    loadSavedConfig();
    restoreDraftData();
    syncAllSegmentedTracksFromInputs();
});

/**
 * Chọn giá trị trên thanh Segmented Pill Control chuẩn iOS
 */
function selectSegmented(fieldId, value, skipCascade = false) {
    const input = document.getElementById(fieldId);
    if (input) {
        input.value = value;
        clearFieldError(input);
    }

    const track = document.querySelector(`.segmented-track[data-target="${fieldId}"]`);
    if (track) {
        track.querySelectorAll('.seg-pill').forEach(btn => {
            if (btn.dataset.val === value) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Tự động đồng bộ Danh xưng <-> Giới tính
    if (!skipCascade && fieldId === 'danhXung') {
        if (value === 'Anh' || value === 'Ông') {
            selectSegmented('gioiTinh', 'Nam', true);
        } else if (value === 'Chị' || value === 'Bà') {
            selectSegmented('gioiTinh', 'Nữ', true);
        }
    } else if (!skipCascade && fieldId === 'gioiTinh') {
        const currentTitle = document.getElementById('danhXung')?.value;
        if (value === 'Nam' && (currentTitle === 'Chị' || currentTitle === 'Bà')) {
            selectSegmented('danhXung', 'Anh', true);
        } else if (value === 'Nữ' && (currentTitle === 'Anh' || currentTitle === 'Ông')) {
            selectSegmented('danhXung', 'Chị', true);
        }
    }

    saveDraftData();
}

function syncAllSegmentedTracksFromInputs() {
    ['danhXung', 'gioiTinh', 'tinhTrangHonNhan', 'loaiGiayTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value) {
            selectSegmented(id, el.value, true);
        }
    });
}

/**
 * Chọn nhanh Ngân hàng từ thanh Bank Chips
 */
function quickSelectBank(bankCode, chipBtn) {
    document.querySelectorAll('#popularBankChips .bank-chip').forEach(b => b.classList.remove('active'));
    if (chipBtn) chipBtn.classList.add('active');

    const picker = document.getElementById('bankQuickPicker');
    if (picker) picker.value = bankCode;

    applyBankSelection(bankCode);
}

function applyBankSelection(selectedCode) {
    const bank = GENRE_DATA.banks.find(b => b.code === selectedCode);
    const maNH = document.getElementById('maSoNganHang');
    const tenNH = document.getElementById('tenNganHang');
    if (bank) {
        if (maNH) {
            maNH.value = bank.code;
            clearFieldError(maNH);
        }
        if (tenNH) {
            tenNH.value = bank.fullName;
        }
        saveDraftData();
    }
}

function initDropdownData() {
    const noiSinhSelect = document.getElementById('noiSinh');
    const tinhSelect = document.getElementById('thanhPhoTinh');

    GENRE_DATA.provinces.forEach(prov => {
        if (noiSinhSelect) {
            const opt1 = document.createElement('option');
            opt1.value = prov;
            opt1.textContent = prov;
            noiSinhSelect.appendChild(opt1);
        }
        if (tinhSelect) {
            const opt2 = document.createElement('option');
            opt2.value = prov;
            opt2.textContent = prov;
            tinhSelect.appendChild(opt2);
        }
    });

    const issueList = document.getElementById('issuePlacesList');
    if (issueList) {
        GENRE_DATA.issuePlaces.forEach(place => {
            const opt = document.createElement('option');
            opt.value = place;
            issueList.appendChild(opt);
        });
    }

    const bankPicker = document.getElementById('bankQuickPicker');
    if (bankPicker) {
        GENRE_DATA.banks.forEach(bank => {
            const opt = document.createElement('option');
            opt.value = bank.code;
            opt.textContent = `${bank.shortName} - ${bank.fullName}`;
            bankPicker.appendChild(opt);
        });
    }
}

function bindFormEvents() {
    // Khi scanner tự động gán giá trị cho các hidden input (danhXung, gioiTinh, tinhTrangHonNhan, loaiGiayTo)
    ['danhXung', 'gioiTinh', 'tinhTrangHonNhan', 'loaiGiayTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                selectSegmented(id, el.value, true);
            });
        }
    });

    // Tự động viết hoa Họ, Tên đệm, Tên & Điền Tên chủ tài khoản không dấu
    ['ho', 'tenDem', 'ten'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                syncAccountHolderName();
                saveDraftData();
            });
            el.addEventListener('blur', () => {
                el.value = el.value.trim().toUpperCase();
                syncAccountHolderName();
            });
        }
    });

    // Switch iOS ẩn/hiện CMND/CCCD cũ
    const toggleOldId = document.getElementById('toggleOldId');
    const oldIdSection = document.getElementById('oldIdSection');
    if (toggleOldId && oldIdSection) {
        toggleOldId.addEventListener('change', () => {
            if (toggleOldId.checked) {
                oldIdSection.classList.remove('hidden');
            } else {
                oldIdSection.classList.add('hidden');
                ['loaiGiayToCu', 'soGiayToCu', 'noiCapCu', 'ngayCapCu'].forEach(id => {
                    const input = document.getElementById(id);
                    if (input) input.value = '';
                });
            }
        });
    }

    // Dropdown chọn tất cả ngân hàng
    const bankPicker = document.getElementById('bankQuickPicker');
    if (bankPicker) {
        bankPicker.addEventListener('change', () => {
            const code = bankPicker.value;
            document.querySelectorAll('#popularBankChips .bank-chip').forEach(b => {
                b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${code}'`));
            });
            applyBankSelection(code);
        });
    }

    // Nút Up Hình CCCD (1 hoặc 2 mặt)
    const batchUploadInput = document.getElementById('batchUploadInput');
    if (batchUploadInput) {
        batchUploadInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const targetSide = !window.cccdScanner.images.front ? 'front' : 'back';
                window.cccdScanner.handleBatchFilesUpload(e.target.files, targetSide);
            }
            batchUploadInput.value = '';
        });
    }

    const bindSingleFileInput = (inputId, side) => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    window.cccdScanner.handleBatchFilesUpload([e.target.files[0]], side);
                }
                input.value = '';
            });
        }
    };

    bindSingleFileInput('fileInputFront', 'front');
    bindSingleFileInput('fileInputBack', 'back');
    bindSingleFileInput('cameraInputFront', 'front');
    bindSingleFileInput('cameraInputBack', 'back');

    // Xóa lỗi khi nhập
    document.querySelectorAll('.form-input, .form-select').forEach(el => {
        el.addEventListener('input', () => {
            clearFieldError(el);
            saveDraftData();
        });
        el.addEventListener('change', () => {
            clearFieldError(el);
            saveDraftData();
        });
    });

    // Active tab pill khi bấm chuyển vùng
    document.querySelectorAll('.section-nav-scroll .nav-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.section-nav-scroll .nav-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });
}

function removeVietnameseTones(str) {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function syncAccountHolderName() {
    const ho = (document.getElementById('ho')?.value || '').trim();
    const tenDem = (document.getElementById('tenDem')?.value || '').trim();
    const ten = (document.getElementById('ten')?.value || '').trim();
    const fullName = [ho, tenDem, ten].filter(Boolean).join(' ');

    const tenTKInput = document.getElementById('tenTaiKhoan');
    if (tenTKInput && !tenTKInput.dataset.manualEdited) {
        tenTKInput.value = removeVietnameseTones(fullName);
    }
}

function validateAllFields() {
    let isValid = true;
    let firstInvalidEl = null;

    const markInvalid = (id, message) => {
        const el = document.getElementById(id);
        if (!el) return;
        isValid = false;
        const cell = el.closest('.native-cell') || el.parentElement;
        if (!firstInvalidEl) firstInvalidEl = cell || el;
        el.classList.add('input-error');
        if (cell) cell.classList.add('has-error');

        const errEl = (cell || el.parentElement)?.querySelector('.field-error-msg');
        if (errEl) {
            errEl.textContent = message;
            errEl.classList.remove('hidden');
        }
    };

    const requireField = (id, label) => {
        const el = document.getElementById(id);
        if (!el || !String(el.value || '').trim()) {
            markInvalid(id, `Thiếu ${label}`);
            return false;
        }
        return true;
    };

    requireField('danhXung', 'Danh xưng');
    requireField('ho', 'Họ');
    requireField('ten', 'Tên');
    if (requireField('ngaySinh', 'Ngày sinh')) {
        const dob = new Date(document.getElementById('ngaySinh').value);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        if (age < 18 || age > 100) {
            markInvalid('ngaySinh', 'Cần đủ 18 tuổi trở lên');
        }
    }
    requireField('gioiTinh', 'Giới tính');
    requireField('noiSinh', 'Nơi sinh');
    requireField('tinhTrangHonNhan', 'Tình trạng hôn nhân');
    requireField('quocTich', 'Quốc tịch');
    requireField('loaiGiayTo', 'Loại giấy tờ');

    if (requireField('soGiayTo', 'Số CMND/CCCD')) {
        const loai = document.getElementById('loaiGiayTo').value;
        const so = document.getElementById('soGiayTo').value.trim();
        if (loai === 'Căn cước Công dân' && !/^\d{12}$/.test(so)) {
            markInvalid('soGiayTo', 'CCCD gồm đúng 12 số');
        } else if (loai === 'Chứng minh Nhân dân' && !/^(\d{9}|\d{12})$/.test(so)) {
            markInvalid('soGiayTo', 'CMND gồm 9 hoặc 12 số');
        }
    }
    requireField('noiCap', 'Nơi cấp');
    requireField('ngayCap', 'Ngày cấp');

    requireField('thanhPhoTinh', 'Tỉnh / Thành phố');
    requireField('phuongXa', 'Phường / Xã');
    requireField('soNhaTenDuong', 'Số nhà, tên đường');

    if (requireField('dienThoai', 'Số điện thoại')) {
        const phoneVal = document.getElementById('dienThoai').value.trim().replace(/\s+/g, '');
        if (!/^(0|\+84)[35789]\d{8}$/.test(phoneVal)) {
            markInvalid('dienThoai', 'SĐT gồm 10 số (09xxxxxxxx)');
        }
    }

    if (requireField('email', 'Email')) {
        const emailVal = document.getElementById('email').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
            markInvalid('email', 'Email chưa đúng định dạng');
        }
    }

    requireField('soTaiKhoan', 'Số tài khoản');
    requireField('tenTaiKhoan', 'Tên tài khoản');

    if (!window.cccdScanner.images.front) {
        isValid = false;
        const cardFront = document.getElementById('cccdCardFront');
        if (cardFront) {
            cardFront.classList.add('border-red-500');
            if (!firstInvalidEl) firstInvalidEl = cardFront;
        }
    }
    if (!window.cccdScanner.images.back) {
        isValid = false;
        const cardBack = document.getElementById('cccdCardBack');
        if (cardBack) {
            cardBack.classList.add('border-red-500');
            if (!firstInvalidEl) firstInvalidEl = cardBack;
        }
    }

    if (!isValid && firstInvalidEl) {
        firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Vui lòng kiểm tra các ô báo đỏ & đính kèm đủ 2 mặt CCCD', 'error');
    }

    return isValid;
}

function clearFieldError(el) {
    el.classList.remove('input-error');
    const cell = el.closest('.native-cell') || el.parentElement;
    if (cell) {
        cell.classList.remove('has-error');
        const errEl = cell.querySelector('.field-error-msg');
        if (errEl) errEl.classList.add('hidden');
    }
}

function formatDateVN(isoDate) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function collectFormPayload() {
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const dongYCheckbox = document.getElementById('dongYNhanThongTin');

    return {
        spreadsheetId: GENRE_CONFIG.SPREADSHEET_ID,
        sheetName: GENRE_CONFIG.SHEET_NAME,
        submittedAt: new Date().toISOString(),
        fields: {
            danhXung: val('danhXung'),                                  // Cột B
            ho: val('ho').toUpperCase(),                                // Cột C
            tenDem: val('tenDem').toUpperCase(),                        // Cột D
            ten: val('ten').toUpperCase(),                              // Cột E
            ngaySinh: formatDateVN(val('ngaySinh')),                    // Cột F
            gioiTinh: val('gioiTinh'),                                  // Cột G
            noiSinh: val('noiSinh'),                                    // Cột H
            tinhTrangHonNhan: val('tinhTrangHonNhan'),                  // Cột I
            quocTich: val('quocTich'),                                  // Cột J
            loaiGiayTo: val('loaiGiayTo'),                              // Cột K
            soGiayTo: val('soGiayTo'),                                  // Cột L
            noiCap: val('noiCap'),                                      // Cột M
            ngayCap: formatDateVN(val('ngayCap')),                      // Cột N
            loaiGiayToCu: val('loaiGiayToCu'),                          // Cột O
            soGiayToCu: val('soGiayToCu'),                              // Cột P
            noiCapCu: val('noiCapCu'),                                  // Cột Q
            ngayCapCu: formatDateVN(val('ngayCapCu')),                  // Cột R
            thanhPhoTinh: val('thanhPhoTinh'),                          // Cột S
            phuongXa: val('phuongXa'),                                  // Cột T
            soNhaTenDuong: val('soNhaTenDuong'),                        // Cột U
            email: val('email'),                                        // Cột V
            dienThoai: val('dienThoai'),                                // Cột W
            dongYNhanThongTin: dongYCheckbox?.checked ? 'Đồng ý' : 'Chưa đồng ý', // Cột X
            soTaiKhoan: val('soTaiKhoan'),                              // Cột Y
            tenTaiKhoan: val('tenTaiKhoan').toUpperCase(),              // Cột Z
            maSoNganHang: val('maSoNganHang'),                          // Cột AA
            tenNganHang: val('tenNganHang'),                            // Cột AB
            maSoChiNhanh: val('maSoChiNhanh'),                          // Cột AC
            tenChiNhanh: val('tenChiNhanh'),                            // Cột AD
            diaChiChiNhanh: val('diaChiChiNhanh'),                      // Cột AE
            cccdMatTruocStatus: window.cccdScanner.images.front ? 'Đã tải lên' : 'Chưa đính kèm', // Cột AF
            cccdMatSauStatus: window.cccdScanner.images.back ? 'Đã tải lên' : 'Chưa đính kèm'     // Cột AG
        },
        images: {
            cccdFrontBase64: window.cccdScanner.images.front || '',
            cccdBackBase64: window.cccdScanner.images.back || ''
        }
    };
}

async function submitGenreForm() {
    if (!validateAllFields()) return;

    const payload = collectFormPayload();
    const scriptUrl = getActiveScriptUrl();

    const btnSubmit = document.getElementById('btnSubmitForm');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `
        <svg class="animate-spin h-5 w-5 text-white inline mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Đang đồng bộ lên Google Sheet...</span>
    `;

    try {
        if (typeof google !== 'undefined' && google.script && google.script.run) {
            await new Promise((resolve, reject) => {
                google.script.run
                    .withSuccessHandler(res => resolve(res))
                    .withFailureHandler(err => reject(err))
                    .processFormSubmission(payload);
            });
            onSubmissionSuccess(payload);
            return;
        }

        if (scriptUrl) {
            await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            onSubmissionSuccess(payload);
        } else {
            saveLocalSubmissionHistory(payload);
            onSubmissionSuccess(payload, true);
        }
    } catch (error) {
        console.error('Lỗi gửi hồ sơ:', error);
        showToast('Không thể kết nối mạng. Vui lòng thử lại!', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function onSubmissionSuccess(payload, isOfflineDemo = false) {
    saveLocalSubmissionHistory(payload);
    localStorage.removeItem('GENRE_FORM_DRAFT');

    document.getElementById('mainFormContainer')?.classList.add('hidden');
    document.getElementById('bottomActionBar')?.classList.add('hidden');
    document.getElementById('successScreen')?.classList.remove('hidden');

    const f = payload.fields;
    const fullName = [f.ho, f.tenDem, f.ten].filter(Boolean).join(' ');
    document.getElementById('successApplicantName').textContent = `${f.danhXung} ${fullName}`;
    document.getElementById('successApplicantCCCD').textContent = f.soGiayTo;
    document.getElementById('successApplicantPhone').textContent = f.dienThoai;

    const syncNote = document.getElementById('successSyncNote');
    if (syncNote) {
        syncNote.innerHTML = isOfflineDemo
            ? `<div class="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs mt-3 text-left">
                Bạn chưa dán URL Google Apps Script trong mục <strong>Sheet</strong> (góc phải trên). Bạn có thể tải file CSV bên dưới hoặc gắn URL để tự động đổ vào Google Sheet.
               </div>`
            : `<div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mt-3">
                ✓ Đã ghi tự động vào Sheet Danh_Sach_Tong_Hop
               </div>`;
    }

    window.lastSubmittedPayload = payload;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function downloadLastSubmissionCSV() {
    const p = window.lastSubmittedPayload || collectFormPayload();
    const f = p.fields;

    const headers = [
        'STT', 'Danh xưng*', 'Họ*', 'Tên đệm', 'Tên*', 'Ngày sinh*', 'Giới tính*', 'Nơi sinh*',
        'Tình trạng hôn nhân*', 'Quốc tịch*', 'Loại giấy tờ*', 'CMND/CCCD*', 'Nơi cấp CMND/CCCD*',
        'Ngày cấp CMND/CCCD*', 'Loại giấy tờ (cũ)', 'CMND/CCCD Cũ', 'Nơi cấp CMND/CCCD Cũ',
        'Ngày cấp CMND/CCCD Cũ', 'Thành phố/ Tỉnh*', 'Phường/ Xã*', 'Số nhà, tên đường*',
        'Email/ thư điện tử*', 'Điện thoại di động*', 'Đồng ý nhận thông tin từ Generali Việt Nam*',
        'Số tài khoản*', 'Tên tài khoản*', 'Mã số ngân hàng*', 'Tên ngân hàng',
        'Mã số chi nhánh/ PGD*', 'Tên Chi nhánh/ PGD', 'Địa chỉ Chi nhánh',
        'CMND/CCCD* - Mặt trước', 'CMND/CCCD* - Mặt sau'
    ];

    const row = [
        '1', f.danhXung, f.ho, f.tenDem, f.ten, f.ngaySinh, f.gioiTinh, f.noiSinh,
        f.tinhTrangHonNhan, f.quocTich, f.loaiGiayTo, `'${f.soGiayTo}`, f.noiCap,
        f.ngayCap, f.loaiGiayToCu, f.soGiayToCu ? `'${f.soGiayToCu}` : '', f.noiCapCu,
        f.ngayCapCu, f.thanhPhoTinh, f.phuongXa, f.soNhaTenDuong,
        f.email, `'${f.dienThoai}`, f.dongYNhanThongTin,
        `'${f.soTaiKhoan}`, f.tenTaiKhoan, f.maSoNganHang, f.tenNganHang,
        f.maSoChiNhanh, f.tenChiNhanh, f.diaChiChiNhanh,
        f.cccdMatTruocStatus, f.cccdMatSauStatus
    ];

    const escapeCsv = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
    const csvContent = '\uFEFF' + headers.map(escapeCsv).join(',') + '\n' + row.map(escapeCsv).join(',');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ho_So_GENRE_${f.soGiayTo || 'Moi'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function confirmResetForm() {
    resetForNewRegistration();
    showToast('Đã làm mới toàn bộ form để tạo hồ sơ mới!', 'info');
}

function resetForNewRegistration() {
    localStorage.removeItem('GENRE_FORM_DRAFT');
    document.getElementById('genreRegistrationForm').reset();
    document.getElementById('oldIdSection')?.classList.add('hidden');
    selectSegmented('danhXung', 'Anh');
    selectSegmented('gioiTinh', 'Nam');
    selectSegmented('tinhTrangHonNhan', 'Độc thân');
    selectSegmented('loaiGiayTo', 'Căn cước Công dân');
    document.querySelectorAll('#popularBankChips .bank-chip').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.native-cell.has-error').forEach(c => c.classList.remove('has-error'));
    document.querySelectorAll('.field-error-msg').forEach(e => e.classList.add('hidden'));

    window.cccdScanner.removeImage('front');
    window.cccdScanner.removeImage('back');
    window.cccdScanner.extractedData = {};
    document.getElementById('scanExtractResultBanner')?.classList.add('hidden');
    const tenTKInput = document.getElementById('tenTaiKhoan');
    if (tenTKInput) delete tenTKInput.dataset.manualEdited;

    document.getElementById('successScreen')?.classList.add('hidden');
    document.getElementById('mainFormContainer')?.classList.remove('hidden');
    document.getElementById('bottomActionBar')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveDraftData() {
    try {
        const ids = [
            'danhXung', 'ho', 'tenDem', 'ten', 'ngaySinh', 'gioiTinh', 'noiSinh',
            'tinhTrangHonNhan', 'quocTich', 'loaiGiayTo', 'soGiayTo', 'noiCap', 'ngayCap',
            'loaiGiayToCu', 'soGiayToCu', 'noiCapCu', 'ngayCapCu',
            'thanhPhoTinh', 'phuongXa', 'soNhaTenDuong', 'email', 'dienThoai',
            'soTaiKhoan', 'tenTaiKhoan', 'maSoNganHang', 'tenNganHang',
            'maSoChiNhanh', 'tenChiNhanh', 'diaChiChiNhanh'
        ];
        const draft = {};
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) draft[id] = el.value;
        });
        localStorage.setItem('GENRE_FORM_DRAFT', JSON.stringify(draft));
    } catch (e) {}
}

function restoreDraftData() {
    try {
        const raw = localStorage.getItem('GENRE_FORM_DRAFT');
        if (!raw) return;
        const draft = JSON.parse(raw);
        Object.keys(draft).forEach(id => {
            const el = document.getElementById(id);
            if (el && draft[id]) {
                el.value = draft[id];
            }
        });
        if (draft.soGiayToCu || draft.loaiGiayToCu) {
            const toggleOld = document.getElementById('toggleOldId');
            const oldSection = document.getElementById('oldIdSection');
            if (toggleOld && oldSection) {
                toggleOld.checked = true;
                oldSection.classList.remove('hidden');
            }
        }
    } catch (e) {}
}

function saveLocalSubmissionHistory(payload) {
    try {
        const list = JSON.parse(localStorage.getItem('GENRE_SUBMISSIONS') || '[]');
        list.unshift({ time: payload.submittedAt, fields: payload.fields });
        localStorage.setItem('GENRE_SUBMISSIONS', JSON.stringify(list.slice(0, 30)));
    } catch (e) {}
}

function getActiveScriptUrl() {
    const urlParam = new URLSearchParams(window.location.search).get('api');
    if (urlParam) return urlParam;
    return localStorage.getItem('GENRE_GAS_URL') || GENRE_CONFIG.DEFAULT_SCRIPT_URL;
}

function loadSavedConfig() {
    const savedUrl = getActiveScriptUrl();
    const input = document.getElementById('gasWebhookUrlInput');
    if (input && savedUrl) input.value = savedUrl;
    updateConnectionBadge();
}

function saveGasConfig() {
    const input = document.getElementById('gasWebhookUrlInput');
    if (!input) return;
    const url = input.value.trim();
    localStorage.setItem('GENRE_GAS_URL', url);
    updateConnectionBadge();
    toggleSettingsModal(false);
    showToast(url ? 'Đã lưu kết nối Google Sheet!' : 'Đã xóa URL kết nối.', 'success');
}

function updateConnectionBadge() {
    const badge = document.getElementById('sheetConnectionStatus');
    const url = getActiveScriptUrl();
    const isInsideGAS = typeof google !== 'undefined' && google.script && google.script.run;
    if (!badge) return;

    if (url || isInsideGAS) {
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5"></span>Đã nối Sheet`;
    } else {
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 inline-block mr-1.5"></span>Sheet`;
    }
}

function toggleSettingsModal(show) {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    if (show) {
        modal.classList.remove('hidden');
        const qrImg = document.getElementById('shareFormQrImg');
        const shareUrlInput = document.getElementById('shareFormUrlInput');
        const currentUrl = window.location.href.startsWith('http')
            ? window.location.href
            : (GENRE_CONFIG.LIVE_APP_URL || 'https://generali-genre-ekyc.vercel.app/');
        if (shareUrlInput) shareUrlInput.value = currentUrl;
        if (qrImg) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`;
            qrImg.classList.remove('hidden');
        }
    } else {
        modal.classList.add('hidden');
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const colors = {
        success: 'bg-gray-900/95 text-white border border-emerald-500/40',
        error: 'bg-red-700/95 text-white',
        info: 'bg-gray-900/95 text-white'
    };

    const toast = document.createElement('div');
    toast.className = `${colors[type] || colors.info} backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl text-xs font-bold flex items-center justify-center text-center transition-all duration-300`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}
