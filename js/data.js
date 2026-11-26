/**
 * Dữ liệu danh mục Tỉnh/Thành phố Việt Nam & Danh sách Ngân hàng
 * Phục vụ Web Form Đăng Ký Hồ Sơ GENRE - Generali Việt Nam
 */

const GENRE_DATA = {
    // Danh sách 63 Tỉnh / Thành phố
    provinces: [
        "TP. Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
        "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu",
        "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước",
        "Bình Thuận", "Cà Mau", "Cao Bằng", "Đắk Lắk", "Đắk Nông",
        "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang",
        "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang", "Hòa Bình",
        "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
        "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định",
        "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên",
        "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị",
        "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên",
        "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "Trà Vinh", "Tuyên Quang",
        "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
    ],

    // Danh sách nơi cấp CCCD/CMND phổ biến để gợi ý nhanh
    issuePlaces: [
        "Cục Cảnh sát quản lý hành chính về trật tự xã hội",
        "Cục Cảnh sát QLHC về TTXH",
        "Cục Cảnh sát ĐKQL cư trú và DLQG về dân cư",
        "Bộ Công An",
        "Cục Quản lý xuất nhập cảnh"
    ],

    // Danh sách Ngân hàng phổ biến tại Việt Nam (Kèm mã ngân hàng gợi ý)
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
