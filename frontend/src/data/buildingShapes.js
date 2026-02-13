// ============================================================
// BUILDING SHAPE DEFINITIONS
// Standard high-rise building form types
// ============================================================

export const BUILDING_SHAPES = {
  I: {
    label: "Chữ I",
    icon: "▯",
    color: "#2563eb",
    defaultRatio: { w: 85, d: 19 },
    description: "Tòa nhà hình chữ nhật dài, phổ biến nhất",
    typicalSizes: [
      { w: 92.5, d: 18, label: "I lớn" },
      { w: 86, d: 20, label: "I trung bình" },
      { w: 75.8, d: 20, label: "I nhỏ" },
    ],
  },
  L: {
    label: "Chữ L",
    icon: "⌐",
    color: "#7c3aed",
    defaultRatio: { w: 60, d: 46 },
    description: "Tòa nhà hình chữ L, hai cánh vuông góc",
    typicalSizes: [
      { w: 74, d: 46, label: "L dài" },
      { w: 53, d: 46, label: "L ngắn" },
    ],
  },
  H: {
    label: "Chữ H",
    icon: "ꞁꞁ",
    color: "#059669",
    defaultRatio: { w: 60, d: 40 },
    description: "Hai khối tháp kết nối bằng lõi giữa",
  },
  U: {
    label: "Chữ U",
    icon: "⊔",
    color: "#d97706",
    defaultRatio: { w: 55, d: 40 },
    description: "Ba cánh tạo hình chữ U, sân trong",
  },
  Z: {
    label: "Chữ Z",
    icon: "Z",
    color: "#dc2626",
    defaultRatio: { w: 75, d: 29 },
    description: "Hai khối lệch nhau tạo hình chữ Z",
    typicalSizes: [{ w: 75, d: 29, label: "Z tiêu chuẩn" }],
  },
  SQ: {
    label: "Vuông",
    icon: "□",
    color: "#0891b2",
    defaultRatio: { w: 36, d: 36 },
    description: "Tòa nhà hình vuông/gần vuông",
    typicalSizes: [{ w: 35.6, d: 35.6, label: "Vuông tiêu chuẩn" }],
  },
};

export function getShapeColor(shapeId) {
  return BUILDING_SHAPES[shapeId]?.color || "#64748b";
}

export function getShapeIcon(shapeId) {
  return BUILDING_SHAPES[shapeId]?.icon || "?";
}

export function getShapeLabel(shapeId) {
  return BUILDING_SHAPES[shapeId]?.label || shapeId;
}
