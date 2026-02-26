// ============================================================
// EXCEL EXPORT MODULE — WITH FORMULAS
// Export optimization results to .xlsx using SheetJS
// Cells contain Excel formulas where applicable, so users
// can audit calculations and modify inputs directly in Excel.
// ============================================================

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ── Helpers ──────────────────────────────────────────────────

/** Create a formula cell with a cached numeric value */
function fCell(formula, cachedValue) {
  return { f: formula, v: cachedValue, t: "n" };
}

/** Create a plain numeric cell */
function nCell(value) {
  return { v: value, t: "n" };
}

/** Create a plain string cell */
function sCell(value) {
  return { v: value, t: "s" };
}

/** Convert a 0-based column index to Excel column letter (0→A, 25→Z, 26→AA) */
function colLetter(idx) {
  let s = "";
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** Set a cell in a worksheet at the given 0-based row / col */
function setCell(ws, row, col, cell) {
  const ref = colLetter(col) + (row + 1);
  ws[ref] = cell;

  // Expand the sheet range
  if (!ws["!ref"]) {
    ws["!ref"] = ref + ":" + ref;
  } else {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    if (row > range.e.r) range.e.r = row;
    if (col > range.e.c) range.e.c = col;
    if (row < range.s.r) range.s.r = row;
    if (col < range.s.c) range.s.c = col;
    ws["!ref"] = XLSX.utils.encode_range(range);
  }
}

// ── Main Export ──────────────────────────────────────────────

/**
 * Export full project results to Excel workbook WITH formulas.
 *
 * Sheet creation order matters because later sheets reference earlier ones:
 *   1. Config      — settings (deductionRate referenced by Buildings)
 *   2. Buildings   — per-building detail with formulas
 *   3. Lots        — per-lot aggregation using SUMIF/COUNTIF → Buildings
 *   4. Types       — per-type aggregation using SUMIF/COUNTIF → Buildings
 *   5. Summary     — project totals referencing Lots
 *
 * @param {Object} project - Project configuration
 * @param {Object} result  - Calculation result from engine
 */
export function exportToExcel(project, result) {
  const wb = XLSX.utils.book_new();

  // 1. Config (must be first so Buildings can reference deductionRate)
  addConfigSheet(wb, project);

  // 2. Building details (must be before Lots & Types)
  const buildingSheetMeta = addBuildingDetailsSheet(wb, project, result);

  // 3. Lot details (references Buildings)
  addLotDetailsSheet(wb, result, buildingSheetMeta);

  // 4. Type aggregation (references Buildings)
  addTypeAggregationSheet(wb, result, buildingSheetMeta);

  // 5. Summary (references Lots)
  addSummarySheet(wb, project, result);

  // Generate and download
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fileName = `GFA_${project.name || "project"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
}

// ── Sheet: Config ────────────────────────────────────────────

function addConfigSheet(wb, project) {
  const data = [
    ["CẤU HÌNH DỰ ÁN"],
    [],
    ["Tên dự án", project.name],
    ["Tỷ lệ trừ (KT, PCCC...)", project.settings.deductionRate],
    ["Số tầng TMDV", project.settings.commercialFloors],
    ["Ngưỡng K tối thiểu", project.settings.kTargetMin],
    [],
    ["MẪU TÒA NHÀ"],
    ["ID", "Tên", "Hình dạng", "DT điển hình (m²)", "DT min (m²)", "DT max (m²)"],
    ...project.buildingTypes.map((bt) => [bt.id, bt.label, bt.shape, bt.typicalArea, bt.minTypicalArea || "", bt.maxTypicalArea || ""]),
    [],
    ["PHÂN BỔ"],
    ["Lô đất", "Các tòa"],
    ...project.assignments.map((a) => [a.lotId, a.buildings.join(", ")]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, "Config");
}

// ── Sheet: Buildings (Chi tiết Tòa nhà) ─────────────────────

/**
 * Columns layout (0-indexed):
 *   A(0)  Lô đất (lot id)
 *   B(1)  Mẫu tòa (type label)
 *   C(2)  Hình dạng
 *   D(3)  DT điển hình (m²)         — input value
 *   E(4)  Số tầng                   — input value
 *   F(5)  Tầng TMDV                 — input value
 *   G(6)  Tầng ở                    — FORMULA: =E-F
 *   H(7)  Tầng trừ                  — FORMULA: =CEILING(E*deductionRate,1)
 *   I(8)  DT sàn TMDV (m²)          — FORMULA: =D*F
 *   J(9)  DT sàn ở (m²)             — FORMULA: =D*G
 *   K(10) DT sàn tính K (m²)        — FORMULA: =D*E*(1-deductionRate)
 *   L(11) DT sàn trừ (m²)           — FORMULA: =M-K
 *   M(12) DT sàn tổng (m²)          — FORMULA: =D*E
 *
 * Returns metadata about the sheet for cross-sheet references.
 */
function addBuildingDetailsSheet(wb, project, result) {
  const ws = {};
  const SHEET_NAME = "Buildings";

  const headers = [
    "Lô đất",
    "Mẫu tòa",
    "Hình dạng",
    "DT điển hình (m²)",
    "Số tầng",
    "Tầng TMDV",
    "Tầng ở",
    "Tầng trừ",
    "DT sàn TMDV (m²)",
    "DT sàn ở (m²)",
    "DT sàn tính K (m²)",
    "DT sàn trừ (m²)",
    "DT sàn tổng (m²)",
  ];

  // Write header row (row 0)
  headers.forEach((h, ci) => setCell(ws, 0, ci, sCell(h)));

  const deductionRate = project.settings.deductionRate || 0;
  // Cell reference to deduction rate on Config sheet: Config!B4 (row 4, col B)
  const deductionRef = "Config!B4";

  let rowIdx = 1; // data starts at row index 1 (Excel row 2)

  result.lotResults.forEach((lr) => {
    lr.buildings.forEach((b) => {
      const r = rowIdx + 1; // Excel 1-based row number

      // A: Lot ID (string input)
      setCell(ws, rowIdx, 0, sCell(lr.lot.id));
      // B: Type label (string input)
      setCell(ws, rowIdx, 1, sCell(b.type.label));
      // C: Shape (string input)
      setCell(ws, rowIdx, 2, sCell(b.type.shape));
      // D: Typical area (numeric input)
      setCell(ws, rowIdx, 3, nCell(Math.round(b.adjustedTypicalArea * 100) / 100));
      // E: Total floors (numeric input)
      setCell(ws, rowIdx, 4, nCell(b.totalFloors));
      // F: Commercial floors (numeric input)
      setCell(ws, rowIdx, 5, nCell(b.commercialFloors));

      // G: Residential floors = totalFloors - commercialFloors
      setCell(ws, rowIdx, 6, fCell(
        `E${r}-F${r}`,
        b.residentialFloors
      ));

      // H: Deduction floors = CEILING(totalFloors * deductionRate, 1)
      //    If deductionRate is 0, result is 0
      setCell(ws, rowIdx, 7, fCell(
        deductionRate > 0
          ? `CEILING(E${r}*${deductionRef},1)`
          : `E${r}*${deductionRef}`,
        b.deductionFloors
      ));

      // I: Commercial GFA = typicalArea * commercialFloors
      setCell(ws, rowIdx, 8, fCell(
        `D${r}*F${r}`,
        Math.round(b.adjustedCommercialGFA * 100) / 100
      ));

      // J: Residential GFA = typicalArea * residentialFloors
      setCell(ws, rowIdx, 9, fCell(
        `D${r}*G${r}`,
        Math.round(b.adjustedResidentialGFA * 100) / 100
      ));

      // K: Counted GFA = typicalArea * totalFloors * (1 - deductionRate)
      setCell(ws, rowIdx, 10, fCell(
        `D${r}*E${r}*(1-${deductionRef})`,
        Math.round(b.adjustedCountedGFA * 100) / 100
      ));

      // L: Deduction GFA = totalGFA - countedGFA
      setCell(ws, rowIdx, 11, fCell(
        `M${r}-K${r}`,
        Math.round(b.adjustedDeductionGFA * 100) / 100
      ));

      // M: Total GFA = typicalArea * totalFloors
      setCell(ws, rowIdx, 12, fCell(
        `D${r}*E${r}`,
        Math.round(b.adjustedTotalGFA * 100) / 100
      ));

      rowIdx++;
    });
  });

  // Column widths
  ws["!cols"] = headers.map(() => ({ wch: 18 }));

  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);

  // Return metadata for cross-sheet references
  return {
    sheetName: SHEET_NAME,
    dataStartRow: 2, // Excel 1-based
    dataEndRow: rowIdx, // Excel 1-based (last data row = rowIdx because rowIdx was incremented past last)
    cols: {
      lotId: "A",       // 0
      typeLabel: "B",   // 1
      typicalArea: "D", // 3
      totalFloors: "E", // 4
      countedGFA: "K",  // 10
      totalGFA: "M",    // 12
    },
  };
}

// ── Sheet: Lots (Chi tiết Lô đất) ───────────────────────────

/**
 * Columns:
 *   A(0)  Lô đất ID
 *   B(1)  Tên
 *   C(2)  DT đất (m²)         — input
 *   D(3)  K max               — input
 *   E(4)  K đạt               — FORMULA: totalCountedGFA / area
 *   F(5)  Tỷ lệ K (%)         — FORMULA: K đạt / K max * 100
 *   G(6)  MĐXD max (%)        — input
 *   H(7)  MĐXD đạt (%)        — FORMULA: SUMIF(footprint) / area * 100
 *   I(8)  Số tòa              — FORMULA: COUNTIF
 *   J(9)  Tầng max            — input
 *   K(10) DT sàn tính K (m²)  — FORMULA: SUMIF
 *   L(11) DT sàn thực (m²)    — FORMULA: SUMIF
 *   M(12) Trạng thái          — cached value (complex logic, kept as value)
 */
function addLotDetailsSheet(wb, result, bMeta) {
  const ws = {};
  const SHEET_NAME = "Lots";
  const B = bMeta.sheetName; // "Buildings"

  const headers = [
    "Lô đất",
    "Tên",
    "DT đất (m²)",
    "K max",
    "K đạt",
    "Tỷ lệ K (%)",
    "MĐXD max (%)",
    "MĐXD đạt (%)",
    "Số tòa",
    "Tầng max",
    "DT sàn tính K (m²)",
    "DT sàn thực (m²)",
    "Trạng thái",
  ];

  headers.forEach((h, ci) => setCell(ws, 0, ci, sCell(h)));

  // Build SUMIF/COUNTIF range strings for the Buildings sheet
  // These reference the entire data column range
  const bLotCol = `${B}!$${bMeta.cols.lotId}$${bMeta.dataStartRow}:$${bMeta.cols.lotId}$${bMeta.dataEndRow}`;
  const bCountedCol = `${B}!$${bMeta.cols.countedGFA}$${bMeta.dataStartRow}:$${bMeta.cols.countedGFA}$${bMeta.dataEndRow}`;
  const bTotalCol = `${B}!$${bMeta.cols.totalGFA}$${bMeta.dataStartRow}:$${bMeta.cols.totalGFA}$${bMeta.dataEndRow}`;
  const bAreaCol = `${B}!$${bMeta.cols.typicalArea}$${bMeta.dataStartRow}:$${bMeta.cols.typicalArea}$${bMeta.dataEndRow}`;

  result.lotResults.forEach((lr, idx) => {
    const rowIdx = idx + 1;
    const r = rowIdx + 1; // Excel row

    // A: Lot ID
    setCell(ws, rowIdx, 0, sCell(lr.lot.id));
    // B: Lot name
    setCell(ws, rowIdx, 1, sCell(lr.lot.name));
    // C: Land area (input)
    setCell(ws, rowIdx, 2, nCell(lr.lot.area));
    // D: K max (input)
    setCell(ws, rowIdx, 3, nCell(lr.kMax));

    // K(10): Counted GFA — SUMIF(Buildings lot column, this lot id, Buildings countedGFA column)
    setCell(ws, rowIdx, 10, fCell(
      `SUMIF(${bLotCol},A${r},${bCountedCol})`,
      Math.round(lr.totalCountedGFA * 100) / 100
    ));

    // L(11): Actual GFA — SUMIF
    setCell(ws, rowIdx, 11, fCell(
      `SUMIF(${bLotCol},A${r},${bTotalCol})`,
      Math.round(lr.totalActualGFA * 100) / 100
    ));

    // E(4): K achieved = countedGFA / land area
    setCell(ws, rowIdx, 4, fCell(
      `IF(C${r}>0,K${r}/C${r},0)`,
      Math.round(lr.kAchieved * 100) / 100
    ));

    // F(5): K utilization % = K achieved / K max * 100
    setCell(ws, rowIdx, 5, fCell(
      `IF(D${r}>0,E${r}/D${r}*100,0)`,
      Math.round(lr.utilizationRate * 10000) / 100
    ));

    // G(6): Density max (input, as %)
    setCell(ws, rowIdx, 6, nCell(lr.densityMax * 100));

    // H(7): Density achieved = SUMIF(footprint) / area * 100
    setCell(ws, rowIdx, 7, fCell(
      `IF(C${r}>0,SUMIF(${bLotCol},A${r},${bAreaCol})/C${r}*100,0)`,
      Math.round(lr.densityAchieved * 10000) / 100
    ));

    // I(8): Building count = COUNTIF
    setCell(ws, rowIdx, 8, fCell(
      `COUNTIF(${bLotCol},A${r})`,
      lr.buildingCount
    ));

    // J(9): Max floors (input)
    setCell(ws, rowIdx, 9, nCell(lr.maxFloors));

    // M(12): Status (complex conditional logic — kept as cached value)
    const statusText =
      lr.status === "optimal" ? "Tối ưu" :
      lr.status === "good" ? "Khá" :
      lr.status === "over" ? "Vượt" :
      lr.status === "low" ? "Thấp" : "Chưa gán";
    setCell(ws, rowIdx, 12, sCell(statusText));
  });

  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
}

// ── Sheet: Types (Tổng hợp Mẫu tòa) ────────────────────────

function addTypeAggregationSheet(wb, result, bMeta) {
  const ws = {};
  const SHEET_NAME = "Types";
  const B = bMeta.sheetName;

  const headers = [
    "Mẫu tòa",
    "Hình dạng",
    "Số lượng",
    "Các lô",
    "Tổng DT sàn tính K (m²)",
    "Tổng DT sàn thực (m²)",
  ];

  headers.forEach((h, ci) => setCell(ws, 0, ci, sCell(h)));

  const bLabelCol = `${B}!$${bMeta.cols.typeLabel}$${bMeta.dataStartRow}:$${bMeta.cols.typeLabel}$${bMeta.dataEndRow}`;
  const bCountedCol = `${B}!$${bMeta.cols.countedGFA}$${bMeta.dataStartRow}:$${bMeta.cols.countedGFA}$${bMeta.dataEndRow}`;
  const bTotalCol = `${B}!$${bMeta.cols.totalGFA}$${bMeta.dataStartRow}:$${bMeta.cols.totalGFA}$${bMeta.dataEndRow}`;

  const types = Object.values(result.typeAggregation).filter((a) => a.count > 0);

  types.forEach((agg, idx) => {
    const rowIdx = idx + 1;
    const r = rowIdx + 1;

    // A: Type label
    setCell(ws, rowIdx, 0, sCell(agg.type.label));
    // B: Shape
    setCell(ws, rowIdx, 1, sCell(agg.type.shape));

    // C: Count — COUNTIF
    setCell(ws, rowIdx, 2, fCell(
      `COUNTIF(${bLabelCol},A${r})`,
      agg.count
    ));

    // D: Lots (string, kept as value — complex set logic)
    setCell(ws, rowIdx, 3, sCell([...new Set(agg.lots)].join(", ")));

    // E: Total counted GFA — SUMIF
    setCell(ws, rowIdx, 4, fCell(
      `SUMIF(${bLabelCol},A${r},${bCountedCol})`,
      Math.round(agg.totalCountedGFA * 100) / 100
    ));

    // F: Total actual GFA — SUMIF
    setCell(ws, rowIdx, 5, fCell(
      `SUMIF(${bLabelCol},A${r},${bTotalCol})`,
      Math.round(agg.totalActualGFA * 100) / 100
    ));
  });

  ws["!cols"] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
}

// ── Sheet: Summary (Tổng hợp) ───────────────────────────────

function addSummarySheet(wb, project, result) {
  const ws = {};
  const pt = result.projectTotal;
  const lotCount = result.lotResults.length;

  // Row layout (0-indexed):
  //  0: Title
  //  1: blank
  //  2: Project name
  //  3: Date
  //  4: blank
  //  5: Section header
  //  6: Total land area           — FORMULA
  //  7: Total lots                — value (static count)
  //  8: Total buildings           — FORMULA
  //  9: blank
  // 10: Total counted GFA         — FORMULA
  // 11: Total actual GFA          — FORMULA
  // 12: Avg K                     — FORMULA
  // 13: Avg utilization           — FORMULA
  // 14: blank
  // 15: Section header
  // 16: FAR compliance            — FORMULA
  // 17: FAR value                 — FORMULA

  // Lots sheet range for SUM formulas
  const lotsDataRange = (col) => `Lots!${col}2:${col}${lotCount + 1}`;

  // Row 0: Title
  setCell(ws, 0, 0, sCell("GFA OPTIMIZER - Kết quả Tối ưu hóa"));

  // Row 2-3: Project info
  setCell(ws, 2, 0, sCell("Dự án:"));
  setCell(ws, 2, 1, sCell(project.name));
  setCell(ws, 3, 0, sCell("Ngày xuất:"));
  setCell(ws, 3, 1, sCell(new Date().toLocaleDateString("vi-VN")));

  // Row 5: Section header
  setCell(ws, 5, 0, sCell("CHỈ TIÊU TỔNG HỢP"));

  // Row 6: Total land area = SUM of Lots!C
  setCell(ws, 6, 0, sCell("Tổng diện tích đất"));
  setCell(ws, 6, 1, fCell(
    `SUM(${lotsDataRange("C")})`,
    pt.totalLandArea
  ));
  setCell(ws, 6, 2, sCell("m²"));

  // Row 7: Total lots (static — this is the count of configured lots)
  setCell(ws, 7, 0, sCell("Tổng số lô đất"));
  setCell(ws, 7, 1, nCell(pt.totalLots));

  // Row 8: Total buildings = SUM of Lots!I
  setCell(ws, 8, 0, sCell("Tổng số tòa nhà"));
  setCell(ws, 8, 1, fCell(
    `SUM(${lotsDataRange("I")})`,
    pt.totalBuildings
  ));

  // Row 10: Total counted GFA = SUM of Lots!K
  setCell(ws, 10, 0, sCell("Tổng DT sàn (tính hệ số K)"));
  setCell(ws, 10, 1, fCell(
    `SUM(${lotsDataRange("K")})`,
    pt.totalCountedGFA
  ));
  setCell(ws, 10, 2, sCell("m²"));

  // Row 11: Total actual GFA = SUM of Lots!L
  setCell(ws, 11, 0, sCell("Tổng DT sàn thực tế"));
  setCell(ws, 11, 1, fCell(
    `SUM(${lotsDataRange("L")})`,
    pt.totalActualGFA
  ));
  setCell(ws, 11, 2, sCell("m²"));

  // Row 12: Avg K = total counted GFA / total land area
  setCell(ws, 12, 0, sCell("Hệ số SDD trung bình"));
  setCell(ws, 12, 1, fCell(
    `IF(B7>0,B11/B7,0)`,
    pt.avgK
  ));
  setCell(ws, 12, 2, sCell("lần"));

  // Row 13: Avg utilization = AVERAGE of Lots!F (lot utilization %)
  setCell(ws, 13, 0, sCell("Tỷ lệ tối ưu trung bình"));
  setCell(ws, 13, 1, fCell(
    `IFERROR(AVERAGE(${lotsDataRange("F")}),0)`,
    pt.avgUtilization * 100
  ));
  setCell(ws, 13, 2, sCell("%"));

  // Row 15: Legal section
  setCell(ws, 15, 0, sCell("RÀNG BUỘC PHÁP LÝ"));

  // Row 16: FAR compliance check
  setCell(ws, 16, 0, sCell("Hệ số SDD chung ≤ 13 lần"));
  setCell(ws, 16, 1, fCell(
    `IF(B13<=13,"ĐẠT","KHÔNG ĐẠT")`,
    pt.combinedFARCompliant ? "ĐẠT" : "KHÔNG ĐẠT"
  ));

  // Row 17: Actual FAR value
  setCell(ws, 17, 0, sCell("Giá trị thực tế"));
  setCell(ws, 17, 1, fCell(
    `B13`,
    pt.combinedFAR
  ));
  setCell(ws, 17, 2, sCell("lần"));

  ws["!cols"] = [{ wch: 35 }, { wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, "Summary");
}
