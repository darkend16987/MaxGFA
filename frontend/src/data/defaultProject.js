// ============================================================
// DEFAULT PROJECT DATA
// Sample project based on Đảo Vũ Yên reference data (Excel)
// ============================================================
// Phase 1: Biến quyết định là S_t = tổng DT sàn XD 1 tòa.
// Mỗi building type có totalFloors riêng (30T hoặc 8T).
// ============================================================

export const DEFAULT_PROJECT = {
  name: "Dự án mẫu — Đảo Vũ Yên (B6-NOXH)",
  description: "Dự án khu NOXH cao tầng tại Đảo Vũ Yên, Hải Phòng — 32 tòa, 7 mẫu, 14 lô",

  // --- Land lots (14 CC lots from Excel) ---
  lots: [
    {
      id: "CC01",
      name: "B6-CC-01",
      area: 24473.69,
      kMax: 5.30,
      densityMax: 0.20,
      maxFloors: 30,
      minFloors: 3,
      maxPopulation: 2978,
      notes: "NOXH-01: 2×L ngắn + 1×I1",
    },
    {
      id: "CC02",
      name: "B6-CC-02",
      area: 18682.18,
      kMax: 4.63,
      densityMax: 0.17,
      maxFloors: 30,
      minFloors: 3,
      maxPopulation: 1986,
      notes: "NOXH-01: 2×Z",
    },
    {
      id: "CC03",
      name: "B6-CC-03",
      area: 28890.07,
      kMax: 5.98,
      densityMax: 0.22,
      maxFloors: 30,
      minFloors: 3,
      maxPopulation: 3971,
      notes: "NOXH-01: 4×Z",
    },
    {
      id: "CC04",
      name: "B6-CC-04",
      area: 26849.58,
      kMax: 6.44,
      densityMax: 0.23,
      maxFloors: 30,
      minFloors: 3,
      maxPopulation: 3971,
      notes: "NOXH-02: 2×L ngắn + 2×Z",
    },
    {
      id: "CC05",
      name: "B6-CC-05",
      area: 24274.74,
      kMax: 6.11,
      densityMax: 0.22,
      maxFloors: 30,
      minFloors: 3,
      maxPopulation: 3409,
      notes: "NOXH-02: 3×I2",
    },
    {
      id: "CC06",
      name: "B6-CC-06",
      area: 22841.44,
      kMax: 7.62,
      densityMax: 0.27,
      maxFloors: 30,
      minFloors: 3,
      maxPopulation: 3999,
      notes: "NOXH-02: 2×L dài + 2×Vuông",
    },
    {
      id: "CC07",
      name: "B6-CC-07",
      area: 22292.98,
      kMax: 5.81,
      densityMax: 0.21,
      maxFloors: 30,
      minFloors: 3,
      maxPopulation: 2978,
      notes: "NOXH-03: 3×Z",
    },
    {
      id: "CC08",
      name: "B6-CC-08",
      area: 23593.90,
      kMax: 5.49,
      densityMax: 0.20,
      maxFloors: 30,
      minFloors: 3,
      maxPopulation: 2978,
      notes: "NOXH-03: 2×L ngắn + 1×I1",
    },
    {
      id: "CC09",
      name: "B6-CC-09",
      area: 3901.39,
      kMax: 3.25,
      densityMax: 0.43,
      maxFloors: 8,
      minFloors: 1,
      maxPopulation: 273,
      notes: "NOXH-04: 1×I3",
    },
    {
      id: "CC10",
      name: "B6-CC-10",
      area: 3900.79,
      kMax: 3.25,
      densityMax: 0.43,
      maxFloors: 8,
      minFloors: 1,
      maxPopulation: 273,
      notes: "NOXH-05: 1×I3",
    },
    {
      id: "CC11",
      name: "B6-CC-11",
      area: 3901.64,
      kMax: 3.25,
      densityMax: 0.43,
      maxFloors: 8,
      minFloors: 1,
      maxPopulation: 273,
      notes: "NOXH-05: 1×I3",
    },
    {
      id: "CC12",
      name: "B6-CC-12",
      area: 3899.57,
      kMax: 3.25,
      densityMax: 0.43,
      maxFloors: 8,
      minFloors: 1,
      maxPopulation: 273,
      notes: "NOXH-06: 1×I3",
    },
    {
      id: "CC13",
      name: "B6-CC-13",
      area: 3900.00,
      kMax: 3.25,
      densityMax: 0.43,
      maxFloors: 8,
      minFloors: 1,
      maxPopulation: 273,
      notes: "NOXH-07: 1×I3",
    },
    {
      id: "CC14",
      name: "B6-CC-14",
      area: 3910.20,
      kMax: 3.24,
      densityMax: 0.43,
      maxFloors: 8,
      minFloors: 1,
      maxPopulation: 273,
      notes: "NOXH-08: 1×I3",
    },
  ],

  // --- Building types (7 templates from Excel) ---
  // minTypicalArea / maxTypicalArea: ràng buộc C4 — diện tích điển hình hợp lý
  // LP solver sẽ đảm bảo kết quả tối ưu nằm trong khoảng [min, max]
  buildingTypes: [
    {
      id: "L_short",
      shape: "L",
      label: "L ngắn",
      typicalArea: 1472.67,  // DT sàn điển hình (m²)
      minTypicalArea: 1200,  // DT sàn tối thiểu (m²)
      maxTypicalArea: 1800,  // DT sàn tối đa (m²)
      totalFloors: 30,       // 2 TMDV + 28 ở
      commercialFloors: 2,
      variants: [],
      description: "Tòa hình chữ L cạnh ngắn (~53×46m), 30 tầng",
    },
    {
      id: "L_long",
      shape: "L",
      label: "L dài",
      typicalArea: 1778.53,
      minTypicalArea: 1400,
      maxTypicalArea: 2100,
      totalFloors: 30,
      commercialFloors: 2,
      variants: [],
      description: "Tòa hình chữ L cạnh dài (~74×46m), 30 tầng",
    },
    {
      id: "Z1",
      shape: "Z",
      label: "Z",
      typicalArea: 1472.67,
      minTypicalArea: 1200,
      maxTypicalArea: 1800,
      totalFloors: 30,
      commercialFloors: 2,
      variants: [],
      description: "Tòa hình chữ Z tiêu chuẩn (~75×29m), 30 tầng",
    },
    {
      id: "I1",
      shape: "I",
      label: "I1",
      typicalArea: 1472.67,
      minTypicalArea: 1200,
      maxTypicalArea: 1800,
      totalFloors: 30,
      commercialFloors: 2,
      variants: [],
      description: "Tòa hình chữ I biến thể 1, 30 tầng",
    },
    {
      id: "I2",
      shape: "I",
      label: "I2",
      typicalArea: 1685.84,
      minTypicalArea: 1300,
      maxTypicalArea: 2000,
      totalFloors: 30,
      commercialFloors: 2,
      variants: [],
      description: "Tòa hình chữ I biến thể 2 (lớn hơn), 30 tầng",
    },
    {
      id: "I3",
      shape: "I",
      label: "I3",
      typicalArea: 1620.00,
      minTypicalArea: 1200,
      maxTypicalArea: 2000,
      totalFloors: 8,        // 1 TMDV + 7 ở (thấp tầng)
      commercialFloors: 1,
      variants: [],
      description: "Tòa hình chữ I thấp tầng (NOXH), 8 tầng",
    },
    {
      id: "SQ1",
      shape: "SQ",
      label: "Vuông",
      typicalArea: 1188.16,
      minTypicalArea: 900,
      maxTypicalArea: 1500,
      totalFloors: 30,
      commercialFloors: 2,
      variants: [],
      description: "Tòa hình vuông (~35.6×35.6m), 30 tầng",
    },
  ],

  // --- Assignments: which buildings go in which lot (from Excel Sheet3) ---
  assignments: [
    { lotId: "CC01", buildings: ["L_short", "L_short", "I1"] },
    { lotId: "CC02", buildings: ["Z1", "Z1"] },
    { lotId: "CC03", buildings: ["Z1", "Z1", "Z1", "Z1"] },
    { lotId: "CC04", buildings: ["L_short", "L_short", "Z1", "Z1"] },
    { lotId: "CC05", buildings: ["I2", "I2", "I2"] },
    { lotId: "CC06", buildings: ["L_long", "L_long", "SQ1", "SQ1"] },
    { lotId: "CC07", buildings: ["Z1", "Z1", "Z1"] },
    { lotId: "CC08", buildings: ["L_short", "L_short", "I1"] },
    { lotId: "CC09", buildings: ["I3"] },
    { lotId: "CC10", buildings: ["I3"] },
    { lotId: "CC11", buildings: ["I3"] },
    { lotId: "CC12", buildings: ["I3"] },
    { lotId: "CC13", buildings: ["I3"] },
    { lotId: "CC14", buildings: ["I3"] },
  ],

  // --- Global settings ---
  settings: {
    deductionRate: 0,       // Phase 1: no deduction, optimize total GFA directly
    commercialFloors: 2,    // Default, overridden by per-type config
    kTargetMin: 0.90,       // Ngưỡng K tối thiểu (% of Kmax) cho status "optimal"
    optimizationIterations: 800,
    perturbationRange: 0.08,
    // Population constraint settings
    netAreaRatio: 0.9,      // Hệ số quy đổi DT sàn XD → DT thông thủy (0.87-0.92 tùy dự án)
    areaPerPerson: 32,      // Diện tích ở tối thiểu / người (m²) — theo quy hoạch
  },
};

// Create a blank project template
export function createBlankProject() {
  return {
    name: "Dự án mới",
    description: "",
    lots: [],
    buildingTypes: [],
    assignments: [],
    settings: {
      deductionRate: 0,
      commercialFloors: 2,
      kTargetMin: 0.90,
      optimizationIterations: 800,
      perturbationRange: 0.08,
      netAreaRatio: 0.9,
      areaPerPerson: 32,
    },
  };
}

// Generate a unique ID
let _idCounter = 0;
export function generateId(prefix = "item") {
  _idCounter++;
  return `${prefix}_${Date.now()}_${_idCounter}`;
}
