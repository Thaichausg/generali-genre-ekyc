/**
 * Bộ xử lý Nút "SCAN CCCD 2 MẶT" Thông Minh (eKYC Action Button)
 * Thực hiện đồng thời 2 nhiệm vụ chỉ trong 1 nút bấm:
 *   1) Trích xuất thông tin từ CCCD (Quét QR CCCD gắn chip + OCR/MRZ nhận diện chữ từ ảnh chụp/ảnh tải lên)
 *      và tự động điền vào tất cả các trường tương ứng trên Form (Họ, Tên đệm, Tên, Số CCCD, CMND cũ,
 *      Ngày sinh, Giới tính, Danh xưng, Ngày cấp, Nơi cấp, Tỉnh/TP, Phường/Xã, Số nhà/Tên đường, Tên TK Ngân hàng).
 *   2) Tự động cắt chuẩn khung thẻ & đưa luôn hình Mặt trước + Mặt sau vào mục "2. Chứng từ đính kèm".
 */

class CCCDScanner {
    constructor() {
        this.currentSide = 'front'; // 'front' | 'back'
        this.autoFlowBothSides = true; // Khi bấm nút "Chụp Scan CCCD 2 Mặt", chụp xong mặt trước sẽ tự chuyển sang chụp mặt sau
        this.stream = null;
        this.facingMode = 'environment';
        this.rawCanvas = document.createElement('canvas');
        this.processedDataUrl = null;
        this.isEnhancedScan = false;
        this.rotation = 0;
        this.qrScanInterval = null;
        this.isExtracting = false;

        // Lưu trữ dữ liệu ảnh Base64 của 2 mặt CCCD cho mục "2. Chứng từ đính kèm"
        this.images = {
            front: null,
            back: null
        };

        // Lưu thông tin đã trích xuất gần nhất
        this.extractedData = {};
    }

    init() {
        this.modal = document.getElementById('scannerModal');
        this.video = document.getElementById('scannerVideo');
        this.previewCanvas = document.getElementById('scannerPreviewCanvas');
        this.overlayFrame = document.getElementById('scannerFrameBox');
        this.titleEl = document.getElementById('scannerModalTitle');
        this.subtitleEl = document.getElementById('scannerModalSubtitle');
        this.liveControls = document.getElementById('scannerLiveControls');
        this.editControls = document.getElementById('scannerEditControls');
        this.videoWrap = document.getElementById('scannerVideoWrap');
        this.previewWrap = document.getElementById('scannerPreviewWrap');
        this.qrStatusBanner = document.getElementById('qrDetectBanner');
        this.extractLoadingBanner = document.getElementById('extractLoadingBanner');
        this.sideStepPill = document.getElementById('scannerSideStepPill');
    }

    /**
     * Mở Nút Scan CCCD Trực Tiếp
     * @param {'front'|'back'} side - Mặt bắt đầu chụp
     * @param {boolean} autoNextSide - Nếu true: chụp xong mặt trước sẽ tự động hỏi/chuyển sang mặt sau
     */
    async openCamera(side = 'front', autoNextSide = true) {
        this.currentSide = side;
        this.autoFlowBothSides = autoNextSide;
        this.isEnhancedScan = false;
        this.rotation = 0;

        if (!this.modal) this.init();

        this.updateModalHeaderUI();
        this.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        this.showLiveView();
        await this.startVideoStream();
    }

    updateModalHeaderUI() {
        if (!this.titleEl) return;
        if (this.currentSide === 'front') {
            this.titleEl.textContent = 'Scan CCCD - Mặt Trước (1/2)';
            this.subtitleEl.textContent = 'Tự động trích xuất thông tin điền vào Form & lưu ảnh Mặt trước';
            if (this.sideStepPill) {
                this.sideStepPill.textContent = 'MẶT TRƯỚC (Có ảnh & Mã QR)';
                this.sideStepPill.className = 'text-[11px] font-bold px-3 py-1 rounded-full bg-red-600 text-white shadow';
            }
        } else {
            this.titleEl.textContent = 'Scan CCCD - Mặt Sau (2/2)';
            this.subtitleEl.textContent = 'Trích xuất Ngày cấp / MRZ & lưu ảnh Mặt sau vào Đính kèm';
            if (this.sideStepPill) {
                this.sideStepPill.textContent = 'MẶT SAU (Ngày cấp & Dòng mã <<<)';
                this.sideStepPill.className = 'text-[11px] font-bold px-3 py-1 rounded-full bg-amber-600 text-white shadow';
            }
        }
    }

