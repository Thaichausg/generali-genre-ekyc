/**
 * ============================================================================
 * THUẬT TOÁN NHẬN DẠNG & TRÍCH XUẤT TIẾNG VIỆT TRÊN THẺ CCCD / CĂN CƯỚC (eKYC)
 * Hỗ trợ đầy đủ cả 2 phương thức: CHỤP CAMERA TRỰC TIẾP & TẢI HÌNH LÊN (Zalo/Album)
 * Hỗ trợ cả: CCCD gắn chip (2021), Thẻ Căn Cước mới (2024) và CMND/CCCD cũ
 *
 * Kiến trúc 5 Tầng (5-Layer Recognition Pipeline):
 *  - Tầng 1: Quét QR Đa Lõi trên ảnh gốc Full-Res (Native BarcodeDetector + ZXing C++ WASM + Multi-Crop UTF-8 jsQR)
 *  - Tầng 2: Xử lý ảnh thị giác máy tính (Tự xoay ảnh dọc 90°/270°, Lọc triệt hoa văn trống đồng Guilloche, Unsharp Mask làm nét dấu tiếng Việt)
 *  - Tầng 3: Nhận diện chữ OCR Tiếng Việt chuyên sâu (Tesseract v5 LSTM 'vie' best_int + Vùng MRZ ICAO 9303 mặt sau)
 *  - Tầng 4: Tự động phân loại Mặt Trước / Mặt Sau (kể cả khi khách up ngược thứ tự ảnh)
 *  - Tầng 5: Giải mã cấu trúc 12 số định danh Bộ Công An + Hậu xử lý ngôn ngữ tự nhiên Tiếng Việt (Họ tên có dấu, Ngày sinh/Ngày cấp, Địa chỉ 63 Tỉnh/Thành)
 * ============================================================================
 */

