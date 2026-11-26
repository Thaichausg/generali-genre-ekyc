/**
 * Bộ xử lý Camera Scan & Tải Hình CCCD 2 Mặt (Kết nối trực tiếp với VNCCCDRecognizer)
 * Đảm bảo nhận dạng & trích xuất Tiếng Việt chuẩn xác trên CẢ 2 luồng:
 *   1) CHỤP CAMERA TRỰC TIẾP: Quét QR thời gian thực + Cắt ảnh độ phân giải cao (Full-Res) chạy OCR Tiếng Việt / MRZ
 *   2) UP HÌNH TỪ MÁY (Zalo/Album): Quét trên ảnh gốc độ phân giải cao trước khi nén đính kèm,
 *      tự động xoay ảnh bị chụp dọc 90°/270°, tự động phân biệt Mặt Trước / Mặt Sau và không ghi đè mất dấu Tiếng Việt!
 */

class CCCDScanner {
    constructor() {
        this.currentSide = 'front'; // 'front' | 'back'
        this.autoFlowBothSides = true;
        this.stream = null;
        this.facingMode = 'environment';
        this.rawCanvas = document.createElement('canvas');
        this.fullResCaptureCanvas = document.createElement('canvas');
        this.processedDataUrl = null;
        this.isEnhancedScan = false;
        this.rotation = 0;
        this.qrScanInterval = null;
        this.isLiveScanningFrame = false;
        this.isExtracting = false;

        // Ảnh Base64 của 2 mặt CCCD đính kèm vào Form
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
     * Mở Camera Chụp Scan CCCD Trực Tiếp
     */
    async openCamera(side = 'front', autoNextSide = true) {
        this.currentSide = side;
        this.autoFlowBothSides = autoNextSide;
        this.isEnhancedScan = false;
        this.rotation = 0;

        if (!this.modal) this.init();

        // Khởi động ngầm bộ nhận diện Tiếng Việt (Tesseract LSTM 'vie') ngay khi mở Camera
        if (window.vnCCCDRecognizer) {
            window.vnCCCDRecognizer.getVietnameseOCRWorker().catch(() => {});
        }

        this.updateModalHeaderUI();
        this.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        this.showLiveView();
        await this.startVideoStream();
    }

    updateModalHeaderUI() {
        if (!this.titleEl) return;
        if (this.currentSide === 'front') {
            this.titleEl.textContent = 'Scan CCCD - Mặt Trước';
            this.subtitleEl.textContent = 'Tự động nhận dạng Tiếng Việt, quét QR & đính kèm ảnh';
            if (this.sideStepPill) {
                this.sideStepPill.textContent = 'MẶT TRƯỚC (1/2)';
                this.sideStepPill.className = 'text-[11px] font-bold px-3 py-1 rounded-full bg-[#C21B17] text-white shadow';
            }
        } else {
            this.titleEl.textContent = 'Scan CCCD - Mặt Sau';
            this.subtitleEl.textContent = 'Trích xuất Ngày cấp, Nơi cấp, mã MRZ & đính kèm ảnh';
            if (this.sideStepPill) {
                this.sideStepPill.textContent = 'MẶT SAU (2/2)';
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
            // Yêu cầu độ phân giải 2K/FullHD nét nhất trên điện thoại để đọc rõ dấu Tiếng Việt & QR nhỏ
            const constraints = {
                audio: false,
                video: {
                    facingMode: { ideal: this.facingMode },
                    width: { ideal: 2560 },
                    height: { ideal: 1440 }
                }
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            await this.video.play();

            // Quét QR liên tục trên cả Mặt trước (CCCD 2021) và Mặt sau (Thẻ Căn cước 2024)
            this.startAutoQrDetection();
        } catch (err) {
            console.warn('Không thể mở Camera trực tiếp trên trình duyệt:', err);
            this.closeModal();
            const fallbackInput = document.getElementById(
                this.currentSide === 'front' ? 'cameraInputFront' : 'cameraInputBack'
            );
            if (fallbackInput) {
                showToast('Đang mở máy ảnh hệ thống để chụp & trích xuất Tiếng Việt...', 'info');
                fallbackInput.click();
            }
        }
    }

    stopVideoStream() {
        if (this.qrScanInterval) {
            clearInterval(this.qrScanInterval);
            this.qrScanInterval = null;
        }
        this.isLiveScanningFrame = false;
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
     * Quét QR tự động thời gian thực ngay khi soi Camera (sử dụng bộ giải mã Đa Lõi VNCCCDRecognizer)
     */
    startAutoQrDetection() {
        if (!window.vnCCCDRecognizer) return;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

        this.qrScanInterval = setInterval(async () => {
            if (this.isLiveScanningFrame) return;
            if (!this.video || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) return;
            const vw = this.video.videoWidth;
            const vh = this.video.videoHeight;
            if (!vw || !vh) return;

            this.isLiveScanningFrame = true;
            try {
                tempCanvas.width = vw;
                tempCanvas.height = vh;
                tempCtx.drawImage(this.video, 0, 0, vw, vh);

                const qrRaw = await window.vnCCCDRecognizer.decodeQRMultiEngine(tempCanvas);
                if (qrRaw && qrRaw.includes('|')) {
                    const parsed = window.vnCCCDRecognizer.parseVietnameseQR(qrRaw);
                    if (parsed) {
                        window.vnCCCDRecognizer.enrichWithBCACodeRules(parsed);
                        this.fillFormFromExtractedData(parsed, 'Mã QR CCCD', true);
                        if (this.qrStatusBanner) {
                            this.qrStatusBanner.classList.remove('hidden');
                            this.qrStatusBanner.textContent = `✓ Đã đọc Tiếng Việt: ${parsed.fullName} (${parsed.cccd}) — Bấm nút đỏ để chụp lưu ảnh!`;
                        }
                    }
                }
            } catch (e) {
                // Bỏ qua lỗi frame đơn lẻ
            } finally {
                this.isLiveScanningFrame = false;
            }
        }, 550);
    }

    /**
     * Chụp hình từ Video:
     * - Giữ bản cắt độ phân giải gốc (tới 2200px) để nhận dạng chữ Tiếng Việt & QR cực nét
     * - Tạo bản đính kèm chuẩn (1400px) nhẹ mượt để gửi về Google Sheet
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

        const padX = frameRect.width * 0.045;
        const padY = frameRect.height * 0.045;

        const sx = Math.max(0, (relX - padX) * scaleX);
        const sy = Math.max(0, (relY - padY) * scaleY);
        const sw = Math.min(vw - sx, (frameRect.width + padX * 2) * scaleX);
        const sh = Math.min(vh - sy, (frameRect.height + padY * 2) * scaleY);

        // 1. Canvas Full-Res phục vụ nhận dạng Tiếng Việt & QR (tối đa 2200px)
        const ocrW = Math.min(2200, Math.max(1, Math.round(sw)));
        const ocrH = Math.max(1, Math.round(ocrW * (sh / sw)));
        this.fullResCaptureCanvas.width = ocrW;
        this.fullResCaptureCanvas.height = ocrH;
        this.fullResCaptureCanvas.getContext('2d').drawImage(this.video, sx, sy, sw, sh, 0, 0, ocrW, ocrH);

        // 2. Canvas chuẩn hóa (1400px) phục vụ hiển thị & đính kèm Google Drive
        const attachW = Math.min(1400, ocrW);
        const attachH = Math.max(1, Math.round(attachW * (sh / sw)));
        this.rawCanvas.width = attachW;
        this.rawCanvas.height = attachH;
        this.rawCanvas.getContext('2d').drawImage(this.video, sx, sy, sw, sh, 0, 0, attachW, attachH);

        this.rotation = 0;
        this.isEnhancedScan = false;
        this.renderPreview();
        this.showPreviewView();

        // Chạy thuật toán nhận dạng & trích xuất Tiếng Việt trên bản Full-Res vừa chụp
        await this.runRecognitionOnCanvas(this.fullResCaptureCanvas, this.currentSide);
    }

    /**
     * Xử lý khi người dùng Tải Hình Lên (1 hoặc 2 hình cùng lúc từ Album / Zalo / Máy ảnh hệ thống)
     */
    async handleBatchFilesUpload(fileList, defaultSide = 'front') {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList).filter(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|heic)$/i.test(f.name));
        if (files.length === 0) {
            showToast('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WEBP)', 'error');
            return;
        }

        // Khởi động sẵn Worker OCR Tiếng Việt
        if (window.vnCCCDRecognizer) {
            window.vnCCCDRecognizer.getVietnameseOCRWorker().catch(() => {});
        }

        if (files.length >= 2) {
            showToast('Đang nhận dạng Tiếng Việt & tự động phân loại 2 mặt CCCD...', 'info');
            // Khi tải 2 hình cùng lúc, bật autoDetectSlot = true để nếu khách chọn Mặt Sau trước cũng tự xếp đúng ô!
            await this.processUploadedFileSmart(files[0], 'front', true);
            await this.processUploadedFileSmart(files[1], 'back', true);
            return;
        }

        // Khi tải 1 hình lẻ
        await this.processUploadedFileSmart(files[0], defaultSide, false);
    }

    /**
     * Đọc file ảnh tải lên ở ĐỘ PHÂN GIẢI GỐC (tới 2800px) TRƯỚC KHI thu nhỏ đính kèm,
     * giúp đọc QR nhỏ và chữ Tiếng Việt có dấu đạt độ chính xác cao nhất!
     */
    processUploadedFileSmart(file, preferredSide, autoAssignSlot = false) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = async () => {
                    // 1. Giữ độ phân giải cao (tối đa 2800px) cho thuật toán nhận dạng Tiếng Việt & QR
                    const maxOcrDim = 2800;
                    let ow = img.width;
                    let oh = img.height;
                    if (ow > maxOcrDim || oh > maxOcrDim) {
                        if (ow > oh) {
                            oh = Math.round((oh * maxOcrDim) / ow);
                            ow = maxOcrDim;
                        } else {
                            ow = Math.round((ow * maxOcrDim) / oh);
                            oh = maxOcrDim;
                        }
                    }

                    const hiResCanvas = document.createElement('canvas');
                    hiResCanvas.width = ow;
                    hiResCanvas.height = oh;
                    hiResCanvas.getContext('2d').drawImage(img, 0, 0, ow, oh);

                    // 2. Tạo ảnh đính kèm ban đầu ngay lập tức để giao diện phản hồi tức thì
                    let targetSlot = preferredSide;
                    const initialAttachDataUrl = this.createAttachmentDataUrl(hiResCanvas, 1400);
                    this.images[targetSlot] = initialAttachDataUrl;
                    this.updateAttachmentUI(targetSlot, initialAttachDataUrl);

                    // 3. Chạy thuật toán Nhận dạng & Trích xuất Tiếng Việt 5 tầng
                    const recResult = await this.runRecognitionOnCanvas(hiResCanvas, preferredSide);

                    if (recResult) {
                        // Nếu thuật toán phát hiện ảnh bị chụp dọc và đã tự xoay ngang lại cho ngay ngắn:
                        const finalSourceCanvas = recResult.autoRotatedCanvas || hiResCanvas;
                        const finalDataUrl = recResult.autoRotatedCanvas
                            ? this.createAttachmentDataUrl(finalSourceCanvas, 1400)
                            : initialAttachDataUrl;

                        // Nếu người dùng up 2 ảnh qua nút chung "Up Hình CCCD" mà ảnh đầu thực chất là Mặt Sau:
                        if (autoAssignSlot && recResult.detectedSide && recResult.detectedSide !== targetSlot) {
                            const otherSlot = recResult.detectedSide;
                            if (!this.images[otherSlot]) {
                                this.removeImage(targetSlot);
                                targetSlot = otherSlot;
                            }
                        }

                        this.images[targetSlot] = finalDataUrl;
                        this.updateAttachmentUI(targetSlot, finalDataUrl);
                    }

                    resolve();
                };
                img.onerror = () => {
                    showToast('Không thể đọc tệp hình ảnh này. Vui lòng chọn ảnh JPG hoặc PNG.', 'error');
                    resolve();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    createAttachmentDataUrl(sourceCanvas, maxDim = 1400) {
        let w = sourceCanvas.width;
        let h = sourceCanvas.height;
        if (w > maxDim || h > maxDim) {
            if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
            } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
            }
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(sourceCanvas, 0, 0, w, h);
        return c.toDataURL('image/jpeg', 0.86);
    }

    /**
     * Thực thi bộ nhận dạng VNCCCDRecognizer và điền kết quả vào Form
     */
    async runRecognitionOnCanvas(canvas, expectedSide) {
        if (!window.vnCCCDRecognizer) return null;

        this.setExtractStatusUI(true, 'Đang nhận dạng & trích xuất Tiếng Việt trên CCCD...');
        try {
            const rec = await window.vnCCCDRecognizer.recognizeCCCDCanvas(
                canvas,
                expectedSide,
                (progressMsg) => this.setExtractStatusUI(true, progressMsg)
            );

            if (rec && rec.success && rec.data) {
                const isTrustedAccents = rec.source === 'Mã QR CCCD' || !rec.data._hasMRZ;
                this.fillFormFromExtractedData(rec.data, rec.source, isTrustedAccents);

                const summaryParts = [];
                if (rec.data.fullName) summaryParts.push(rec.data.fullName);
                if (rec.data.cccd) summaryParts.push(`CCCD: ${rec.data.cccd}`);
                if (rec.data.issueDate && expectedSide === 'back') summaryParts.push(`Cấp: ${rec.data.issueDate.split('-').reverse().join('/')}`);

                const summaryStr = summaryParts.length > 0
                    ? `✓ Đã trích xuất (${rec.source}): ${summaryParts.join(' • ')}`
                    : `✓ Đã trích xuất thông tin từ ${rec.source}!`;

                this.setExtractStatusUI(false, summaryStr);
                return rec;
            }

            this.setExtractStatusUI(
                false,
                expectedSide === 'front'
                    ? 'Đã đính kèm Mặt trước. Hãy giữ ảnh rõ chữ hoặc góc mã QR để trích xuất tự động tốt nhất.'
                    : '✓ Đã đính kèm ảnh Mặt sau CCCD vào hồ sơ!'
            );
            return rec;
        } catch (err) {
            console.warn('Lỗi nhận dạng CCCD Tiếng Việt:', err);
            this.setExtractStatusUI(false, '✓ Đã lưu ảnh CCCD vào mục Chứng từ đính kèm.');
            return null;
        }
    }

    setExtractStatusUI(isLoading, message) {
        this.isExtracting = isLoading;
        if (this.extractLoadingBanner) {
            this.extractLoadingBanner.classList.remove('hidden');
            this.extractLoadingBanner.innerHTML = isLoading
                ? `<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5 align-middle"></span>${message}`
                : message;
        }

        const mainBanner = document.getElementById('scanExtractResultBanner');
        const mainBannerText = document.getElementById('scanExtractResultText');
        if (mainBanner && mainBannerText && message) {
            mainBanner.classList.remove('hidden');
            mainBannerText.innerHTML = isLoading
                ? `<span class="inline-block w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin mr-1.5 align-middle"></span>${message}`
                : message;
        }
    }

    /**
     * Điền thông tin Tiếng Việt đã trích xuất vào Form với cơ chế GỘP THÔNG MINH (Smart Merge):
     * - KHÔNG bao giờ để tên không dấu từ dòng MRZ Mặt sau ghi đè làm mất dấu Tiếng Việt đã đọc được từ Mặt trước!
     * - Tự động nâng cấp tên không dấu thành tên Tiếng Việt có dấu khi quét thêm Mặt trước / QR!
     */
    fillFormFromExtractedData(data, sourceLabel = 'Scan CCCD', hasTrustedAccents = true) {
        if (!data) return;

        const countVietnameseDiacritics = (str) => {
            const matches = (str || '').match(/[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/gi);
            return matches ? matches.length : 0;
        };
        const isQRSource = sourceLabel === 'Mã QR CCCD';

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null && String(val).trim() !== '') {
                el.value = val;
                const cell = el.closest('.native-cell');
                if (cell) {
                    cell.style.backgroundColor = '#ECFDF5';
                    setTimeout(() => { cell.style.backgroundColor = ''; }, 2200);
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        // 1. Gộp thông minh Họ, Tên đệm, Tên (Bảo vệ dấu Tiếng Việt!)
        const currentHo = document.getElementById('ho')?.value || '';
        const currentTenDem = document.getElementById('tenDem')?.value || '';
        const currentTen = document.getElementById('ten')?.value || '';
        const existingFull = `${currentHo} ${currentTenDem} ${currentTen}`.trim();
        const incomingFull = `${data.lastName || ''} ${data.middleName || ''} ${data.firstName || ''}`.trim();

        const shouldUpdateName = incomingFull && (
            !existingFull ||
            isQRSource ||
            countVietnameseDiacritics(incomingFull) > countVietnameseDiacritics(existingFull)
        );

        if (shouldUpdateName) {
            if (data.lastName) setVal('ho', data.lastName);
            if (data.lastName && data.middleName !== undefined) {
                const tenDemEl = document.getElementById('tenDem');
                if (tenDemEl) {
                    tenDemEl.value = data.middleName;
                    tenDemEl.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            if (data.firstName) setVal('ten', data.firstName);
        }

        // 2. Ngày sinh, Giới tính, Danh xưng, Nơi sinh
        if (data.dob) setVal('ngaySinh', data.dob);
        if (data.gender) {
            setVal('gioiTinh', data.gender);
            setVal('danhXung', data.gender === 'Nữ' ? 'Chị' : 'Anh');
        }
        if (data.noiSinh) {
            const noiSinhEl = document.getElementById('noiSinh');
            if (noiSinhEl && (!noiSinhEl.value || sourceLabel === 'Mã QR CCCD')) {
                setVal('noiSinh', data.noiSinh);
            }
        }

        // 3. Số CCCD, Ngày cấp, Nơi cấp
        if (data.cccd) {
            setVal('loaiGiayTo', 'Căn cước Công dân');
            setVal('soGiayTo', data.cccd);
        }
        if (data.noiCap) setVal('noiCap', data.noiCap);
        if (data.issueDate) setVal('ngayCap', data.issueDate);

        // 4. Số CMND 9 số cũ (nếu trích xuất được từ mã QR)
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

        // 5. Địa chỉ liên lạc theo dữ liệu hành chính mới đã sáp nhập (34 Tỉnh/Thành + Phường/Xã mới)
        if (data.thanhPhoTinh) {
            setVal('thanhPhoTinh', data.thanhPhoTinh);
            if (typeof window.populateWardsForProvince === 'function') {
                window.populateWardsForProvince(data.thanhPhoTinh, data.phuongXa || '');
            }
            const noiSinhEl = document.getElementById('noiSinh');
            if (noiSinhEl && !noiSinhEl.value) {
                setVal('noiSinh', data.thanhPhoTinh);
            }
        } else if (data.phuongXa && typeof window.trySelectMergedWard === 'function') {
            window.trySelectMergedWard(data.phuongXa);
        }
        if (data.soNhaTenDuong) {
            const curSN = document.getElementById('soNhaTenDuong')?.value || '';
            if (!curSN || isQRSource || countVietnameseDiacritics(data.soNhaTenDuong) >= countVietnameseDiacritics(curSN)) {
                setVal('soNhaTenDuong', data.soNhaTenDuong);
            }
        }

        this.extractedData = { ...this.extractedData, ...data };
        showToast(`✓ Đã tự động điền thông tin Tiếng Việt (${sourceLabel})`, 'success');
    }

    /**
     * Vẽ ảnh xem trước với góc xoay và chế độ "Bản Scan Rõ Nét"
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

    /**
     * Khi người dùng bấm Xoay ảnh 90° trong màn hình xem trước Camera,
     * tự động chạy lại nhận dạng Tiếng Việt trên góc xoay mới!
     */
    async rotateImage() {
        this.rotation = (this.rotation + 90) % 360;
        this.renderPreview();

        if (window.vnCCCDRecognizer && this.fullResCaptureCanvas.width > 0) {
            const rotatedFull = window.vnCCCDRecognizer.rotateCanvas(this.fullResCaptureCanvas, this.rotation);
            await this.runRecognitionOnCanvas(rotatedFull, this.currentSide);
        }
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

    async confirmImage() {
        if (!this.processedDataUrl) return;
        const side = this.currentSide === 'back' ? 'back' : 'front';
        this.images[side] = this.processedDataUrl;
        this.updateAttachmentUI(side, this.processedDataUrl);

        if (side === 'front' && this.autoFlowBothSides && !this.images.back) {
            showToast('Đã lưu Mặt trước! Hãy lật Mặt sau CCCD để chụp tiếp...', 'info');
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
                ? '✓ Đã trích xuất Tiếng Việt & đính kèm đủ 2 mặt CCCD!'
                : `✓ Đã lưu & đính kèm CCCD ${side === 'front' ? 'Mặt trước' : 'Mặt sau'}!`,
            'success'
        );
    }

    updateAttachmentUI(side, dataUrl) {
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
            badgeStatus.textContent = '✓ Đã có';
            badgeStatus.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
        }
        if (removeBtn) {
            removeBtn.classList.remove('hidden');
        }
        if (cardContainer) {
            cardContainer.classList.remove('border-red-500');
            cardContainer.classList.add('border-green-500');
        }

        const topBadge = document.getElementById(side === 'front' ? 'topScanBadgeFront' : 'topScanBadgeBack');
        const topThumb = document.getElementById(side === 'front' ? 'topScanThumbFront' : 'topScanThumbBack');
        if (topBadge) {
            topBadge.textContent = side === 'front' ? '✓ Mặt trước: Đã có' : '✓ Mặt sau: Đã có';
            topBadge.className = 'truncate text-emerald-700 font-bold';
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
            cardContainer.classList.remove('border-green-500');
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
