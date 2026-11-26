/**
 * Điều khiển Form Đăng Ký Hồ Sơ GENRE — Generali Việt Nam
 * - Giao diện phẳng, rộng, rõ ràng
 * - Tích hợp danh mục hành chính mới sau sáp nhập (34 Tỉnh/Thành phố & 3.321 Phường/Xã/Đặc khu)
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
    restoreDraftData();
    syncAllSegmentedTracksFromInputs();
});

function selectSegmented(fieldId, value, skipCascade = false) {
    const input = document.getElementById(fieldId);
    if (input) {
        input.value = value;
        clearFieldError(input);
    }

    const track = document.querySelector(`.segmented-track[data-target="${fieldId}"]`);
    if (track) {
        track.querySelectorAll('.seg-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.val === value);
        });
    }

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

function normalizeAdminCompare(str) {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/^(?:phuong|p\.|xa|x\.|thi tran|tt\.|dac khu)\s+/, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Nạp danh sách Phường / Xã / Đặc khu mới sau sáp nhập theo Tỉnh / Thành phố đã chọn
 */
function populateWardsForProvince(provinceName, preferredWard = '') {
    const wardSelect = document.getElementById('phuongXa');
    if (!wardSelect) return;

    wardSelect.innerHTML = '<option value="">-- Chọn Phường / Xã --</option>';

    const wards = (typeof VN_ADMIN_2025 !== 'undefined' && VN_ADMIN_2025[provinceName])
        ? VN_ADMIN_2025[provinceName]
        : [];

    wards.forEach(wName => {
        const opt = document.createElement('option');
        opt.value = wName;
        opt.textContent = wName;
        wardSelect.appendChild(opt);
    });

    if (preferredWard) {
        trySelectMergedWard(preferredWard);
    }
}
window.populateWardsForProvince = populateWardsForProvince;

function trySelectMergedWard(rawWardCandidate) {
    const wardSelect = document.getElementById('phuongXa');
    const provSelect = document.getElementById('thanhPhoTinh');
    if (!wardSelect || !rawWardCandidate) return false;

    const provinceName = provSelect?.value || '';
    const wards = (typeof VN_ADMIN_2025 !== 'undefined' && VN_ADMIN_2025[provinceName])
        ? VN_ADMIN_2025[provinceName]
        : [];
    if (wards.length === 0) return false;

    // 1. Khớp chính xác tuyệt đối
    if (wards.includes(rawWardCandidate)) {
        wardSelect.value = rawWardCandidate;
        clearFieldError(wardSelect);
        return true;
    }

    // 2. Khớp theo tên chuẩn hóa (bỏ tiền tố Phường/Xã/P.)
    const targetCore = normalizeAdminCompare(rawWardCandidate.split(',')[0]);
    if (!targetCore) return false;

    const matched = wards.find(w => normalizeAdminCompare(w) === targetCore);
    if (matched) {
        wardSelect.value = matched;
        clearFieldError(wardSelect);
        return true;
    }

    return false;
}
window.trySelectMergedWard = trySelectMergedWard;

function initDropdownData() {
    const noiSinhSelect = document.getElementById('noiSinh');
    const tinhSelect = document.getElementById('thanhPhoTinh');

    const adminProvinces = (typeof VN_ADMIN_2025 !== 'undefined')
        ? Object.keys(VN_ADMIN_2025)
        : GENRE_DATA.provinces;

    adminProvinces.forEach(prov => {
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
            opt.textContent = `${bank.shortName} — ${bank.fullName}`;
            bankPicker.appendChild(opt);
        });
    }
}

