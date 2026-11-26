/**
 * Dữ liệu danh mục 34 Tỉnh/Thành phố sau sáp nhập (Nghị quyết 202/2025/QH15),
 * Ánh xạ 63 tỉnh cũ -> 34 tỉnh/thành mới, Mã tỉnh CCCD Bộ Công An & Danh sách Ngân hàng
 */

const GENRE_DATA = {
    // Danh sách 34 Tỉnh / Thành phố chính thức sau sáp nhập
    provinces: [
        "Thành phố Hồ Chí Minh",
        "Thành phố Hà Nội",
        "Thành phố Đà Nẵng",
        "Thành phố Hải Phòng",
        "Thành phố Cần Thơ",
        "Thành phố Huế",
        "Tỉnh An Giang",
        "Tỉnh Bắc Ninh",
        "Tỉnh Cà Mau",
        "Tỉnh Cao Bằng",
        "Tỉnh Đắk Lắk",
        "Tỉnh Điện Biên",
        "Tỉnh Đồng Nai",
        "Tỉnh Đồng Tháp",
        "Tỉnh Gia Lai",
        "Tỉnh Hà Tĩnh",
        "Tỉnh Hưng Yên",
        "Tỉnh Khánh Hòa",
        "Tỉnh Lai Châu",
        "Tỉnh Lâm Đồng",
        "Tỉnh Lạng Sơn",
        "Tỉnh Lào Cai",
        "Tỉnh Nghệ An",
        "Tỉnh Ninh Bình",
        "Tỉnh Phú Thọ",
        "Tỉnh Quảng Ngãi",
        "Tỉnh Quảng Ninh",
        "Tỉnh Quảng Trị",
        "Tỉnh Sơn La",
        "Tỉnh Tây Ninh",
        "Tỉnh Thái Nguyên",
        "Tỉnh Thanh Hóa",
        "Tỉnh Tuyên Quang",
        "Tỉnh Vĩnh Long"
    ],

    // Bảng mã 3 chữ số đầu CCCD (001-096) ánh xạ thẳng sang 34 Tỉnh/Thành phố mới sau sáp nhập
    cccdProvinceCodes: {
        "001": "Thành phố Hà Nội",
        "002": "Tỉnh Tuyên Quang",       // Hà Giang -> Tuyên Quang
        "004": "Tỉnh Cao Bằng",
        "006": "Tỉnh Thái Nguyên",       // Bắc Kạn -> Thái Nguyên
        "008": "Tỉnh Tuyên Quang",
        "010": "Tỉnh Lào Cai",
        "011": "Tỉnh Điện Biên",
        "012": "Tỉnh Lai Châu",
        "014": "Tỉnh Sơn La",
        "015": "Tỉnh Lào Cai",           // Yên Bái -> Lào Cai
        "017": "Tỉnh Phú Thọ",           // Hòa Bình -> Phú Thọ
        "019": "Tỉnh Thái Nguyên",
        "020": "Tỉnh Lạng Sơn",
        "022": "Tỉnh Quảng Ninh",
        "024": "Tỉnh Bắc Ninh",          // Bắc Giang -> Bắc Ninh
        "025": "Tỉnh Phú Thọ",
        "026": "Tỉnh Phú Thọ",           // Vĩnh Phúc -> Phú Thọ
        "027": "Tỉnh Bắc Ninh",
        "030": "Thành phố Hải Phòng",    // Hải Dương -> Hải Phòng
        "031": "Thành phố Hải Phòng",
        "033": "Tỉnh Hưng Yên",
        "034": "Tỉnh Hưng Yên",          // Thái Bình -> Hưng Yên
        "035": "Tỉnh Ninh Bình",         // Hà Nam -> Ninh Bình
        "036": "Tỉnh Ninh Bình",         // Nam Định -> Ninh Bình
        "037": "Tỉnh Ninh Bình",
        "038": "Tỉnh Thanh Hóa",
        "040": "Tỉnh Nghệ An",
        "042": "Tỉnh Hà Tĩnh",
        "044": "Tỉnh Quảng Trị",         // Quảng Bình -> Quảng Trị
        "045": "Tỉnh Quảng Trị",
        "046": "Thành phố Huế",
        "048": "Thành phố Đà Nẵng",
        "049": "Thành phố Đà Nẵng",      // Quảng Nam -> Đà Nẵng
        "051": "Tỉnh Quảng Ngãi",
        "052": "Tỉnh Gia Lai",           // Bình Định -> Gia Lai
        "054": "Tỉnh Đắk Lắk",           // Phú Yên -> Đắk Lắk
        "056": "Tỉnh Khánh Hòa",
        "058": "Tỉnh Khánh Hòa",         // Ninh Thuận -> Khánh Hòa
        "060": "Tỉnh Lâm Đồng",          // Bình Thuận -> Lâm Đồng
        "062": "Tỉnh Quảng Ngãi",        // Kon Tum -> Quảng Ngãi
        "064": "Tỉnh Gia Lai",
        "066": "Tỉnh Đắk Lắk",
        "067": "Tỉnh Lâm Đồng",          // Đắk Nông -> Lâm Đồng
        "068": "Tỉnh Lâm Đồng",
        "070": "Tỉnh Đồng Nai",          // Bình Phước -> Đồng Nai
        "072": "Tỉnh Tây Ninh",
        "074": "Thành phố Hồ Chí Minh",  // Bình Dương -> TP.HCM
        "075": "Tỉnh Đồng Nai",
        "077": "Thành phố Hồ Chí Minh",  // Bà Rịa - Vũng Tàu -> TP.HCM
        "079": "Thành phố Hồ Chí Minh",
        "080": "Tỉnh Tây Ninh",          // Long An -> Tây Ninh
        "082": "Tỉnh Đồng Tháp",         // Tiền Giang -> Đồng Tháp
        "083": "Tỉnh Vĩnh Long",         // Bến Tre -> Vĩnh Long
        "084": "Tỉnh Vĩnh Long",         // Trà Vinh -> Vĩnh Long
        "086": "Tỉnh Vĩnh Long",
        "087": "Tỉnh Đồng Tháp",
        "089": "Tỉnh An Giang",
        "091": "Tỉnh An Giang",          // Kiên Giang -> An Giang
        "092": "Thành phố Cần Thơ",
        "093": "Thành phố Cần Thơ",      // Hậu Giang -> Cần Thơ
        "094": "Thành phố Cần Thơ",      // Sóc Trăng -> Cần Thơ
        "095": "Tỉnh Cà Mau",            // Bạc Liêu -> Cà Mau
        "096": "Tỉnh Cà Mau"
    },

    // Ánh xạ toàn bộ tên 63 tỉnh/thành cũ & viết tắt sang đúng 34 Tỉnh/Thành phố mới sau sáp nhập
    provinceAliases: {
        "hcm": "Thành phố Hồ Chí Minh",
        "tphcm": "Thành phố Hồ Chí Minh",
        "tp ho chi minh": "Thành phố Hồ Chí Minh",
        "ho chi minh": "Thành phố Hồ Chí Minh",
        "sai gon": "Thành phố Hồ Chí Minh",
        "binh duong": "Thành phố Hồ Chí Minh",
        "ba ria vung tau": "Thành phố Hồ Chí Minh",
        "br vt": "Thành phố Hồ Chí Minh",
        "brvt": "Thành phố Hồ Chí Minh",
        "vung tau": "Thành phố Hồ Chí Minh",

        "hn": "Thành phố Hà Nội",
        "ha noi": "Thành phố Hà Nội",
        "ha tay": "Thành phố Hà Nội",

        "hai phong": "Thành phố Hải Phòng",
        "hai duong": "Thành phố Hải Phòng",

        "da nang": "Thành phố Đà Nẵng",
        "quang nam": "Thành phố Đà Nẵng",

        "hue": "Thành phố Huế",
        "tp hue": "Thành phố Huế",
        "thua thien hue": "Thành phố Huế",
        "tt hue": "Thành phố Huế",

        "can tho": "Thành phố Cần Thơ",
        "hau giang": "Thành phố Cần Thơ",
        "soc trang": "Thành phố Cần Thơ",

        "ha giang": "Tỉnh Tuyên Quang",
        "tuyen quang": "Tỉnh Tuyên Quang",

        "lao cai": "Tỉnh Lào Cai",
        "yen bai": "Tỉnh Lào Cai",

        "thai nguyen": "Tỉnh Thái Nguyên",
        "bac kan": "Tỉnh Thái Nguyên",
        "bac can": "Tỉnh Thái Nguyên",

        "phu tho": "Tỉnh Phú Thọ",
        "vinh phuc": "Tỉnh Phú Thọ",
        "hoa binh": "Tỉnh Phú Thọ",

        "bac ninh": "Tỉnh Bắc Ninh",
        "bac giang": "Tỉnh Bắc Ninh",

        "hung yen": "Tỉnh Hưng Yên",
        "thai binh": "Tỉnh Hưng Yên",

        "ninh binh": "Tỉnh Ninh Bình",
        "ha nam": "Tỉnh Ninh Bình",
        "nam dinh": "Tỉnh Ninh Bình",

        "quang tri": "Tỉnh Quảng Trị",
        "quang binh": "Tỉnh Quảng Trị",

        "quang ngai": "Tỉnh Quảng Ngãi",
        "kon tum": "Tỉnh Quảng Ngãi",

        "gia lai": "Tỉnh Gia Lai",
        "binh dinh": "Tỉnh Gia Lai",

        "dak lak": "Tỉnh Đắk Lắk",
        "dac lac": "Tỉnh Đắk Lắk",
        "daklak": "Tỉnh Đắk Lắk",
        "phu yen": "Tỉnh Đắk Lắk",

        "khanh hoa": "Tỉnh Khánh Hòa",
        "ninh thuan": "Tỉnh Khánh Hòa",

        "lam dong": "Tỉnh Lâm Đồng",
        "dak nong": "Tỉnh Lâm Đồng",
        "dac nong": "Tỉnh Lâm Đồng",
        "binh thuan": "Tỉnh Lâm Đồng",

        "dong nai": "Tỉnh Đồng Nai",
        "binh phuoc": "Tỉnh Đồng Nai",

        "tay ninh": "Tỉnh Tây Ninh",
        "long an": "Tỉnh Tây Ninh",

        "dong thap": "Tỉnh Đồng Tháp",
        "tien giang": "Tỉnh Đồng Tháp",

        "vinh long": "Tỉnh Vĩnh Long",
        "ben tre": "Tỉnh Vĩnh Long",
        "tra vinh": "Tỉnh Vĩnh Long",

        "an giang": "Tỉnh An Giang",
        "kien giang": "Tỉnh An Giang",

        "ca mau": "Tỉnh Cà Mau",
        "bac lieu": "Tỉnh Cà Mau",

        "cao bang": "Tỉnh Cao Bằng",
        "dien bien": "Tỉnh Điện Biên",
        "lai chau": "Tỉnh Lai Châu",
        "son la": "Tỉnh Sơn La",
        "lang son": "Tỉnh Lạng Sơn",
        "quang ninh": "Tỉnh Quảng Ninh",
        "thanh hoa": "Tỉnh Thanh Hóa",
        "nghe an": "Tỉnh Nghệ An",
        "ha tinh": "Tỉnh Hà Tĩnh"
    },

    commonVietnameseSurnames: {
        "NGUYEN": "NGUYỄN",
        "NGUYÊN": "NGUYỄN",
        "TRAN": "TRẦN",
        "TRÂN": "TRẦN",
        "PHAM": "PHẠM",
        "HOANG": "HOÀNG",
        "HUYNH": "HUỲNH",
        "VU": "VŨ",
        "DANG": "ĐẶNG",
        "ĐANG": "ĐẶNG",
        "BUI": "BÙI",
        "ĐÔ": "ĐỖ",
        "NGO": "NGÔ",
        "DUONG": "DƯƠNG",
        "ĐINH": "ĐINH",
        "DINH": "ĐINH",
        "TRUONG": "TRƯƠNG",
        "LUONG": "LƯƠNG",
        "DOAN": "ĐOÀN",
        "ĐOAN": "ĐOÀN",
        "TRINH": "TRỊNH",
        "ĐAO": "ĐÀO",
        "PHUNG": "PHÙNG",
        "QUACH": "QUÁCH",
        "DIEP": "DIỆP",
        "VUONG": "VƯƠNG",
        "TRIEU": "TRIỆU"
    },

    issuePlaces: [
        "Cục Cảnh sát quản lý hành chính về trật tự xã hội",
        "Bộ Công An",
        "Cục Cảnh sát ĐKQL cư trú và DLQG về dân cư",
        "Cục Quản lý xuất nhập cảnh"
    ],

    banks: [
        { code: "VCB", citad: "01203001", shortName: "Vietcombank", fullName: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)" },
        { code: "TCB", citad: "01310001", shortName: "Techcombank", fullName: "Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)" },
        { code: "BIDV", citad: "01202001", shortName: "BIDV", fullName: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)" },
        { code: "CTG", citad: "01201001", shortName: "VietinBank", fullName: "Ngân hàng TMCP Công thương Việt Nam (VietinBank)" },
        { code: "MBB", citad: "01311001", shortName: "MBBank", fullName: "Ngân hàng TMCP Quân Đội (MBBank)" },
        { code: "ACB", citad: "01307001", shortName: "ACB", fullName: "Ngân hàng TMCP Á Châu (ACB)" },
        { code: "VPB", citad: "01309001", shortName: "VPBank", fullName: "Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)" },
        { code: "VBA", citad: "01204001", shortName: "Agribank", fullName: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam (Agribank)" },
        { code: "STB", citad: "01303001", shortName: "Sacombank", fullName: "Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)" },
        { code: "TPB", citad: "01358001", shortName: "TPBank", fullName: "Ngân hàng TMCP Tiên Phong (TPBank)" },
        { code: "VIB", citad: "01314001", shortName: "VIB", fullName: "Ngân hàng TMCP Quốc Tế Việt Nam (VIB)" },
        { code: "HDB", citad: "01320001", shortName: "HDBank", fullName: "Ngân hàng TMCP Phát triển TP. Hồ Chí Minh (HDBank)" },
        { code: "SHB", citad: "01348001", shortName: "SHB", fullName: "Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)" },
        { code: "MSB", citad: "01302001", shortName: "MSB", fullName: "Ngân hàng TMCP Hàng Hải Việt Nam (MSB)" },
        { code: "OCB", citad: "01333001", shortName: "OCB", fullName: "Ngân hàng TMCP Phương Đông (OCB)" },
        { code: "EIB", citad: "01305001", shortName: "Eximbank", fullName: "Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam (Eximbank)" },
        { code: "LPB", citad: "01357001", shortName: "LPBank", fullName: "Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)" },
        { code: "SSB", citad: "01317001", shortName: "SeABank", fullName: "Ngân hàng TMCP Đông Nam Á (SeABank)" },
        { code: "NAB", citad: "01306001", shortName: "Nam A Bank", fullName: "Ngân hàng TMCP Nam Á (Nam A Bank)" },
        { code: "ABB", citad: "01323001", shortName: "ABBank", fullName: "Ngân hàng TMCP An Bình (ABBank)" },
        { code: "BAB", citad: "01313001", shortName: "Bac A Bank", fullName: "Ngân hàng TMCP Bắc Á (Bac A Bank)" },
        { code: "PVB", citad: "01360001", shortName: "PVcomBank", fullName: "Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)" },
        { code: "VAB", citad: "01355001", shortName: "VietABank", fullName: "Ngân hàng TMCP Việt Á (VietABank)" },
        { code: "BVB", citad: "01354001", shortName: "BVBank", fullName: "Ngân hàng TMCP Bản Việt (BVBank)" },
        { code: "KLB", citad: "01353001", shortName: "KienlongBank", fullName: "Ngân hàng TMCP Kiên Long (KienlongBank)" },
        { code: "NCB", citad: "01352001", shortName: "NCB", fullName: "Ngân hàng TMCP Quốc Dân (NCB)" },
        { code: "SCB", citad: "01334001", shortName: "SCB", fullName: "Ngân hàng TMCP Sài Gòn (SCB)" },
        { code: "SGB", citad: "01308001", shortName: "Saigonbank", fullName: "Ngân hàng TMCP Sài Gòn Công Thương (Saigonbank)" },
        { code: "VBB", citad: "01356001", shortName: "Vietbank", fullName: "Ngân hàng TMCP Việt Nam Thương Tín (Vietbank)" },
        { code: "PGB", citad: "01341001", shortName: "PGBank", fullName: "Ngân hàng TMCP Thịnh vượng và Phát triển (PGBank)" },
        { code: "UOB", citad: "01665001", shortName: "UOB", fullName: "Ngân hàng TNHH MTV United Overseas Bank (Việt Nam)" },
        { code: "SCVN", citad: "01604001", shortName: "Standard Chartered", fullName: "Ngân hàng TNHH MTV Standard Chartered (Việt Nam)" },
        { code: "HSBC", citad: "01601001", shortName: "HSBC", fullName: "Ngân hàng TNHH MTV HSBC (Việt Nam)" },
        { code: "SHBVN", citad: "01616001", shortName: "Shinhan Bank", fullName: "Ngân hàng TNHH MTV Shinhan Việt Nam" },
        { code: "WVN", citad: "01663001", shortName: "Woori Bank", fullName: "Ngân hàng TNHH MTV Woori Việt Nam" }
    ]
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GENRE_DATA };
}
