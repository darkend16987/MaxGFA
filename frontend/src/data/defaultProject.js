// ============================================================
// DEFAULT PROJECT DATA
// Sample project based on Đảo Vũ Yên reference data
// ============================================================

export const DEFAULT_PROJECT = {
  name: "Dự án mẫu — Đảo Vũ Yên",
  description: "Dự án khu đô thị cao tầng tại Đảo Vũ Yên, Hải Phòng",

  // --- Land lots ---
  lots: [
    {
      id: "CC1",
      name: "Lô CC1",
      area: 24474,
      kMax: 5.30,
      densityMax: 0.40,
      maxFloors: 30,
      minFloors: 3,
      notes: "",
    },
    {
      id: "CC2",
      name: "Lô CC2",
      area: 18682,
      kMax: 4.63,
      densityMax: 0.35,
      maxFloors: 30,
      minFloors: 3,
      notes: "",
    },
    {
      id: "CC3",
      name: "Lô CC3",
      area: 28890,
      kMax: 5.98,
      densityMax: 0.40,
      maxFloors: 30,
      minFloors: 3,
      notes: "",
    },
    {
      id: "CC4",
      name: "Lô CC4",
      area: 26850,
      kMax: 6.44,
      densityMax: 0.40,
      maxFloors: 30,
      minFloors: 3,
      notes: "",
    },
  ],

  // --- Building types (templates) ---
  buildingTypes: [
    {
      id: "L_short",
      shape: "L",
      label: "L ngắn",
      typicalArea: 1472.67,
      variants: [],
      description: "Tòa hình chữ L cạnh ngắn (~53×46m)",
    },
    {
      id: "L_long",
      shape: "L",
      label: "L dài",
      typicalArea: 1778.53,
      variants: [],
      description: "Tòa hình chữ L cạnh dài (~74×46m)",
    },
    {
      id: "Z1",
      shape: "Z",
      label: "Z",
      typicalArea: 1472.67,
      variants: [],
      description: "Tòa hình chữ Z tiêu chuẩn (~75×29m)",
    },
    {
      id: "I1",
      shape: "I",
      label: "I1",
      typicalArea: 1472.67,
      variants: [],
      description: "Tòa hình chữ I biến thể 1",
    },
    {
      id: "I2",
      shape: "I",
      label: "I2",
      typicalArea: 1685.84,
      variants: [],
      description: "Tòa hình chữ I biến thể 2 (lớn hơn)",
    },
    {
      id: "SQ1",
      shape: "SQ",
      label: "Vuông",
      typicalArea: 1188.16,
      variants: [],
      description: "Tòa hình vuông (~35.6×35.6m)",
    },
  ],

  // --- Assignments: which buildings go in which lot ---
  assignments: [
    { lotId: "CC1", buildings: ["L_short", "L_short", "I2"] },
    { lotId: "CC2", buildings: ["Z1", "Z1"] },
    { lotId: "CC3", buildings: ["Z1", "Z1", "Z1", "Z1"] },
    { lotId: "CC4", buildings: ["L_short", "L_short", "Z1", "Z1"] },
  ],

  // --- Global settings ---
  settings: {
    deductionRate: 0.03, // ~3% cho kỹ thuật, PCCC, tum, mái per floor
    commercialFloors: 2, // Số tầng thương mại dịch vụ
    kTargetMin: 0.90, // Ngưỡng K tối thiểu (% of Kmax)
    optimizationIterations: 800,
    perturbationRange: 0.08, // ±8% typical area
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
      deductionRate: 0.03,
      commercialFloors: 2,
      kTargetMin: 0.90,
      optimizationIterations: 800,
      perturbationRange: 0.08,
    },
  };
}

// Generate a unique ID
let _idCounter = 0;
export function generateId(prefix = "item") {
  _idCounter++;
  return `${prefix}_${Date.now()}_${_idCounter}`;
}
