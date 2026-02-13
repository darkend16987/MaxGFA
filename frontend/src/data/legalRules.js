// ============================================================
// LEGAL RULES DATABASE
// Vietnamese Construction Regulations for GFA Calculation
// ============================================================
// Principle: When two regulations conflict on the same metric,
// the regulation MORE FAVORABLE to the developer applies.
// ============================================================

export const LEGAL_RULES = {
  QCVN_01_2021: {
    id: "QCVN_01_2021",
    name: "QCVN 01:2021/BXD",
    description: "Quy chuẩn quốc gia về Quy hoạch xây dựng",
    date: "2021",
    rules: {
      maxCombinedFAR: 13, // Hệ số SDD chung đế+tháp không vượt 13 lần (Mục 2.6.3)
      deductions: [
        {
          id: "basement_parking",
          label: "Tầng hầm (đỗ xe, kỹ thuật, PCCC, lánh nạn)",
          description: "Tầng hầm CHỈ bố trí đỗ xe + kỹ thuật + PCCC + lánh nạn → toàn bộ không tính K",
          auto: true,
        },
        {
          id: "mep_floors",
          label: "Tầng kỹ thuật (MEP)",
          description: "Diện tích sàn kỹ thuật không tính vào hệ số SDD",
          auto: true,
        },
        {
          id: "fire_escape",
          label: "Gian lánh nạn, thang thoát hiểm",
          description: "Phòng PCCC, gian lánh nạn không tính vào hệ số SDD",
          auto: true,
        },
        {
          id: "elevator_unused",
          label: "Giếng thang máy tầng không dừng",
          description: "Theo CV 3633: nếu thang máy không mở cửa ở tầng đó → không tính",
          auto: true,
        },
        {
          id: "roof_non_commercial",
          label: "Mái (không kinh doanh)",
          description: "Mái không kinh doanh không tính. Bể bơi kinh doanh trên mái → tính",
          auto: true,
        },
      ],
      densityFormula: "MĐXD = Diện tích chiếm đất công trình / Diện tích lô đất (Mục 1.4.20)",
      farFormula: "K = Tổng DT sàn (trừ phần miễn) / Tổng DT lô đất (Mục 1.4.21)",
    },
  },
  CV_3633_BXD: {
    id: "CV_3633_BXD",
    name: "CV 3633/BXD-KHCN (08/2023)",
    description: "Hướng dẫn áp dụng QCVN 01:2021 (trả lời Taseco Invest)",
    date: "08/2023",
    rules: {
      separateDensityForPodiumTower: true,
      elevatorUnusedFloorExcluded: true,
      poolOnRoofCounted: true,
      notes: [
        "MĐXD tính riêng cho phần đế và phần tháp theo chiều cao xây dựng tương ứng",
        "Giếng thang máy tầng không dừng: không tính vào diện tích sàn → không tính hệ số SDD",
        "Bể bơi kinh doanh trên mái: tính vào hệ số SDD",
      ],
    },
  },
  BB_CUC_QLHDXD: {
    id: "BB_CUC_QLHDXD",
    name: "Biên bản Cục QLHĐXD (05/2024)",
    description: "Thống nhất nội dung từ buổi sinh hoạt chuyên đề (lần 1)",
    date: "05/2024",
    rules: {
      mixedFloorPartialDeduction: true,
      openSpaceNotCounted: true,
      structuralColumnsInTransitNotDeducted: true,
      notes: [
        "Tầng hỗn hợp (đỗ xe + thương mại): chỉ trừ phần đỗ xe/kỹ thuật/lánh nạn",
        "Không gian trống (không tường bao, không công năng sử dụng): không tính DT sàn",
        "Phần cột/vách/tường bao thuộc hệ giao thông chung (trừ thang thoát hiểm/chữa cháy) → KHÔNG được trừ",
      ],
    },
  },
  CV_1637_BXD: {
    id: "CV_1637_BXD",
    name: "CV 1637/BXD-KHCN (05/2022)",
    description: "Hướng dẫn xác định diện tích sàn khi tính hệ số SDD",
    date: "05/2022",
    rules: {
      detailedDeductions: true,
      notes: [
        "Hướng dẫn chi tiết cách xác định diện tích sàn xây dựng",
        "Phân biệt rõ diện tích tính và không tính vào hệ số SDD",
      ],
    },
  },
};

// Deduction categories with configurable rates
export const DEDUCTION_CATEGORIES = [
  {
    id: "basement",
    label: "Tầng hầm (đỗ xe thuần túy)",
    description: "Toàn bộ DT tầng hầm chỉ chứa đỗ xe + kỹ thuật + PCCC + lánh nạn",
    defaultIncluded: true,
    countTowardK: false,
  },
  {
    id: "basement_mixed",
    label: "Tầng hầm hỗn hợp",
    description: "Phần đỗ xe/kỹ thuật/lánh nạn trừ, phần thương mại tính",
    defaultIncluded: true,
    countTowardK: "partial",
  },
  {
    id: "mep",
    label: "Sàn kỹ thuật (MEP)",
    description: "Tầng kỹ thuật không có công năng sử dụng",
    defaultIncluded: true,
    countTowardK: false,
  },
  {
    id: "fire_safety",
    label: "PCCC / Lánh nạn",
    description: "Phòng PCCC, gian lánh nạn, thang thoát hiểm",
    defaultIncluded: true,
    countTowardK: false,
  },
  {
    id: "elevator_no_stop",
    label: "Giếng thang máy (tầng không dừng)",
    description: "Giếng thang máy tại tầng thang không mở cửa (theo CV 3633)",
    defaultIncluded: true,
    countTowardK: false,
  },
  {
    id: "roof_non_commercial",
    label: "Mái không kinh doanh",
    description: "Tum thang, mái che thiết bị, không có công năng kinh doanh",
    defaultIncluded: true,
    countTowardK: false,
  },
  {
    id: "roof_commercial",
    label: "Mái kinh doanh (bể bơi...)",
    description: "Bể bơi kinh doanh, nhà hàng trên mái → TÍNH vào hệ số",
    defaultIncluded: false,
    countTowardK: true,
  },
  {
    id: "open_space",
    label: "Không gian trống",
    description: "Không tường bao, không công năng sử dụng (theo BB Cục QLHĐXD)",
    defaultIncluded: true,
    countTowardK: false,
  },
];

// Apply the "most favorable to developer" principle
export function applyMostFavorableRule(ruleValues) {
  // When multiple rules give different values for the same metric,
  // return the one most favorable to the developer (higher K allowed, etc.)
  return Math.max(...ruleValues);
}