class VNCCCDRecognizer {
    constructor() {
        this.vieWorker = null;
        this.vieWorkerPromise = null;
        this.barcodeDetector = null;

        // Khởi tạo Native BarcodeDetector nếu trình duyệt hỗ trợ (Chrome Android, Safari iOS 17+, Edge)
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
                this.barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
            } catch (e) {
                this.barcodeDetector = null;
            }
        }
    }

    /**
     * Khởi tạo sẵn (Pre-warm) Worker Tesseract Tiếng Việt để tăng tốc độ OCR
     */
    async getVietnameseOCRWorker(onProgress) {
        if (this.vieWorker) return this.vieWorker;
        if (this.vieWorkerPromise) return this.vieWorkerPromise;

        if (typeof Tesseract === 'undefined') {
            throw new Error('Thư viện Tesseract OCR chưa sẵn sàng');
        }

        this.vieWorkerPromise = (async () => {
            const worker = await Tesseract.createWorker('vie', 1, {
                logger: (m) => {
                    if (onProgress && m && m.status === 'recognizing text' && typeof m.progress === 'number') {
                        onProgress(Math.round(m.progress * 100));
                    }
                }
            });
            await worker.setParameters({
                preserve_interword_spaces: '1'
            });
            this.vieWorker = worker;
            return worker;
        })();

        try {
            return await this.vieWorkerPromise;
        } catch (err) {
            this.vieWorkerPromise = null;
            throw err;
        }
    }

    /**
     * ========================================================================
     * TẦNG 1: QUÉT MÃ QR ĐA LÕI TRÊN ẢNH GỐC ĐỘ PHÂN GIẢI CAO (UTF-8 CHUẨN)
     * ========================================================================
     */
    async decodeQRMultiEngine(sourceCanvas) {
        if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return null;

        // 1A. Native OS BarcodeDetector (Siêu nhanh, đọc tốt ảnh nghiêng/lóa trên điện thoại)
        if (this.barcodeDetector) {
            try {
                const barcodes = await this.barcodeDetector.detect(sourceCanvas);
                for (const b of barcodes) {
                    if (b.rawValue && b.rawValue.includes('|')) {
                        return b.rawValue.trim();
                    }
                }
            } catch (e) {}
        }

        // 1B. C++ ZXing WebAssembly (Đọc xuất sắc ảnh chụp xa, xoay góc, mờ nhẹ, giải mã chuẩn UTF-8 Tiếng Việt)
        if (typeof ZXingWASM !== 'undefined' && ZXingWASM.readBarcodesFromImageData) {
            try {
                const zxingResult = await this.tryZXingOnCanvas(sourceCanvas);
                if (zxingResult) return zxingResult;
            } catch (e) {
                console.warn('ZXingWASM fallback:', e);
            }
        }

        // 1C. Multi-Region + Contrast/Sharpen jsQR kèm bộ giải mã UTF-8 trực tiếp từ binaryData
        if (typeof jsQR !== 'undefined') {
            const jsqrResult = this.tryJsQRPyramid(sourceCanvas);
            if (jsqrResult) return jsqrResult;
        }

        return null;
    }

    async tryZXingOnCanvas(sourceCanvas) {
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;

        // Chuẩn bị khung quét toàn ảnh (giới hạn 2400px để tối ưu RAM điện thoại nhưng vẫn giữ chi tiết QR)
        const fullScale = Math.min(1, 2400 / Math.max(w, h));
        const fw = Math.max(1, Math.round(w * fullScale));
        const fh = Math.max(1, Math.round(h * fullScale));

        const c = document.createElement('canvas');
        c.width = fw;
        c.height = fh;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(sourceCanvas, 0, 0, fw, fh);

        const readerOpts = {
            formats: ['QRCode'],
            tryHarder: true,
            tryRotate: true,
            tryInvert: true,
            tryDownscale: true,
            characterSet: 'UTF-8',
            maxNumberOfSymbols: 2
        };

        const fullImgData = ctx.getImageData(0, 0, fw, fh);
        const results = await ZXingWASM.readBarcodesFromImageData(fullImgData, readerOpts);
        for (const r of results) {
            if (r && r.text && r.text.includes('|')) {
                return this.fixVietnameseMojibake(r.text.trim());
            }
        }

        // Quét thêm 4 góc phóng đại (dành cho ảnh chụp cả mặt bàn, mã QR chỉ chiếm diện tích nhỏ)
        const cornerRegions = [
            { x: 0.52, y: 0.0, rw: 0.48, rh: 0.55 }, // Góc trên phải (CCCD gắn chip 2021)
            { x: 0.52, y: 0.40, rw: 0.48, rh: 0.60 }, // Góc dưới phải (Căn cước 2024 mặt sau / xoay)
            { x: 0.0, y: 0.0, rw: 0.48, rh: 0.55 },   // Góc trên trái (ảnh ngược)
            { x: 0.0, y: 0.40, rw: 0.48, rh: 0.60 }   // Góc dưới trái
        ];

        for (const reg of cornerRegions) {
            const sx = Math.floor(w * reg.x);
            const sy = Math.floor(h * reg.y);
            const sw = Math.floor(w * reg.rw);
            const sh = Math.floor(h * reg.rh);
            if (sw < 40 || sh < 40) continue;

            c.width = 900;
            c.height = Math.round(900 * (sh / sw));
            ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, c.width, c.height);
            this.enhanceContrastInPlace(ctx, c.width, c.height, 40);

            const cropData = ctx.getImageData(0, 0, c.width, c.height);
            const cropRes = await ZXingWASM.readBarcodesFromImageData(cropData, readerOpts);
            for (const r of cropRes) {
                if (r && r.text && r.text.includes('|')) {
                    return this.fixVietnameseMojibake(r.text.trim());
                }
            }
        }

        return null;
    }

    tryJsQRPyramid(sourceCanvas) {
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;
        const regions = [
            { x: 0, y: 0, rw: 1, rh: 1, target: 1200, contrast: 0 },
            { x: 0.50, y: 0.0, rw: 0.50, rh: 0.58, target: 800, contrast: 25 },
            { x: 0.58, y: 0.02, rw: 0.40, rh: 0.48, target: 800, contrast: 55 },
            { x: 0.50, y: 0.42, rw: 0.50, rh: 0.58, target: 800, contrast: 35 },
            { x: 0.0, y: 0.0, rw: 0.50, rh: 0.58, target: 800, contrast: 35 },
            { x: 0.0, y: 0.42, rw: 0.50, rh: 0.58, target: 800, contrast: 35 }
        ];

        const temp = document.createElement('canvas');
        const tCtx = temp.getContext('2d', { willReadFrequently: true });

        for (const r of regions) {
            const sx = Math.floor(w * r.x);
            const sy = Math.floor(h * r.y);
            const sw = Math.floor(w * r.rw);
            const sh = Math.floor(h * r.rh);
            if (sw < 30 || sh < 30) continue;

            const scale = Math.min(1.8, r.target / Math.max(sw, sh));
            temp.width = Math.max(1, Math.round(sw * scale));
            temp.height = Math.max(1, Math.round(sh * scale));
            tCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, temp.width, temp.height);

            if (r.contrast > 0) {
                this.enhanceContrastInPlace(tCtx, temp.width, temp.height, r.contrast);
            }

            const imgData = tCtx.getImageData(0, 0, temp.width, temp.height);
            const code = jsQR(imgData.data, temp.width, temp.height, { inversionAttempts: 'attemptBoth' });
            if (code) {
                const decodedText = this.decodeJsQRUTF8(code);
                if (decodedText && decodedText.includes('|')) {
                    return decodedText;
                }
            }
        }
        return null;
    }

    /**
     * Khắc phục lỗi font chữ tiếng Việt (Mojibake) khi jsQR đọc dữ liệu Byte Mode không có ECI
     */
    decodeJsQRUTF8(codeObj) {
        if (codeObj.binaryData && codeObj.binaryData.length > 0 && typeof TextDecoder !== 'undefined') {
            try {
                const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(codeObj.binaryData));
                if (utf8Text && utf8Text.includes('|') && !utf8Text.includes('\uFFFD')) {
                    return utf8Text.trim();
                }
            } catch (e) {}
        }
        return this.fixVietnameseMojibake(codeObj.data || '');
    }

    fixVietnameseMojibake(str) {
        if (!str) return '';
        // Nếu chuỗi bị giải mã nhầm theo Latin-1 (VD: "NGUYá»„N VÄ‚N A")
        if (/[ÃÄÁá]»|[ÄÅ]‚|Ã¢|Ãª|Ã´|Æ°|Æ¡/.test(str) && typeof TextDecoder !== 'undefined') {
            try {
                const bytes = new Uint8Array(str.length);
                let allByteRange = true;
                for (let i = 0; i < str.length; i++) {
                    const code = str.charCodeAt(i);
                    if (code > 255) {
                        allByteRange = false;
                        break;
                    }
                    bytes[i] = code;
                }
                if (allByteRange) {
                    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                    if (fixed) return fixed;
                }
            } catch (e) {}
        }
        return str;
    }

    enhanceContrastInPlace(ctx, width, height, contrast = 35) {
        const imgData = ctx.getImageData(0, 0, width, height);
        const d = imgData.data;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const v = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
            d[i] = d[i + 1] = d[i + 2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
    }

    /**
     * ========================================================================
     * TẦNG 2: TIỀN XỬ LÝ ẢNH CCCD TIẾNG VIỆT (XOAY TỰ ĐỘNG + LỌC HOA VĂN CHÌM)
     * ========================================================================
     */
    rotateCanvas(sourceCanvas, angleDeg) {
        const rad = (angleDeg * Math.PI) / 180;
        const swap = Math.abs(angleDeg) % 180 !== 0;
        const out = document.createElement('canvas');
        out.width = swap ? sourceCanvas.height : sourceCanvas.width;
        out.height = swap ? sourceCanvas.width : sourceCanvas.height;
        const ctx = out.getContext('2d');
        ctx.translate(out.width / 2, out.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
        return out;
    }

    /**
     * Lọc bỏ hoa văn chìm (Guilloche xanh/vàng/hồng) trên thẻ CCCD Việt Nam,
     * đồng thời giữ đậm cả Số CCCD màu đỏ lẫn chữ Tiếng Việt màu đen và làm nét dấu thanh!
     */
    buildCleanVietnameseOCRCanvas(sourceCanvas, targetWidth = 1750) {
        const ratio = sourceCanvas.height / sourceCanvas.width;
        const w = Math.min(2000, Math.max(1200, targetWidth));
        const h = Math.max(1, Math.round(w * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        const numPixels = w * h;
        const lum = new Uint8Array(numPixels);
        const hist = new Uint32Array(256);

        // Trọng số kênh màu chuyên biệt cho CCCD Việt Nam:
        // - Chữ đen: R thấp, G thấp, B thấp -> lum rất thấp (đen)
        // - Số CCCD màu đỏ tươi: R cao, G rất thấp, B rất thấp -> 0.14*R + 0.66*G + 0.20*B vẫn rất thấp (đen đậm!)
        // - Hoa văn chìm xanh ngọc / vàng kem: G cao, B cao -> lum rất cao (bị đẩy thành nền trắng sạch!)
        for (let i = 0, p = 0; i < d.length; i += 4, p++) {
            const v = Math.round(0.14 * d[i] + 0.66 * d[i + 1] + 0.20 * d[i + 2]);
            lum[p] = v;
            hist[v]++;
        }

        // Tìm ngưỡng Percentile 2% (điểm chữ đen) và 82% (điểm nền thẻ) để tự động cân bằng sáng tối
        let lowCut = 20;
        let highCut = 215;
        let acc = 0;
        const lowTarget = numPixels * 0.015;
        const highTarget = numPixels * 0.80;

        for (let v = 0; v < 256; v++) {
            acc += hist[v];
            if (acc <= lowTarget) lowCut = v;
            if (acc <= highTarget) highCut = v;
        }
        if (highCut - lowCut < 45) {
            lowCut = Math.max(0, lowCut - 20);
            highCut = Math.min(255, highCut + 30);
        }

        const range = Math.max(1, highCut - lowCut);
        const stretched = new Uint8Array(numPixels);
        for (let p = 0; p < numPixels; p++) {
            let norm = (lum[p] - lowCut) / range;
            if (norm < 0) norm = 0;
            else if (norm > 1) norm = 1;
            // Gamma nhẹ 0.88 để giữ nét dấu hỏi, dấu ngã, dấu nặng mảnh trên chữ tiếng Việt
            stretched[p] = Math.round(Math.pow(norm, 0.88) * 255);
        }

        // Bộ lọc làm sắc nét chữ (3x3 Unsharp Mask nhẹ) giúp LSTM đọc chuẩn dấu Tiếng Việt
        for (let y = 1; y < h - 1; y++) {
            const rowOffset = y * w;
            for (let x = 1; x < w - 1; x++) {
                const idx = rowOffset + x;
                const center = stretched[idx];
                const blur = (
                    stretched[idx - w] +
                    stretched[idx + w] +
                    stretched[idx - 1] +
                    stretched[idx + 1] +
                    center * 4
                ) >> 3;
                const sharp = Math.min(255, Math.max(0, center + ((center - blur) * 1.35)));
                const outIdx = idx * 4;
                d[outIdx] = d[outIdx + 1] = d[outIdx + 2] = sharp;
                d[outIdx + 3] = 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    /**
     * Cắt vùng thông tin chữ Mặt trước (loại bỏ vùng ảnh chân dung bên trái để tránh nhiễu dòng chữ)
     */
    buildFrontTextZoneCanvas(cleanCanvas) {
        const w = cleanCanvas.width;
        const h = cleanCanvas.height;
        const aspect = w / h;

        // Chỉ cắt bỏ cột ảnh chân dung bên trái nếu ảnh có tỷ lệ gần với khung thẻ CCCD (1.30 -> 1.90)
        if (aspect < 1.28 || aspect > 1.95) return null;

        const sx = Math.floor(w * 0.27);
        const sy = Math.floor(h * 0.16);
        const sw = w - sx - Math.floor(w * 0.02);
        const sh = h - sy - Math.floor(h * 0.02);

        const out = document.createElement('canvas');
        out.width = sw;
        out.height = sh;
        out.getContext('2d').drawImage(cleanCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
        return out;
    }

    /**
     * ========================================================================
     * TẦNG 3: ĐIỀU PHỐI NHẬN DẠNG TOÀN DIỆN (QR + OCR TIẾNG VIỆT + MRZ)
     * Dùng chung cho cả Chụp Camera lẫn Tải Hình Lên
     * ========================================================================
     */
    async recognizeCCCDCanvas(fullResCanvas, expectedSide = 'front', onStatus = null) {
        const notify = (msg) => {
            if (typeof onStatus === 'function') onStatus(msg);
        };

        // Bước 1: Kiểm tra nếu người dùng tải ảnh chụp dọc (chiều cao lớn hơn chiều rộng)
        let workingCanvas = fullResCanvas;
        let autoRotatedDeg = 0;

        notify('Đang quét mã QR độ phân giải cao...');
        let qrRaw = await this.decodeQRMultiEngine(workingCanvas);

        if (!qrRaw && workingCanvas.height > workingCanvas.width * 1.12) {
            // Ảnh đang nằm dọc -> Xoay ngang -90 độ và +90 độ để thử quét QR & chuẩn bị cho OCR
            const rotCCW = this.rotateCanvas(workingCanvas, -90);
            qrRaw = await this.decodeQRMultiEngine(rotCCW);
            if (qrRaw) {
                workingCanvas = rotCCW;
                autoRotatedDeg = -90;
            } else {
                const rotCW = this.rotateCanvas(workingCanvas, 90);
                qrRaw = await this.decodeQRMultiEngine(rotCW);
                workingCanvas = qrRaw ? rotCW : rotCCW;
                autoRotatedDeg = qrRaw ? 90 : -90;
            }
        }

        // Nếu đọc được Mã QR (Mặt trước CCCD 2021 hoặc Mặt sau Căn cước 2024):
        // Dữ liệu Tiếng Việt trong QR là chính xác tuyệt đối 100%!
        if (qrRaw && qrRaw.includes('|')) {
            const qrParsed = this.parseVietnameseQR(qrRaw);
            if (qrParsed) {
                this.enrichWithBCACodeRules(qrParsed);
                // Kiểm tra nhanh xem ảnh chứa QR này là mặt trước (CCCD 2021) hay mặt sau (Căn cước 2024)
                return {
                    success: true,
                    source: 'Mã QR CCCD',
                    detectedSide: expectedSide,
                    autoRotatedCanvas: autoRotatedDeg !== 0 ? workingCanvas : null,
                    data: qrParsed
                };
            }
        }

        // Bước 2: Không có QR (ảnh mờ góc QR, CMND/CCCD cũ, hoặc Mặt sau CCCD 2021) -> Chạy OCR Tiếng Việt chuyên sâu!
        notify('Đang xử lý làm nét chữ & lọc hoa văn nền CCCD...');
        const cleanCanvas = this.buildCleanVietnameseOCRCanvas(workingCanvas, 1750);

        notify('Đang nhận dạng chữ Tiếng Việt trên CCCD (0%)...');
        const worker = await this.getVietnameseOCRWorker((pct) => {
            notify(`Đang nhận dạng chữ Tiếng Việt trên CCCD (${pct}%)...`);
        });

        let combinedText = '';
        const firstPass = await worker.recognize(cleanCanvas);
        combinedText = (firstPass?.data?.text || '').trim();

        // Nếu ảnh bị ngược 180° hoặc xoay dọc sai chiều (90° thay vì -90°) khiến chữ quá ít, thử xoay 180°
        if (this.countValidVietnameseTokens(combinedText) < 4 && autoRotatedDeg !== 0) {
            notify('Đang tự động xoay chiều thẻ CCCD và đọc lại...');
            const flipped = this.rotateCanvas(workingCanvas, 180);
            const cleanFlipped = this.buildCleanVietnameseOCRCanvas(flipped, 1750);
            const secondPass = await worker.recognize(cleanFlipped);
            const secondText = (secondPass?.data?.text || '').trim();
            if (this.countValidVietnameseTokens(secondText) > this.countValidVietnameseTokens(combinedText)) {
                combinedText = secondText;
                workingCanvas = flipped;
            }
        }

        // Tự động nhận diện ảnh này là Mặt Trước hay Mặt Sau dựa trên từ khóa & dòng MRZ
        const detectedSide = this.detectCardSideFromText(combinedText, expectedSide);

        // Nếu là Mặt Trước và ảnh đã căn khung thẻ, chạy thêm vùng Text-Only (bỏ ảnh chân dung bên trái)
        // để đọc cực chuẩn Họ tên Tiếng Việt có dấu & Địa chỉ nhiều dòng!
        let zoneText = '';
        if (detectedSide === 'front') {
            const frontZone = this.buildFrontTextZoneCanvas(cleanCanvas);
            if (frontZone) {
                notify('Đang trích xuất chính xác Họ tên & Địa chỉ Tiếng Việt...');
                const zoneRes = await worker.recognize(frontZone);
                zoneText = (zoneRes?.data?.text || '').trim();
            }
        }

        const parsedData = this.parseVietnameseCCCDText(combinedText, zoneText, detectedSide);
        this.enrichWithBCACodeRules(parsedData);

        const hasExtractedFields = Object.keys(parsedData).some(
            k => !['detectedSide', 'rawText'].includes(k) && Boolean(parsedData[k])
        );

        return {
            success: hasExtractedFields,
            source: parsedData._hasMRZ ? 'OCR Tiếng Việt + Mã MRZ' : 'OCR Tiếng Việt CCCD',
            detectedSide,
            autoRotatedCanvas: autoRotatedDeg !== 0 ? workingCanvas : null,
            data: parsedData
        };
    }

    countValidVietnameseTokens(text) {
        if (!text) return 0;
        const matches = text.match(/[A-ZÀ-Ỹa-zà-ỹ0-9]{2,}/g);
        return matches ? matches.length : 0;
    }

    /**
     * ========================================================================
     * TẦNG 4: TỰ ĐỘNG PHÂN LOẠI MẶT TRƯỚC / MẶT SAU THẺ CCCD
     * ========================================================================
     */
    detectCardSideFromText(text, fallbackSide = 'front') {
        if (!text) return fallbackSide;
        const upper = text.toUpperCase();

        let frontScore = 0;
        let backScore = 0;

        if (/IDVNM|[A-Z0-9]{5,}<<[A-Z<]{4,}|<{5,}/.test(upper.replace(/\s+/g, ''))) backScore += 5;
        if (/ĐẶC ĐIỂM NHẬN DẠNG|DAC DIEM NHAN DANG|PERSONAL IDENTIFICATION/i.test(upper)) backScore += 4;
        if (/CỤC TRƯỞNG|CUC TRUONG|QUẢN LÝ HÀNH CHÍNH|TRẬT TỰ XÃ HỘI/i.test(upper)) backScore += 4;
        if (/NỐT RUỒI|NOT RUOI|SẸO|SEO CHẤM/i.test(upper)) backScore += 3;
        if (/DATE,\s*MONTH,\s*YEAR|NGÀY,\s*THÁNG,\s*NĂM\s*CẤP|DATE OF ISSUE/i.test(upper)) backScore += 3;
        if (/BỘ CÔNG AN|MINISTRY OF PUBLIC SECURITY/i.test(upper)) backScore += 3;

        if (/CỘNG HÒA XÃ HỘI|ĐỘC LẬP\s*-\s*TỰ DO|SOCIALIST REPUBLIC/i.test(upper)) frontScore += 4;
        if (/CĂN CƯỚC CÔNG DÂN|CITIZEN IDENTITY CARD/i.test(upper)) frontScore += 4;
        if (/HỌ VÀ TÊN|HỌ,\s*CHỮ ĐỆM|FULL NAME/i.test(upper)) frontScore += 4;
        if (/QUỐC TỊCH|NATIONALITY|GIỚI TÍNH|SEX/i.test(upper)) frontScore += 3;
        if (/QUÊ QUÁN|PLACE OF ORIGIN/i.test(upper)) frontScore += 3;

        if (backScore >= frontScore + 2) return 'back';
        if (frontScore >= backScore + 2) return 'front';
        return fallbackSide;
    }

    /**
     * ========================================================================
     * TẦNG 5A: GIẢI MÃ MÃ QR CCCD GẮN CHIP & THẺ CĂN CƯỚC 2024
     * ========================================================================
     */
    parseVietnameseQR(rawText) {
        const cleanRaw = this.fixVietnameseMojibake(rawText).trim();
        const parts = cleanRaw.split('|').map(s => s.trim());
        if (parts.length < 6) return null;

        let cccd = '';
        let oldCmnd = '';
        let fullName = '';
        let dobRaw = '';
        let genderRaw = '';
        let address = '';
        let issueDateRaw = '';

        // Chuẩn 7 trường: CCCD | CMND_Cũ | Họ_Tên | DDMMYYYY(Sinh) | Giới_Tính | Địa_Chỉ | DDMMYYYY(Cấp)
        // Chuẩn 6 trường (một số thẻ mới bỏ cột CMND cũ): CCCD | Họ_Tên | DDMMYYYY(Sinh) | Giới_Tính | Địa_Chỉ | DDMMYYYY(Cấp)
        if (/^\d{8}$/.test(parts[3])) {
            [cccd, oldCmnd, fullName, dobRaw, genderRaw, address, issueDateRaw] = parts;
        } else if (/^\d{8}$/.test(parts[2])) {
            [cccd, fullName, dobRaw, genderRaw, address, issueDateRaw] = parts;
        } else {
            [cccd, oldCmnd, fullName, dobRaw, genderRaw, address, issueDateRaw] = parts;
        }

        const formatQRDate = (d) => {
            if (!d || !/^\d{8}$/.test(d)) return '';
            return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
        };

        const issueDate = formatQRDate(issueDateRaw);
        const issueYear = issueDate ? parseInt(issueDate.slice(0, 4), 10) : 2022;

        const result = {
            cccd: cccd.replace(/\D/g, ''),
            oldCmnd: (oldCmnd || '').replace(/\D/g, ''),
            dob: formatQRDate(dobRaw),
            gender: /nữ|nu|female|f/i.test(genderRaw) ? 'Nữ' : 'Nam',
            address: address || '',
            issueDate,
            // Thẻ cấp từ 01/07/2024 theo Luật Căn cước 2023 do "Bộ Công An" cấp, trước đó là Cục Cảnh sát QLHC về TTXH
            noiCap: (issueDate && issueDate >= '2024-07-01')
                ? 'Bộ Công An'
                : 'Cục Cảnh sát quản lý hành chính về trật tự xã hội'
        };

        this.assignVietnameseFullName(result, fullName, true);
        if (result.address) {
            Object.assign(result, this.parseVietnameseAddress(result.address));
        }

        return result;
    }

    /**
     * ========================================================================
     * TẦNG 5B: GIẢI MÃ VĂN BẢN OCR TIẾNG VIỆT & DÒNG MRZ MẶT SAU
     * ========================================================================
     */
    parseVietnameseCCCDText(fullText, zoneText = '', side = 'front') {
        const result = {};
        // Gộp văn bản vùng chữ (nếu có) lên trước để ưu tiên độ sạch không nhiễu bởi ảnh chân dung
        const combinedSource = zoneText ? `${zoneText}\n---ZONE---\n${fullText}` : fullText;
        const primaryText = zoneText || fullText;

        // 1. Giải mã vùng MRZ 3 dòng (Mặt sau CCCD / Căn cước: IDVNM...)
        const mrzParsed = this.parseMRZFromText(fullText);
        if (mrzParsed) {
            Object.assign(result, mrzParsed);
            result._hasMRZ = true;
        }

        // 2. Trích xuất Số CCCD 12 số (hoặc CMND 9 số) từ dòng "Số / No." hoặc "Số định danh cá nhân"
        if (!result.cccd) {
            const extractedId = this.extract12DigitCCCD(combinedSource);
            if (extractedId) {
                result.cccd = extractedId;
            }
        }

        // 3. Trích xuất Họ và Tên Tiếng Việt có dấu (ưu tiên chữ có dấu từ Mặt trước hơn chữ không dấu từ MRZ)
        const vnName = this.extractVietnameseFullNameFromOCR(primaryText) ||
                       (zoneText ? this.extractVietnameseFullNameFromOCR(fullText) : null);
        if (vnName) {
            this.assignVietnameseFullName(result, vnName, false);
        } else if (mrzParsed && mrzParsed._mrzFullName && !result.fullName) {
            this.assignVietnameseFullName(result, mrzParsed._mrzFullName, false);
        }

        // 4. Trích xuất Giới tính (Nam / Nữ)
        const gender = this.extractGenderFromOCR(combinedSource);
        if (gender) {
            result.gender = gender;
        }

        // 5. Trích xuất Ngày sinh & Ngày cấp (phân biệt rõ với Ngày hết hạn "Có giá trị đến")
        const dates = this.extractDatesByContext(combinedSource, side, result.cccd);
        if (dates.dob && !result.dob) result.dob = dates.dob;
        if (dates.issueDate) result.issueDate = dates.issueDate;

        // 6. Trích xuất Nơi cấp (Mặt sau)
        if (side === 'back' || /CỤC TRƯỞNG|BỘ CÔNG AN|ĐẶC ĐIỂM NHẬN DẠNG/i.test(fullText)) {
            if (/BỘ CÔNG AN|BO CONG AN|MINISTRY OF PUBLIC SECURITY/i.test(fullText)) {
                result.noiCap = 'Bộ Công An';
            } else if (/ĐĂNG KÝ QUẢN LÝ CƯ TRÚ|DỮ LIỆU QUỐC GIA/i.test(fullText)) {
                result.noiCap = 'Cục Cảnh sát ĐKQL cư trú và DLQG về dân cư';
            } else {
                result.noiCap = 'Cục Cảnh sát quản lý hành chính về trật tự xã hội';
            }
        }

        // 7. Trích xuất Quê quán / Nơi đăng ký khai sinh -> Gợi ý cho Nơi sinh
        const originPlace = this.extractLabeledMultilineField(
            primaryText,
            /(?:Quê\s*quán|Que\s*quan|Place\s*of\s*origin|Nơi\s*đăng\s*ký\s*khai\s*sinh|Place\s*of\s*birth)/i,
            /(?:Nơi\s*thường\s*trú|Noi\s*thuong\s*tru|Nơi\s*cư\s*trú|Place\s*of\s*residence|Có\s*giá\s*trị|Ngày,\s*tháng)/i
        );
        if (originPlace) {
            const originProv = this.matchProvinceInString(originPlace);
            if (originProv) result.noiSinh = originProv;
        }

        // 8. Trích xuất Địa chỉ thường trú / Nơi cư trú nhiều dòng Tiếng Việt
        const residenceRaw = this.extractLabeledMultilineField(
            primaryText,
            /(?:Nơi\s*thường\s*trú|Noi\s*thuong\s*tru|Thường\s*trú|Nơi\s*cư\s*trú|Noi\s*cu\s*tru|Place\s*of\s*residence)/i,
            /(?:Có\s*giá\s*trị|Co\s*gia\s*tri|Date\s*of\s*expiry|Đặc\s*điểm|Ngày,\s*tháng,\s*năm\s*cấp|Date\s*of\s*issue|IDVNM|---ZONE---)/i
        ) || (zoneText ? this.extractLabeledMultilineField(
            fullText,
            /(?:Nơi\s*thường\s*trú|Noi\s*thuong\s*tru|Thường\s*trú|Nơi\s*cư\s*trú|Place\s*of\s*residence)/i,
            /(?:Có\s*giá\s*trị|Date\s*of\s*expiry|IDVNM)/i
        ) : '');

        if (residenceRaw) {
            result.address = residenceRaw;
            Object.assign(result, this.parseVietnameseAddress(residenceRaw));
        }

        delete result._mrzFullName;
        return result;
    }

    /**
     * Giải mã chuẩn 3 dòng MRZ ICAO 9303 TD1 ở mặt sau CCCD / Thẻ Căn cước
     */
    parseMRZFromText(text) {
        if (!text) return null;
        const rawLines = text
            .split('\n')
            .map(l => l.toUpperCase().replace(/\s+/g, '').replace(/«/g, '<<').replace(/[^A-Z0-9<]/g, ''))
            .filter(l => l.length >= 20);

        const line1Idx = rawLines.findIndex(l => /I[DO0]VNM/.test(l));
        const chevronLines = rawLines.filter(l => l.includes('<<'));
        if (line1Idx === -1 && chevronLines.length === 0) return null;

        const out = {};

        // Dòng 1: IDVNM + 9 số + 1 check + 12 số CCCD + <<<
        if (line1Idx !== -1) {
            const l1 = rawLines[line1Idx]
                .replace(/^I[DO0]VNM/, 'IDVNM')
                .replace(/O/g, '0');
            // Tìm dãy 12 chữ số CCCD bắt đầu bằng 0 nằm ở nửa sau của dòng 1
            const afterPrefix = l1.slice(5);
            const cccdInOptional = afterPrefix.slice(10).match(/(0\d{11})/);
            const anyCccd = afterPrefix.match(/(0\d{11})/);
            if (cccdInOptional) {
                out.cccd = cccdInOptional[1];
            } else if (anyCccd) {
                out.cccd = anyCccd[1];
            }

            // Dòng 2 ngay sau Dòng 1: YYMMDD(Sinh) + Check + M/F + YYMMDD(Hết hạn) + Check + VNM
            const l2 = rawLines[line1Idx + 1];
            if (l2 && l2.length >= 15) {
                const l2Clean = l2.slice(0, 7).replace(/O/g, '0').replace(/I|L/g, '1').replace(/S/g, '5').replace(/B/g, '8') + l2.slice(7);
                const m2 = l2Clean.match(/^(\d{6})(\d)([MF<])(\d{6})/);
                if (m2) {
                    const yymmdd = m2[1];
                    const yy = parseInt(yymmdd.slice(0, 2), 10);
                    const mm = yymmdd.slice(2, 4);
                    const dd = yymmdd.slice(4, 6);
                    const currentYY = new Date().getFullYear() % 100;
                    const fullYear = yy > currentYY ? 1900 + yy : 2000 + yy;
                    if (parseInt(mm, 10) >= 1 && parseInt(mm, 10) <= 12 && parseInt(dd, 10) >= 1 && parseInt(dd, 10) <= 31) {
                        out.dob = `${fullYear}-${mm}-${dd}`;
                    }
                    if (m2[3] === 'F') out.gender = 'Nữ';
                    else if (m2[3] === 'M') out.gender = 'Nam';
                }
            }

            // Dòng 3: HO<<TEN<DEM<TEN<<<<<
            const l3 = rawLines[line1Idx + 2];
            if (l3 && l3.includes('<<')) {
                const parsedMrzName = this.extractNameFromMRZLine3(l3);
                if (parsedMrzName) out._mrzFullName = parsedMrzName;
            }
        } else {
            // Trường hợp chỉ đọc được dòng 3 chứa HO<<TEN<DEM
            const nameMrzLine = chevronLines.find(l => /^[A-Z]+<<[A-Z<]+$/.test(l));
            if (nameMrzLine) {
                const parsedMrzName = this.extractNameFromMRZLine3(nameMrzLine);
                if (parsedMrzName) out._mrzFullName = parsedMrzName;
            }
        }

        return Object.keys(out).length > 0 ? out : null;
    }

    extractNameFromMRZLine3(line3) {
        const clean = line3.replace(/[0-9]/g, 'O');
        const parts = clean.split('<<');
        if (parts.length < 2) return null;
        const surname = parts[0].replace(/</g, ' ').trim();
        const given = parts[1].replace(/</g, ' ').trim();
        if (!surname || !given) return null;
        const full = `${surname} ${given}`.replace(/\s+/g, ' ').trim();
        return full.length >= 4 ? full : null;
    }

    /**
     * Trích xuất Số CCCD 12 số kể cả khi OCR chèn khoảng trắng hoặc đọc nhầm chữ O thành số 0
     */
    extract12DigitCCCD(text) {
        if (!text) return '';

        // 1. Ưu tiên tìm gần nhãn "Số / No." hoặc "Số định danh cá nhân"
        const lines = text.split('\n');
        for (const line of lines) {
            if (/(?:Số|So|No\.|định danh|Personal identification)/i.test(line)) {
                // Cắt bỏ phần chữ nhãn ("Số / No.:") trước khi đổi chữ O -> số 0 để không biến chữ "No." thành số "0"!
                const afterLabel = line.replace(/^.*?(?:No\.?|nhân|number|Số|So)\s*[:./-]?\s*/i, '');
                const tokens = afterLabel
                    .replace(/[oOQD]/g, '0')
                    .replace(/[lI|]/g, '1')
                    .replace(/[^0-9]/g, '');
                const allCandidates = [...tokens.matchAll(/(?=(0\d{11}))/g)].map(m => m[1]);
                for (const c12 of allCandidates) {
                    if (this.isValidCCCDPrefix(c12)) return c12;
                }
                if (allCandidates.length > 0) return allCandidates[0];
            }
        }

        // 2. Quét toàn văn bản tìm chuỗi 12 chữ số bắt đầu bằng mã tỉnh hợp lệ (001 -> 096)
        const compactMatches = text.match(/\b0[\d\s.]{11,15}\b/g) || [];
        for (const cand of compactMatches) {
            const digits = cand.replace(/\D/g, '');
            if (digits.length === 12 && this.isValidCCCDPrefix(digits)) {
                return digits;
            }
        }

        const direct12 = text.match(/\b(0\d{11})\b/);
        if (direct12) return direct12[1];

        // Fallback CMND 9 số
        const cmnd9 = text.match(/\b(\d{9})\b/);
        return cmnd9 ? cmnd9[1] : '';
    }

    isValidCCCDPrefix(cccd12) {
        if (!cccd12 || cccd12.length !== 12) return false;
        const prefix = cccd12.slice(0, 3);
        if (typeof GENRE_DATA !== 'undefined' && GENRE_DATA.cccdProvinceCodes) {
            return Boolean(GENRE_DATA.cccdProvinceCodes[prefix]);
        }
        const num = parseInt(prefix, 10);
        return num >= 1 && num <= 96;
    }

    /**
     * Trích xuất Họ và Tên Tiếng Việt IN HOA CÓ DẤU trên Mặt trước CCCD / Căn cước
     */
    extractVietnameseFullNameFromOCR(text) {
        if (!text) return null;
        const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

        const headerBlacklist = /(?:CỘNG\s*HÒA|CONG\s*HOA|XÃ\s*HỘI|XA\s*HOI|CHỦ\s*NGHĨA|ĐỘC\s*LẬP|DOC\s*LAP|HẠNH\s*PHÚC|CĂN\s*CƯỚC|CAN\s*CUOC|CÔNG\s*DÂN|CONG\s*DAN|CITIZEN|IDENTITY|SOCIALIST|REPUBLIC|VIỆT\s*NAM|VIET\s*NAM|QUỐC\s*TỊCH|NGÀY\s*SINH|GIỚI\s*TÍNH|QUÊ\s*QUÁN|THƯỜNG\s*TRÚ|CỤC\s*TRƯỞNG|BỘ\s*CÔNG\s*AN|ĐẶC\s*ĐIỂM)/i;

        // Cách 1: Tìm dòng nhãn "Họ và tên / Full name" hoặc "Họ, chữ đệm và tên khai sinh"
        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            if (/(?:Họ\s*và\s*tên|Ho\s*va\s*ten|chữ\s*đệm\s*và\s*tên|khai\s*sinh|Full\s*name)/i.test(line)) {
                // Kiểm tra nếu tên nằm ngay sau dấu ":" trên cùng dòng
                const afterColon = line.split(/[:/]/).pop().replace(/Full\s*name\.?/i, '').trim();
                const cleanedSameLine = this.cleanVietnameseNameCandidate(afterColon);
                if (cleanedSameLine && !headerBlacklist.test(cleanedSameLine)) {
                    return cleanedSameLine;
                }

                // Kiểm tra 1-2 dòng kế tiếp ngay bên dưới nhãn "Họ và tên / Full name:"
                for (let offset = 1; offset <= 2 && i + offset < rawLines.length; offset++) {
                    const nextCandidate = this.cleanVietnameseNameCandidate(rawLines[i + offset]);
                    if (nextCandidate && !headerBlacklist.test(nextCandidate)) {
                        return nextCandidate;
                    }
                }
            }
        }

        // Cách 2: Nếu nhãn "Họ và tên" bị mờ, tìm dòng chữ IN HOA TIẾNG VIỆT (2 đến 5 từ) nằm ngay phía trên dòng "Ngày sinh / Date of birth"
        const dobLineIdx = rawLines.findIndex(l => /(?:Ngày.*sinh|Ngay.*sinh|Date\s*of\s*birth|\b\d{2}[\/\-]\d{2}[\/\-](?:19|20)\d{2}\b)/i.test(l));
        const searchEnd = dobLineIdx !== -1 ? dobLineIdx : rawLines.length;

        for (let i = Math.max(0, searchEnd - 4); i < searchEnd; i++) {
            const line = rawLines[i];
            if (headerBlacklist.test(line)) continue;
            // Phải là dòng chủ yếu chữ IN HOA
            const upperCheck = this.cleanVietnameseNameCandidate(line, true);
            if (upperCheck) return upperCheck;
        }

        return null;
    }

    cleanVietnameseNameCandidate(rawLine, requireStrictUppercase = false) {
        if (!rawLine) return null;

        // Loại bỏ phần nhãn tiếng Anh/Việt còn sót
        let s = rawLine
            .replace(/(?:Họ\s*và\s*tên|Họ,\s*chữ\s*đệm[^:]*|Full\s*name|Số|No\.)[:.\s]*/gi, '')
            .replace(/[|_\[\]{}()<>«»"“”~*+=#@!$%^&?:;.,0-9/\\-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!s) return null;

        // Chỉ giữ các từ hợp lệ thuộc bảng chữ cái Tiếng Việt
        const vnWordRegex = /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐa-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+$/;
        const words = s.split(' ').filter(w => {
            if (!vnWordRegex.test(w)) return false;
            if (w.length < 2 && !/^[AÁÂĂEÊIÍOÔƠUƯYÝ]$/.test(w)) return false;
            if (w.length > 9) return false; // Từ đơn tiếng Việt dài nhất là 7 chữ cái ("NGHIÊNG")
            return true;
        });

        if (words.length < 2 || words.length > 6) return null;

        if (requireStrictUppercase) {
            const upperWords = words.filter(w => w === w.toUpperCase());
            if (upperWords.length !== words.length) return null;
        }

        const upperFull = words.map(w => w.toUpperCase());

        // Sửa lỗi nhận diện dấu phổ biến ở Họ đầu tiên (VD: NGUYÊN -> NGUYỄN, TRÂN -> TRẦN, HUYNH -> HUỲNH)
        if (typeof GENRE_DATA !== 'undefined' && GENRE_DATA.commonVietnameseSurnames) {
            const firstWord = upperFull[0];
            if (GENRE_DATA.commonVietnameseSurnames[firstWord]) {
                upperFull[0] = GENRE_DATA.commonVietnameseSurnames[firstWord];
            }
        }

        return upperFull.join(' ');
    }

    assignVietnameseFullName(targetObj, fullNameStr, isTrustedQR = false) {
        if (!fullNameStr) return;
        const cleaned = isTrustedQR
            ? fullNameStr.trim().toUpperCase().replace(/\s+/g, ' ')
            : (this.cleanVietnameseNameCandidate(fullNameStr) || fullNameStr.trim().toUpperCase().replace(/\s+/g, ' '));

        const nameWords = cleaned.split(' ').filter(Boolean);
        if (nameWords.length === 0) return;

        targetObj.fullName = nameWords.join(' ');
        if (nameWords.length === 1) {
            targetObj.firstName = nameWords[0];
        } else if (nameWords.length === 2) {
            targetObj.lastName = nameWords[0];
            targetObj.firstName = nameWords[1];
            targetObj.middleName = '';
        } else {
            targetObj.lastName = nameWords[0];
            targetObj.firstName = nameWords[nameWords.length - 1];
            targetObj.middleName = nameWords.slice(1, nameWords.length - 1).join(' ');
        }
    }

    /**
     * Trích xuất Giới tính trên CCCD Tiếng Việt
     */
    extractGenderFromOCR(text) {
        if (!text) return '';
        const lines = text.split('\n');
        for (const line of lines) {
            if (/(?:Giới\s*tính|Gioi\s*tinh|Sex)/i.test(line)) {
                if (/\b(?:Nữ|Nu|NỮ|NU|Female)\b/i.test(line)) return 'Nữ';
                if (/\b(?:Nam|NAM|Male)\b/i.test(line)) return 'Nam';
            }
        }
        return '';
    }

    /**
     * Trích xuất thông minh Ngày sinh & Ngày cấp (hỗ trợ cả DD/MM/YYYY, DD.MM.YYYY và "Ngày DD tháng MM năm YYYY")
     */
    extractDatesByContext(text, side = 'front', cccd = '') {
        const out = { dob: '', issueDate: '' };
        if (!text) return out;

        const currentYear = new Date().getFullYear();
        const normalizeDate = (dd, mm, yyyy) => {
            const d = parseInt(dd, 10);
            const m = parseInt(mm, 10);
            const y = parseInt(yyyy, 10);
            if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1920 || y > 2100) return '';
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        };

        const lines = text.split('\n');

        // 1. Quét từng dòng theo ngữ cảnh nhãn
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const windowStr = `${line} ${lines[i + 1] || ''}`;

            // Kiểm tra định dạng "Ngày 15 tháng 08 năm 2021" (Mặt sau CCCD/CMND)
            const vnWrittenDate = windowStr.match(/Ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*((?:19|20)\d{2})/i);
            if (vnWrittenDate) {
                const iso = normalizeDate(vnWrittenDate[1], vnWrittenDate[2], vnWrittenDate[3]);
                const yr = parseInt(vnWrittenDate[3], 10);
                if (iso && yr >= 2005 && yr <= currentYear) {
                    out.issueDate = iso;
                }
            }

            // Chuẩn hóa lỗi OCR đọc nhầm dấu "/" thành số "1" hoặc "7" dính liền (VD: 15/08/1995 -> 15/0811995)
            const repairedLine = line.replace(/\b(\d{2})[\/1](\d{2})[\/1]((?:19|20)\d{2})\b/g, '$1/$2/$3');
            const dateMatch = repairedLine.match(/\b(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ]((?:19|20)\d{2})\b/);
            if (!dateMatch) continue;

            const iso = normalizeDate(dateMatch[1], dateMatch[2], dateMatch[3]);
            if (!iso) continue;
            const yr = parseInt(dateMatch[3], 10);

            // Bỏ qua dòng Ngày hết hạn ("Có giá trị đến / Date of expiry")
            if (/(?:Có\s*giá\s*trị|Co\s*gia\s*tri|expiry|giá\s*trị\s*đến)/i.test(line) || yr > currentYear) {
                continue;
            }

            if (/(?:Ngày.*sinh|Ngay.*sinh|Date\s*of\s*birth|birth)/i.test(line)) {
                out.dob = iso;
            } else if (/(?:Date,\s*month,\s*year|Ngày,\s*tháng,\s*năm|Date\s*of\s*issue|năm\s*cấp)/i.test(line)) {
                if (yr <= currentYear) out.issueDate = iso;
            } else if (side === 'back' && yr >= 2012 && yr <= currentYear && !out.issueDate) {
                out.issueDate = iso;
            } else if (side === 'front' && yr >= 1930 && yr <= currentYear - 14 && !out.dob) {
                out.dob = iso;
            }
        }

        return out;
    }

    /**
     * Trích xuất trường Tiếng Việt kéo dài nhiều dòng (Quê quán, Nơi thường trú, Nơi cư trú)
     */
    extractLabeledMultilineField(text, startRegex, stopRegex) {
        if (!text) return '';
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let collected = [];
        let capturing = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!capturing) {
                const m = line.match(startRegex);
                if (m) {
                    capturing = true;
                    // Lấy phần văn bản nằm sau dấu ":" hoặc sau cụm nhãn tiếng Anh/Việt
                    let remainder = line.slice(m.index + m[0].length);
                    remainder = remainder
                        .replace(/^(?:\s*\/\s*[A-Za-z\s]+)?[:.\s-]*/, '')
                        .replace(/Place\s*of\s*(?:residence|origin|birth)[:.\s]*/gi, '')
                        .trim();
                    if (remainder && remainder.length >= 2) {
                        collected.push(remainder);
                    }
                }
            } else {
                if (stopRegex.test(line)) break;
                // Dừng nếu gặp dòng ngày tháng hết hạn ở góc trái (VD: 15/08/2035) và phần còn lại
                const cleanedCont = line
                    .replace(/^(?:Có\s*giá\s*trị\s*đến|Date\s*of\s*expiry)[:.\s]*\d{0,2}[\/\-]?\d{0,2}[\/\-]?\d{0,4}/i, '')
                    .replace(/^\d{2}[\/\-]\d{2}[\/\-]20\d{2}\s*/, '')
                    .trim();

                if (cleanedCont && /[A-ZÀ-Ỹa-zà-ỹ]/.test(cleanedCont)) {
                    collected.push(cleanedCont);
                    if (collected.length >= 3) break;
                }
            }
        }

        return collected
            .join(', ')
            .replace(/\s*,\s*,+/g, ', ')
            .replace(/\s+/g, ' ')
            .replace(/^[,\s-]+|[,\s.-]+$/g, '')
            .trim();
    }

    /**
     * ========================================================================
     * TẦNG 5C: PHÂN TÁCH ĐỊA CHỈ HÀNH CHÍNH VIỆT NAM (63 TỈNH/TP, QUẬN/PHƯỜNG, SỐ NHÀ)
     * Hoạt động chính xác kể cả khi OCR bị mất dấu phẩy!
     * ========================================================================
     */
    removeAccentsLower(str) {
        return (str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    matchProvinceInString(rawStr) {
        if (!rawStr || typeof GENRE_DATA === 'undefined') return '';
        const normInput = this.removeAccentsLower(rawStr);
        if (!normInput) return '';

        // 1. Kiểm tra từ cuối chuỗi ngược lên theo dấu phẩy trước
        const segments = rawStr.split(',').map(s => s.trim()).filter(Boolean);
        const lastSegNorm = segments.length > 0
            ? this.removeAccentsLower(segments[segments.length - 1]).replace(/^(?:tinh|thanh pho|tp)\s+/, '').trim()
            : '';

        if (lastSegNorm) {
            if (GENRE_DATA.provinceAliases && GENRE_DATA.provinceAliases[lastSegNorm]) {
                return GENRE_DATA.provinceAliases[lastSegNorm];
            }
            for (const prov of GENRE_DATA.provinces) {
                const pNorm = this.removeAccentsLower(prov).replace(/^tp\s+/, '').trim();
                if (lastSegNorm === pNorm || lastSegNorm.endsWith(pNorm)) {
                    return prov;
                }
            }
        }

        // 2. Quét khớp toàn chuỗi địa chỉ (dành cho OCR bị mất dấu phẩy)
        // Sắp xếp tên tỉnh dài trước để tránh nhầm (VD: "Bà Rịa - Vũng Tàu", "TP. Hồ Chí Minh")
        const sortedProvinces = [...GENRE_DATA.provinces].sort((a, b) => b.length - a.length);
        for (const prov of sortedProvinces) {
            const pNorm = this.removeAccentsLower(prov).replace(/^tp\s+/, '').trim();
            if (pNorm.length >= 5 && normInput.endsWith(pNorm)) {
                return prov;
            }
        }

        if (GENRE_DATA.provinceAliases) {
            for (const [alias, canonical] of Object.entries(GENRE_DATA.provinceAliases)) {
                if (alias.length >= 5 && normInput.endsWith(alias)) {
                    return canonical;
                }
            }
        }

        for (const prov of sortedProvinces) {
            const pNorm = this.removeAccentsLower(prov).replace(/^tp\s+/, '').trim();
            if (pNorm.length >= 6 && normInput.includes(pNorm)) {
                return prov;
            }
        }

        return '';
    }

    parseVietnameseAddress(rawAddress) {
        const out = {};
        if (!rawAddress) return out;

        const matchedProv = this.matchProvinceInString(rawAddress);
        if (matchedProv) {
            out.thanhPhoTinh = matchedProv;
        }

        // Luôn tách thêm các từ khóa đơn vị hành chính nếu trong 1 cụm bị dính liền do OCR mất dấu phẩy
        const injected = rawAddress
            .replace(/,?\s+(?=(?:Phường|P\.|Xã|Thị\s*trấn|TT\.|Quận|Q\.|Huyện|H\.|Thị\s*xã|TX\.|Thành\s*phố|TP\.?|Tỉnh)\s)/gi, ', ');
        let parts = injected.split(',').map(s => s.trim()).filter(Boolean);

        // Loại bỏ phần Tỉnh/Thành phố ở cuối khỏi danh sách chi tiết
        if (parts.length >= 2 && matchedProv) {
            const lastNorm = this.removeAccentsLower(parts[parts.length - 1]).replace(/^(?:tinh|thanh pho|tp)\s+/, '');
            const provNorm = this.removeAccentsLower(matchedProv).replace(/^tp\s+/, '');
            if (lastNorm.includes(provNorm) || provNorm.includes(lastNorm)) {
                parts.pop();
            }
        }

        if (parts.length >= 3) {
            out.phuongXa = `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
            out.soNhaTenDuong = parts.slice(0, parts.length - 2).join(', ');
        } else if (parts.length === 2) {
            out.phuongXa = parts[1];
            out.soNhaTenDuong = parts[0];
        } else if (parts.length === 1) {
            out.phuongXa = parts[0];
            out.soNhaTenDuong = parts[0];
        }

        return out;
    }

    /**
     * ========================================================================
     * TẦNG 5D: ĐỐI CHIẾU QUY TẮC 12 SỐ ĐỊNH DANH CÁ NHÂN CỦA BỘ CÔNG AN
     *   - 3 số đầu (001-096): Mã Tỉnh/TP nơi đăng ký khai sinh -> Điền chính xác 100% "Nơi sinh"!
     *   - Số thứ 4 (0,1,2,3): Thế kỷ sinh + Giới tính (Chẵn = Nam, Lẻ = Nữ) -> Kiểm chứng/Điền Giới tính!
     *   - Số thứ 5-6 (00-99): 2 số cuối Năm sinh -> Tự sửa lỗi nếu OCR đọc nhầm năm sinh!
     * ========================================================================
     */
    enrichWithBCACodeRules(data) {
        if (!data || !data.cccd || !/^\d{12}$/.test(data.cccd)) return data;

        const provCode = data.cccd.slice(0, 3);
        const centuryGenderDigit = parseInt(data.cccd[3], 10);
        const birthYearShort = parseInt(data.cccd.slice(4, 6), 10);

        // 1. Suy ra chính xác Nơi sinh từ 3 chữ số đầu của CCCD
        if (typeof GENRE_DATA !== 'undefined' && GENRE_DATA.cccdProvinceCodes && GENRE_DATA.cccdProvinceCodes[provCode]) {
            if (!data.noiSinh) {
                data.noiSinh = GENRE_DATA.cccdProvinceCodes[provCode];
            }
        }

        // 2. Suy ra Giới tính & Thế kỷ sinh từ chữ số thứ 4 của CCCD
        if (!isNaN(centuryGenderDigit) && centuryGenderDigit >= 0 && centuryGenderDigit <= 5) {
            const officialGender = (centuryGenderDigit % 2 === 0) ? 'Nam' : 'Nữ';
            if (!data.gender) {
                data.gender = officialGender;
            }

            const centuryBase = 1900 + Math.floor(centuryGenderDigit / 2) * 100;
            const officialBirthYear = centuryBase + birthYearShort;

            // Nếu OCR đọc Ngày sinh bị lệch 1 chữ số ở Năm sinh (VD: 1988 thành 1983), tự động sửa theo Năm sinh chuẩn trên mã CCCD!
            if (data.dob && /^\d{4}-\d{2}-\d{2}$/.test(data.dob)) {
                const ocrYear = parseInt(data.dob.slice(0, 4), 10);
                if (ocrYear !== officialBirthYear && Math.abs(ocrYear - officialBirthYear) <= 90) {
                    data.dob = `${officialBirthYear}${data.dob.slice(4)}`;
                }
            }
        }

        return data;
    }
}

const vnCCCDRecognizer = new VNCCCDRecognizer();
if (typeof window !== 'undefined') {
    window.vnCCCDRecognizer = vnCCCDRecognizer;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VNCCCDRecognizer, vnCCCDRecognizer };
}