function bindFormEvents() {
    ['danhXung', 'gioiTinh', 'tinhTrangHonNhan', 'loaiGiayTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                selectSegmented(id, el.value, true);
            });
        }
    });

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

    // Khi chọn Thành phố / Tỉnh -> Nạp danh sách Phường / Xã mới sau sáp nhập
    const tinhSelect = document.getElementById('thanhPhoTinh');
    if (tinhSelect) {
        tinhSelect.addEventListener('change', () => {
            populateWardsForProvince(tinhSelect.value);
            clearFieldError(tinhSelect);
            saveDraftData();
        });
    }

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

    const bankPicker = document.getElementById('bankQuickPicker');
    if (bankPicker) {
        bankPicker.addEventListener('change', () => {
            const code = bankPicker.value;
            const bank = GENRE_DATA.banks.find(b => b.code === code);
            const maNH = document.getElementById('maSoNganHang');
            const tenNH = document.getElementById('tenNganHang');
            if (bank) {
                if (maNH && !maNH.value) maNH.value = bank.code;
                if (tenNH) tenNH.value = bank.fullName;
            } else {
                if (tenNH) tenNH.value = '';
            }
            saveDraftData();
        });
    }

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

    document.querySelectorAll('.flat-nav-tabs .nav-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.flat-nav-tabs .nav-pill').forEach(p => p.classList.remove('active'));
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
        const container = el.closest('.flat-field') || el.parentElement;
        if (!firstInvalidEl) firstInvalidEl = container || el;
        el.classList.add('input-error');

        const errEl = container?.querySelector('.field-error-msg');
        if (errEl) {
            errEl.textContent = message;
            errEl.classList.remove('hidden');
        }
    };

    const requireField = (id, label) => {
        const el = document.getElementById(id);
        if (!el || !String(el.value || '').trim()) {
            markInvalid(id, `Vui lòng nhập/chọn ${label}`);
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

    if (requireField('soGiayTo', 'CMND/CCCD')) {
        const loai = document.getElementById('loaiGiayTo').value;
        const so = document.getElementById('soGiayTo').value.trim();
        if (loai === 'Căn cước Công dân' && !/^\d{12}$/.test(so)) {
            markInvalid('soGiayTo', 'CCCD phải gồm 12 chữ số');
        } else if (loai === 'Chứng minh Nhân dân' && !/^(\d{9}|\d{12})$/.test(so)) {
            markInvalid('soGiayTo', 'CMND phải gồm 9 hoặc 12 chữ số');
        }
    }
    requireField('noiCap', 'Nơi cấp');
    requireField('ngayCap', 'Ngày cấp');

    requireField('thanhPhoTinh', 'Thành phố / Tỉnh');
    requireField('phuongXa', 'Phường / Xã');
    requireField('soNhaTenDuong', 'Số nhà, tên đường');

    if (requireField('dienThoai', 'Điện thoại di động')) {
        const phoneVal = document.getElementById('dienThoai').value.trim().replace(/\s+/g, '');
        if (!/^(0|\+84)[35789]\d{8}$/.test(phoneVal)) {
            markInvalid('dienThoai', 'Số điện thoại không hợp lệ');
        }
    }

    if (requireField('email', 'Email')) {
        const emailVal = document.getElementById('email').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
            markInvalid('email', 'Email không hợp lệ');
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
        showToast('Vui lòng kiểm tra các mục bắt buộc (*) và 2 mặt CCCD', 'error');
    }

    return isValid;
}

function clearFieldError(el) {
    el.classList.remove('input-error');
    const container = el.closest('.flat-field') || el.parentElement;
    const errEl = container?.querySelector('.field-error-msg');
    if (errEl) errEl.classList.add('hidden');
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
            danhXung: val('danhXung'),
            ho: val('ho').toUpperCase(),
            tenDem: val('tenDem').toUpperCase(),
            ten: val('ten').toUpperCase(),
            ngaySinh: formatDateVN(val('ngaySinh')),
            gioiTinh: val('gioiTinh'),
            noiSinh: val('noiSinh'),
            tinhTrangHonNhan: val('tinhTrangHonNhan'),
            quocTich: val('quocTich'),
            loaiGiayTo: val('loaiGiayTo'),
            soGiayTo: val('soGiayTo'),
            noiCap: val('noiCap'),
            ngayCap: formatDateVN(val('ngayCap')),
            loaiGiayToCu: val('loaiGiayToCu'),
            soGiayToCu: val('soGiayToCu'),
            noiCapCu: val('noiCapCu'),
            ngayCapCu: formatDateVN(val('ngayCapCu')),
            thanhPhoTinh: val('thanhPhoTinh'),
            phuongXa: val('phuongXa'),
            soNhaTenDuong: val('soNhaTenDuong'),
            email: val('email'),
            dienThoai: val('dienThoai'),
            dongYNhanThongTin: dongYCheckbox?.checked ? 'Đồng ý' : 'Chưa đồng ý',
            soTaiKhoan: val('soTaiKhoan'),
            tenTaiKhoan: val('tenTaiKhoan').toUpperCase(),
            maSoNganHang: val('maSoNganHang'),
            tenNganHang: val('tenNganHang'),
            maSoChiNhanh: val('maSoChiNhanh'),
            tenChiNhanh: val('tenChiNhanh'),
            diaChiChiNhanh: val('diaChiChiNhanh'),
            cccdMatTruocStatus: window.cccdScanner.images.front ? 'Đã tải lên' : 'Chưa đính kèm',
            cccdMatSauStatus: window.cccdScanner.images.back ? 'Đã tải lên' : 'Chưa đính kèm'
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
    btnSubmit.innerHTML = '<span>Đang gửi hồ sơ...</span>';

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

function onSubmissionSuccess(payload) {
    localStorage.removeItem('GENRE_FORM_DRAFT');

    document.getElementById('mainFormContainer')?.classList.add('hidden');
    document.getElementById('bottomActionBar')?.classList.add('hidden');
    document.getElementById('successScreen')?.classList.remove('hidden');

    const f = payload.fields;
    const fullName = [f.ho, f.tenDem, f.ten].filter(Boolean).join(' ');
    document.getElementById('successApplicantName').textContent = `${f.danhXung} ${fullName}`;
    document.getElementById('successApplicantCCCD').textContent = f.soGiayTo;
    document.getElementById('successApplicantPhone').textContent = f.dienThoai;

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
    showToast('Đã xóa trắng để tạo mới', 'info');
}

function resetForNewRegistration() {
    localStorage.removeItem('GENRE_FORM_DRAFT');
    document.getElementById('genreRegistrationForm').reset();
    document.getElementById('oldIdSection')?.classList.add('hidden');
    populateWardsForProvince('');
    selectSegmented('danhXung', 'Anh');
    selectSegmented('gioiTinh', 'Nam');
    selectSegmented('tinhTrangHonNhan', 'Độc thân');
    selectSegmented('loaiGiayTo', 'Căn cước Công dân');
    document.querySelectorAll('.field-error-msg').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('.input-error').forEach(e => e.classList.remove('input-error'));

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
            'bankQuickPicker', 'soTaiKhoan', 'tenTaiKhoan', 'maSoNganHang', 'tenNganHang',
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

        // Nạp lại danh sách Phường/Xã mới trước khi gán giá trị đã lưu
        if (draft.thanhPhoTinh) {
            const tinhEl = document.getElementById('thanhPhoTinh');
            if (tinhEl) tinhEl.value = draft.thanhPhoTinh;
            populateWardsForProvince(draft.thanhPhoTinh, draft.phuongXa || '');
        }

        Object.keys(draft).forEach(id => {
            if (id === 'thanhPhoTinh' || id === 'phuongXa') return;
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

function getActiveScriptUrl() {
    const urlParam = new URLSearchParams(window.location.search).get('api');
    if (urlParam) return urlParam;
    return localStorage.getItem('GENRE_GAS_URL') || GENRE_CONFIG.DEFAULT_SCRIPT_URL;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const colors = {
        success: 'bg-gray-900 text-white',
        error: 'bg-red-700 text-white',
        info: 'bg-gray-900 text-white'
    };

    const toast = document.createElement('div');
    toast.className = `${colors[type] || colors.info} px-4 py-3 rounded-lg shadow-md text-xs font-bold text-center transition-opacity duration-300`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