    showLiveView() {
        this.videoWrap.classList.remove('hidden');
        this.previewWrap.classList.add('hidden');
        this.liveControls.classList.remove('hidden');
        this.editControls.classList.add('hidden');
        const btnEnhance = document.getElementById('btnToggleEnhance');
        if (btnEnhance) {
            btnEnhance.classList.remove('bg-red-600', 'text-white');
            btnEnhance.classList.add('bg-gray-800', 'text-gray-200');
        }
    }

    showPreviewView() {
        this.videoWrap.classList.add('hidden');
        this.previewWrap.classList.remove('hidden');
        this.liveControls.classList.add('hidden');
        this.editControls.classList.remove('hidden');
        this.stopVideoStream();
    }

    async startVideoStream() {
        this.stopVideoStream();
        try {
            const constraints = {
                audio: false,
                video: {
                    facingMode: { ideal: this.facingMode },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            await this.video.play();

            // Trong lúc khách đưa CCCD mặt trước vào khung, tự động quét QR liên tục
            if (this.currentSide === 'front') {
                this.startAutoQrDetection();
            }
        } catch (err) {
            console.warn('Không thể mở Camera trực tiếp trên trình duyệt:', err);
            this.closeModal();
            const fallbackInput = document.getElementById(
                this.currentSide === 'front' ? 'cameraInputFront' : 'cameraInputBack'
            );
            if (fallbackInput) {
                showToast('Đang mở máy ảnh/thư viện ảnh để Scan & trích xuất...', 'info');
                fallbackInput.click();
            }
        }
    }

    stopVideoStream() {
        if (this.qrScanInterval) {
            clearInterval(this.qrScanInterval);
            this.qrScanInterval = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    async switchCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        await this.startVideoStream();
    }

    /**
     * Tự động phát hiện mã QR trên mặt trước CCCD ngay khi đang soi camera
     */
    startAutoQrDetection() {
        if (typeof jsQR === 'undefined') return;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

        this.qrScanInterval = setInterval(() => {
            if (!this.video || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) return;
            const vw = this.video.videoWidth;
            const vh = this.video.videoHeight;
            if (!vw || !vh) return;

            tempCanvas.width = vw;
            tempCanvas.height = vh;
            tempCtx.drawImage(this.video, 0, 0, vw, vh);

            const code = this.findQRInCanvas(tempCanvas);
            if (code && code.includes('|')) {
                const parsed = this.parseCCCDQR(code);
                if (parsed) {
                    this.fillFormFromExtractedData(parsed, 'Mã QR CCCD');
                    if (this.qrStatusBanner) {
                        this.qrStatusBanner.classList.remove('hidden');
                        this.qrStatusBanner.textContent = `✓ Đã trích xuất: ${parsed.fullName} (${parsed.cccd}) - Bấm nút đỏ để chụp lưu ảnh!`;
                    }
                }
            }
        }, 600);
    }

    /**
     * Tìm mã QR trên toàn bộ ảnh + phóng đại góc trên bên phải (nơi đặt QR của CCCD gắn chip)
     */
    findQRInCanvas(sourceCanvas) {
        if (typeof jsQR === 'undefined') return null;
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;
        const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });

        // 1. Quét toàn khung ảnh
        let imgData = ctx.getImageData(0, 0, w, h);
        let code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
        if (code && code.data) return code.data;

        // 2. Cắt và phóng to góc phải trên (vị trí mã QR trên thẻ CCCD Việt Nam) để đọc ảnh chụp xa
        const regions = [
            { x: Math.floor(w * 0.5), y: 0, rw: Math.floor(w * 0.5), rh: Math.floor(h * 0.6) },
            { x: Math.floor(w * 0.6), y: 0, rw: Math.floor(w * 0.4), rh: Math.floor(h * 0.5) },
            { x: 0, y: 0, rw: Math.floor(w * 0.5), rh: Math.floor(h * 0.6) } // Trường hợp ảnh bị ngược
        ];

        const zoomCanvas = document.createElement('canvas');
        const zoomCtx = zoomCanvas.getContext('2d', { willReadFrequently: true });

        for (const r of regions) {
            if (r.rw <= 20 || r.rh <= 20) continue;
            zoomCanvas.width = 600;
            zoomCanvas.height = 600;
            zoomCtx.drawImage(sourceCanvas, r.x, r.y, r.rw, r.rh, 0, 0, 600, 600);
            const zData = zoomCtx.getImageData(0, 0, 600, 600);
            const zCode = jsQR(zData.data, 600, 600, { inversionAttempts: 'attemptBoth' });
            if (zCode && zCode.data) return zCode.data;
        }

        return null;
    }

    /**
     * Chụp hình từ Video, tự động cắt khung thẻ CCCD và chạy Trích xuất thông tin
     */
    async captureFrame() {
        if (!this.video || !this.video.videoWidth) return;

        const vw = this.video.videoWidth;
        const vh = this.video.videoHeight;

        const videoRect = this.video.getBoundingClientRect();
        const frameRect = this.overlayFrame.getBoundingClientRect();

        const videoRatio = vw / vh;
        const boxRatio = videoRect.width / videoRect.height;
        let renderW, renderH, offsetX, offsetY;

        if (videoRatio > boxRatio) {
            renderH = videoRect.height;
            renderW = renderH * videoRatio;
            offsetX = (renderW - videoRect.width) / 2;
            offsetY = 0;
        } else {
            renderW = videoRect.width;
            renderH = renderW / videoRatio;
            offsetX = 0;
            offsetY = (renderH - videoRect.height) / 2;
        }

        const scaleX = vw / renderW;
        const scaleY = vh / renderH;

        const relX = (frameRect.left - videoRect.left) + offsetX;
        const relY = (frameRect.top - videoRect.top) + offsetY;

        const padX = frameRect.width * 0.04;
        const padY = frameRect.height * 0.04;

        const sx = Math.max(0, (relX - padX) * scaleX);
        const sy = Math.max(0, (relY - padY) * scaleY);
        const sw = Math.min(vw - sx, (frameRect.width + padX * 2) * scaleX);
        const sh = Math.min(vh - sy, (frameRect.height + padY * 2) * scaleY);

        const targetW = Math.min(1280, Math.round(sw));
        const targetH = Math.round(targetW * (sh / sw));

        this.rawCanvas.width = targetW;
        this.rawCanvas.height = targetH;
        const ctx = this.rawCanvas.getContext('2d');
        ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, targetW, targetH);

        this.rotation = 0;
        this.isEnhancedScan = false;
        this.renderPreview();
        this.showPreviewView();

        // Tự động trích xuất thông tin từ ảnh vừa chụp (QR + OCR)
        await this.extractInfoFromCanvas(this.rawCanvas, this.currentSide);
    }

    /**
     * Xử lý khi người dùng Tải hình lên (1 hoặc 2 hình cùng lúc) từ điện thoại / máy tính
     * -> Tự động trích xuất thông tin điền vào Form VÀ tự động gắn vào mục "2. Chứng từ đính kèm"
     */
    async handleBatchFilesUpload(fileList, defaultSide = 'front') {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) {
            showToast('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG)', 'error');
            return;
        }

        // Nếu người dùng chọn 2 ảnh cùng lúc (Mặt trước + Mặt sau)
        if (files.length >= 2) {
            showToast('Đang đọc 2 mặt ảnh CCCD để trích xuất thông tin & đính kèm...', 'info');
            await this.processUploadedFileSilent(files[0], 'front');
            await this.processUploadedFileSilent(files[1], 'back');
            return;
        }

        // Nếu chọn 1 ảnh
        await this.processUploadedFileSilent(files[0], defaultSide);
    }

    /**
     * Xử lý nhanh 1 file ảnh tải lên:
     * 1) Chuẩn hóa kích thước & Đính kèm ngay vào mục "2. Chứng từ đính kèm"
     * 2) Chạy trích xuất thông tin (QR + OCR) và tự điền vào Form
     */
    processUploadedFileSilent(file, side) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = async () => {
                    const maxDim = 1400;
                    let w = img.width;
                    let h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }

                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = w;
                    tempCanvas.height = h;
                    const ctx = tempCanvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);

                    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.86);

                    // Lưu ngay vào phần Đính kèm (Chức năng 2)
                    this.images[side] = dataUrl;
                    this.updateAttachmentUI(side, dataUrl);

                    // Chạy trích xuất thông tin và tự động điền Form (Chức năng 1)
                    await this.extractInfoFromCanvas(tempCanvas, side);
                    resolve();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Trích xuất thông tin từ hình CCCD:
     * - Bước A: Quét mã QR trên mặt trước CCCD (chính xác 100%, tốc độ 0.1 giây)
     * - Bước B: Nếu ảnh không đọc được QR hoặc là mặt sau (chứa Ngày cấp / dòng MRZ), dùng Tesseract OCR để đọc chữ trên thẻ
     */
    async extractInfoFromCanvas(canvas, side) {
        this.setExtractStatusUI(true, 'Đang trích xuất thông tin từ ảnh CCCD...');

        try {
            // 1. Thử đọc Mã QR CCCD trước
            const qrRaw = this.findQRInCanvas(canvas);
            if (qrRaw && qrRaw.includes('|')) {
                const parsed = this.parseCCCDQR(qrRaw);
                if (parsed) {
                    this.fillFormFromExtractedData(parsed, 'Mã QR CCCD');
                    this.setExtractStatusUI(false, `✓ Đã tự động điền: ${parsed.fullName} - CCCD: ${parsed.cccd}`);
                    return true;
                }
            }

            // 2. Nếu không thấy QR (hoặc đây là Mặt sau CCCD / ảnh chụp mờ QR), chạy OCR nhận diện chữ trên thẻ
            if (typeof Tesseract !== 'undefined') {
                this.setExtractStatusUI(true, 'Đang nhận diện chữ (OCR) trên thẻ CCCD...');
                const result = await Tesseract.recognize(canvas, 'vie+eng');
                const rawText = (result && result.data && result.data.text) ? result.data.text : '';
                if (rawText) {
                    const ocrData = this.parseOCRText(rawText, side);
                    if (ocrData && Object.keys(ocrData).length > 0) {
                        this.fillFormFromExtractedData(ocrData, 'Nhận diện chữ OCR');
                        this.setExtractStatusUI(
                            false,
                            `✓ Đã trích xuất thông tin từ ${side === 'front' ? 'Mặt trước' : 'Mặt sau'} CCCD và điền vào Form!`
                        );
                        return true;
                    }
                }
            }

            this.setExtractStatusUI(
                false,
                side === 'front'
                    ? 'Đã đính kèm ảnh Mặt trước. (Mẹo: Chụp rõ góc phải mã QR để tự điền nhanh 100% thông tin)'
                    : '✓ Đã đính kèm ảnh Mặt sau CCCD vào hồ sơ!'
            );
            return false;
        } catch (err) {
            console.warn('Lỗi khi trích xuất OCR:', err);
            this.setExtractStatusUI(false, '✓ Đã lưu ảnh CCCD vào mục Chứng từ đính kèm.');
            return false;
        }
    }

    setExtractStatusUI(isLoading, message) {
        this.isExtracting = isLoading;
        // Banner trong Modal Camera
        if (this.extractLoadingBanner) {
            this.extractLoadingBanner.classList.remove('hidden');
            this.extractLoadingBanner.innerHTML = isLoading
                ? `<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></span>${message}`
                : message;
        }
        // Banner trạng thái ngoài trang chính ngay dưới nút Scan CCCD
        const mainBanner = document.getElementById('scanExtractResultBanner');
        const mainBannerText = document.getElementById('scanExtractResultText');
        if (mainBanner && mainBannerText && message) {
            mainBanner.classList.remove('hidden');
            mainBannerText.innerHTML = isLoading
                ? `<span class="inline-block w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-1.5 align-middle"></span>${message}`
                : message;
        }
    }

    /**
     * Phân tích văn bản OCR từ Mặt trước hoặc Mặt sau CCCD
     */
    parseOCRText(text, side) {
        const result = {};
        const cleanText = text.replace(/\r/g, '\n');

        // 1. Tìm số CCCD 12 chữ số (bắt đầu bằng 0)
        const cccdMatch = cleanText.match(/\b(0\d{11})\b/);
        if (cccdMatch) {
            result.cccd = cccdMatch[1];
        }

        // 2. Tìm các ngày tháng DD/MM/YYYY
        const dateMatches = [...cleanText.matchAll(/\b(\d{2})[\/\-](\d{2})[\/\-](19\d{2}|20\d{2})\b/g)];
        if (dateMatches.length > 0) {
            if (side === 'back') {
                // Mặt sau CCCD: ngày tháng xuất hiện thường là Ngày cấp
                const d = dateMatches[0];
                result.issueDate = `${d[3]}-${d[2]}-${d[1]}`;
                result.noiCap = 'Cục Cảnh sát quản lý hành chính về trật tự xã hội';
            } else {
                // Mặt trước CCCD: ngày đầu tiên là Ngày sinh
                const d = dateMatches[0];
                result.dob = `${d[3]}-${d[2]}-${d[1]}`;
            }
        }

        // 3. Tìm Giới tính trên mặt trước
        if (/Giới tính|Sex/i.test(cleanText)) {
            if (/\bNữ\b/i.test(cleanText)) result.gender = 'Nữ';
            else if (/\bNam\b/i.test(cleanText)) result.gender = 'Nam';
        }

        // 4. Tìm Họ và tên từ dòng chữ IN HOA sau "Họ và tên / Full name" hoặc từ dòng MRZ mặt sau (<<)
        const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
            if (/Họ và tên|Full name/i.test(lines[i]) && lines[i + 1]) {
                const candidate = lines[i + 1].replace(/[^A-ZÀ-Ỹ\s]/gi, '').trim();
                if (candidate.split(/\s+/).length >= 2) {
                    this.assignSplitName(result, candidate.toUpperCase());
                    break;
                }
            }
        }

        // 5. Nếu mặt sau có dòng MRZ (VD: IDVNM... ho<<ten<<<)
        const mrzLine = lines.find(l => /^[A-Z]+<<[A-Z<]+$/.test(l.replace(/\s+/g, '')));
        if (mrzLine && !result.fullName) {
            const cleanMrz = mrzLine.replace(/\s+/g, '');
            const parts = cleanMrz.split('<<');
            if (parts.length >= 2) {
                const lastName = parts[0].replace(/</g, ' ').trim();
                const givenNames = parts[1].replace(/</g, ' ').trim();
                const combined = `${lastName} ${givenNames}`.trim();
                if (combined.length > 4) {
                    this.assignSplitName(result, combined);
                }
            }
        }

        return result;
    }

    assignSplitName(targetObj, fullNameStr) {
        const nameWords = fullNameStr.trim().toUpperCase().split(/\s+/);
        targetObj.fullName = nameWords.join(' ');
        if (nameWords.length === 1) {
            targetObj.firstName = nameWords[0];
        } else if (nameWords.length === 2) {
            targetObj.lastName = nameWords[0];
            targetObj.firstName = nameWords[1];
        } else if (nameWords.length >= 3) {
            targetObj.lastName = nameWords[0];
            targetObj.firstName = nameWords[nameWords.length - 1];
            targetObj.middleName = nameWords.slice(1, nameWords.length - 1).join(' ');
        }
    }

    /**
     * Phân tách chuỗi QR chuẩn của CCCD gắn chip Việt Nam:
     * Định dạng: Số_CCCD|Số_CMND_Cũ|Họ_và_Tên|Ngày_Sinh(DDMMYYYY)|Giới_tính|Địa_chỉ|Ngày_cấp(DDMMYYYY)
     */
    parseCCCDQR(rawText) {
        const parts = rawText.split('|');
        if (parts.length < 6) return null;

        const [cccd, oldCmnd, fullName, dobRaw, gender, address, issueDateRaw] = parts;
        const formatQRDate = (d) => {
            if (!d || d.length !== 8) return '';
            return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
        };

        const result = {
            cccd: (cccd || '').trim(),
            oldCmnd: (oldCmnd || '').trim(),
            dob: formatQRDate(dobRaw),
            gender: (gender || '').trim() === 'Nữ' ? 'Nữ' : 'Nam',
            address: (address || '').trim(),
            issueDate: formatQRDate(issueDateRaw),
            noiCap: 'Cục Cảnh sát quản lý hành chính về trật tự xã hội'
        };

        this.assignSplitName(result, (fullName || '').trim());
        return result;
    }

    /**
     * Tự động điền thông tin đã trích xuất vào các ô trong Form & đánh dấu hiệu ứng highlight
     */
    fillFormFromExtractedData(data, sourceLabel = 'Scan CCCD') {
        this.extractedData = { ...this.extractedData, ...data };

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val) {
                el.value = val;
                el.classList.add('ring-2', 'ring-green-500', 'bg-green-50/40');
                setTimeout(() => {
                    el.classList.remove('ring-2', 'ring-green-500', 'bg-green-50/40');
                }, 2600);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        if (data.lastName) setVal('ho', data.lastName);
        if (data.middleName !== undefined && data.lastName) setVal('tenDem', data.middleName);
        if (data.firstName) setVal('ten', data.firstName);
        if (data.dob) setVal('ngaySinh', data.dob);
        if (data.gender) {
            setVal('gioiTinh', data.gender);
            setVal('danhXung', data.gender === 'Nữ' ? 'Chị' : 'Anh');
        }
        if (data.cccd) {
            setVal('loaiGiayTo', 'Căn cước Công dân');
            setVal('soGiayTo', data.cccd);
        }
        if (data.noiCap) setVal('noiCap', data.noiCap);
        if (data.issueDate) setVal('ngayCap', data.issueDate);

        if (data.oldCmnd) {
            const toggleOld = document.getElementById('toggleOldId');
            const oldSection = document.getElementById('oldIdSection');
            if (toggleOld && oldSection) {
                toggleOld.checked = true;
                oldSection.classList.remove('hidden');
            }
            setVal('loaiGiayToCu', 'Chứng minh Nhân dân (cũ)');
            setVal('soGiayToCu', data.oldCmnd);
        }

        // Phân tách địa chỉ thường trú trên CCCD điền vào Thành phố/Tỉnh, Phường/Xã, Số nhà/Tên đường & Nơi sinh
        if (data.address) {
            const addrParts = data.address.split(',').map(s => s.trim()).filter(Boolean);
            if (addrParts.length >= 2) {
                const provinceCandidate = addrParts[addrParts.length - 1];
                const cleanCandidate = provinceCandidate.toLowerCase().replace(/^(tỉnh|thành phố|tp\.?)\s*/i, '').trim();
                const matchedProv = GENRE_DATA.provinces.find(p =>
                    p.toLowerCase().includes(cleanCandidate) || cleanCandidate.includes(p.toLowerCase().replace(/^tp\.\s*/, ''))
                );
                if (matchedProv) {
                    setVal('thanhPhoTinh', matchedProv);
                    const noiSinhEl = document.getElementById('noiSinh');
                    if (noiSinhEl && !noiSinhEl.value) {
                        setVal('noiSinh', matchedProv);
                    }
                }

                if (addrParts.length >= 4) {
                    setVal('phuongXa', `${addrParts[addrParts.length - 3]}, ${addrParts[addrParts.length - 2]}`);
                    setVal('soNhaTenDuong', addrParts.slice(0, addrParts.length - 3).join(', '));
                } else if (addrParts.length === 3) {
                    setVal('phuongXa', addrParts[1]);
                    setVal('soNhaTenDuong', addrParts[0]);
                } else {
                    setVal('phuongXa', addrParts[0]);
                    setVal('soNhaTenDuong', data.address);
                }
            }
        }

        showToast(`Đã tự động điền thông tin từ ${sourceLabel}!`, 'success');
    }

    /**
     * Vẽ ảnh xem trước với góc xoay và bộ lọc "Bản Scan Rõ Nét"
     */
    renderPreview() {
        const srcW = this.rawCanvas.width;
        const srcH = this.rawCanvas.height;

        const isRotated90 = this.rotation % 180 !== 0;
        this.previewCanvas.width = isRotated90 ? srcH : srcW;
        this.previewCanvas.height = isRotated90 ? srcW : srcH;

        const ctx = this.previewCanvas.getContext('2d');
        ctx.save();
        ctx.translate(this.previewCanvas.width / 2, this.previewCanvas.height / 2);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.drawImage(this.rawCanvas, -srcW / 2, -srcH / 2);
        ctx.restore();

        if (this.isEnhancedScan) {
            this.applyDocumentScanFilter(ctx, this.previewCanvas.width, this.previewCanvas.height);
        }

        this.processedDataUrl = this.previewCanvas.toDataURL('image/jpeg', 0.86);
    }

    applyDocumentScanFilter(ctx, width, height) {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const contrast = 32;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const brightnessOffset = 10;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128 + brightnessOffset));
            data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128 + brightnessOffset));
            data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128 + brightnessOffset));
        }
        ctx.putImageData(imgData, 0, 0);
    }

    rotateImage() {
        this.rotation = (this.rotation + 90) % 360;
        this.renderPreview();
    }

    toggleEnhanceScan() {
        this.isEnhancedScan = !this.isEnhancedScan;
        const btn = document.getElementById('btnToggleEnhance');
        if (btn) {
            if (this.isEnhancedScan) {
                btn.classList.remove('bg-gray-800', 'text-gray-200');
                btn.classList.add('bg-red-600', 'text-white');
            } else {
                btn.classList.remove('bg-red-600', 'text-white');
                btn.classList.add('bg-gray-800', 'text-gray-200');
            }
        }
        this.renderPreview();
    }

    async retakePhoto() {
        this.showLiveView();
        await this.startVideoStream();
    }

    /**
     * Khi bấm "Lưu & Đính Kèm Ảnh Này":
     * 1) Đưa ảnh vào phần "2. Chứng từ đính kèm" (Mặt trước hoặc Mặt sau)
     * 2) Nếu vừa chụp xong Mặt trước và chưa có Mặt sau -> Tự động chuyển Camera sang chụp tiếp Mặt sau!
     */
    async confirmImage() {
        if (!this.processedDataUrl) return;
        const side = this.currentSide === 'back' ? 'back' : 'front';
        this.images[side] = this.processedDataUrl;

        // Cập nhật giao diện phần "2. Chứng từ đính kèm" và thanh trạng thái trên nút Scan
        this.updateAttachmentUI(side, this.processedDataUrl);

        if (side === 'front' && this.autoFlowBothSides && !this.images.back) {
            showToast('Đã lưu Mặt trước! Hãy lật mặt sau CCCD để chụp tiếp...', 'info');
            this.currentSide = 'back';
            this.isEnhancedScan = false;
            this.rotation = 0;
            this.updateModalHeaderUI();
            this.showLiveView();
            await this.startVideoStream();
            return;
        }

        this.closeModal();
        showToast(
            this.images.front && this.images.back
                ? '✓ Đã trích xuất thông tin & đính kèm đủ 2 mặt CCCD!'
                : `✓ Đã lưu & đính kèm CCCD ${side === 'front' ? 'Mặt trước' : 'Mặt sau'}!`,
            'success'
        );
    }

    /**
     * Đồng bộ hình ảnh vào cả 2 nơi:
     * - Khung thumbnail ngay dưới nút "Scan CCCD" ở đầu trang
     * - Khung "2. Chứng từ đính kèm (CMND/CCCD Mặt trước & Mặt sau)" ở cuối Form
     */
    updateAttachmentUI(side, dataUrl) {
        // 1. Cập nhật khung "2. Chứng từ đính kèm"
        const previewImg = document.getElementById(side === 'front' ? 'imgPreviewFront' : 'imgPreviewBack');
        const emptyState = document.getElementById(side === 'front' ? 'emptyStateFront' : 'emptyStateBack');
        const badgeStatus = document.getElementById(side === 'front' ? 'badgeStatusFront' : 'badgeStatusBack');
        const removeBtn = document.getElementById(side === 'front' ? 'btnRemoveFront' : 'btnRemoveBack');
        const cardContainer = document.getElementById(side === 'front' ? 'cccdCardFront' : 'cccdCardBack');

        if (previewImg && emptyState) {
            previewImg.src = dataUrl;
            previewImg.classList.remove('hidden');
            emptyState.classList.add('hidden');
        }
        if (badgeStatus) {
            badgeStatus.textContent = '✓ Đã tải lên';
            badgeStatus.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700';
        }
        if (removeBtn) {
            removeBtn.classList.remove('hidden');
        }
        if (cardContainer) {
            cardContainer.classList.remove('border-red-500');
            cardContainer.classList.add('border-green-500', 'bg-green-50/20');
        }

        // 2. Cập nhật chip trạng thái đính kèm ngay trên thanh công cụ Scan CCCD đầu trang
        const topBadge = document.getElementById(side === 'front' ? 'topScanBadgeFront' : 'topScanBadgeBack');
        const topThumb = document.getElementById(side === 'front' ? 'topScanThumbFront' : 'topScanThumbBack');
        if (topBadge) {
            topBadge.textContent = side === 'front' ? '✓ Mặt trước: Đã có' : '✓ Mặt sau: Đã có';
            topBadge.className = 'truncate text-emerald-300 font-bold';
        }
        if (topThumb) {
            topThumb.src = dataUrl;
            topThumb.classList.remove('hidden');
        }
    }

    removeImage(side) {
        this.images[side] = null;
        const previewImg = document.getElementById(side === 'front' ? 'imgPreviewFront' : 'imgPreviewBack');
        const emptyState = document.getElementById(side === 'front' ? 'emptyStateFront' : 'emptyStateBack');
        const badgeStatus = document.getElementById(side === 'front' ? 'badgeStatusFront' : 'badgeStatusBack');
        const removeBtn = document.getElementById(side === 'front' ? 'btnRemoveFront' : 'btnRemoveBack');
        const cardContainer = document.getElementById(side === 'front' ? 'cccdCardFront' : 'cccdCardBack');

        if (previewImg && emptyState) {
            previewImg.src = '';
            previewImg.classList.add('hidden');
            emptyState.classList.remove('hidden');
        }
        if (badgeStatus) {
            badgeStatus.textContent = 'Chưa có';
            badgeStatus.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700';
        }
        if (removeBtn) {
            removeBtn.classList.add('hidden');
        }
        if (cardContainer) {
            cardContainer.classList.remove('border-green-500', 'bg-green-50/20');
        }

        const topBadge = document.getElementById(side === 'front' ? 'topScanBadgeFront' : 'topScanBadgeBack');
        const topThumb = document.getElementById(side === 'front' ? 'topScanThumbFront' : 'topScanThumbBack');
        if (topBadge) {
            topBadge.textContent = side === 'front' ? 'Mặt trước: Chưa có' : 'Mặt sau: Chưa có';
            topBadge.className = 'truncate';
        }
        if (topThumb) {
            topThumb.src = '';
            topThumb.classList.add('hidden');
        }
    }

    closeModal() {
        this.stopVideoStream();
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
        if (this.qrStatusBanner) {
            this.qrStatusBanner.classList.add('hidden');
        }
        if (this.extractLoadingBanner) {
            this.extractLoadingBanner.classList.add('hidden');
        }
        document.body.style.overflow = '';
    }
}

window.cccdScanner = new CCCDScanner();
