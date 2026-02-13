// ============================================================
// EXCEL EXPORT MODULE
// Export optimization results to .xlsx using SheetJS
// ============================================================

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/**
 * Export full project results to Excel workbook.
 *
 * @param {Object} project - Project configuration
 * @param {Object} result - Calculation result from engine
 */
export function exportToExcel(project, result) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Project Summary
  addSummarySheet(wb, project, result);

  // Sheet 2: Lot Details
  addLotDetailsSheet(wb, result);

  // Sheet 3: Building Type Aggregation
  addTypeAggregationSheet(wb, result);

  // Sheet 4: Building Details (all buildings across all lots)
  addBuildingDetailsSheet(wb, result);

  // Sheet 5: Configuration
  addConfigSheet(wb, project);

  // Generate and download
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fileName = `GFA_${project.name || "project"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
}

function addSummarySheet(wb, project, result) {
  const pt = result.projectTotal;
  const data = [
    ["GFA OPTIMIZER - Kết quả Tối ưu hóa"],
    [],
    ["Dự án:", project.name],
    ["Ngày xuất:", new Date().toLocaleDateString("vi-VN")],
    [],
    ["CHỈ TIÊU TỔNG HỢP"],
    ["Tổng diện tích đất", pt.totalLandArea, "m²"],
    ["Tổng số lô đất", pt.totalLots],
    ["Tổng số tòa nhà", pt.totalBuildings],
    [],
    ["Tổng DT sàn (tính hệ số K)", pt.totalCountedGFA, "m²"],
    ["Tổng DT sàn thực tế", pt.totalActualGFA, "m²"],
    ["Hệ số SDD trung bình", pt.avgK, "lần"],
    ["Tỷ lệ tối ưu trung bình", pt.avgUtilization * 100, "%"],
    [],
    ["RÀNG BUỘC PHÁP LÝ"],
    ["Hệ số SDD chung ≤ 13 lần", pt.combinedFARCompliant ? "ĐẠT" : "KHÔNG ĐẠT"],
    ["Giá trị thực tế", pt.combinedFAR, "lần"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws["!cols"] = [{ wch: 35 }, { wch: 20 }, { wch: 10 }];

  XLSX.utils.book_append_sheet(wb, ws, "Tổng hợp");
}

function addLotDetailsSheet(wb, result) {
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

  const rows = result.lotResults.map((lr) => [
    lr.lot.id,
    lr.lot.name,
    lr.lot.area,
    lr.kMax,
    Math.round(lr.kAchieved * 100) / 100,
    Math.round(lr.utilizationRate * 10000) / 100,
    lr.densityMax * 100,
    Math.round(lr.densityAchieved * 10000) / 100,
    lr.buildingCount,
    lr.maxFloors,
    Math.round(lr.totalCountedGFA * 100) / 100,
    Math.round(lr.totalActualGFA * 100) / 100,
    lr.status === "optimal" ? "Tối ưu" : lr.status === "good" ? "Khá" : lr.status === "low" ? "Thấp" : "Chưa gán",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, "Chi tiết Lô đất");
}

function addTypeAggregationSheet(wb, result) {
  const headers = [
    "Mẫu tòa",
    "Hình dạng",
    "Số lượng",
    "Các lô",
    "Tổng DT sàn tính K (m²)",
    "Tổng DT sàn thực (m²)",
  ];

  const rows = Object.values(result.typeAggregation)
    .filter((a) => a.count > 0)
    .map((agg) => [
      agg.type.label,
      agg.type.shape,
      agg.count,
      [...new Set(agg.lots)].join(", "),
      Math.round(agg.totalCountedGFA * 100) / 100,
      Math.round(agg.totalActualGFA * 100) / 100,
    ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, "Tổng hợp Mẫu tòa");
}

function addBuildingDetailsSheet(wb, result) {
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

  const rows = [];
  result.lotResults.forEach((lr) => {
    lr.buildings.forEach((b) => {
      rows.push([
        lr.lot.id,
        b.type.label,
        b.type.shape,
        Math.round(b.adjustedTypicalArea * 100) / 100,
        b.totalFloors,
        b.commercialFloors,
        b.residentialFloors,
        b.deductionFloors,
        Math.round(b.adjustedCommercialGFA * 100) / 100,
        Math.round(b.adjustedResidentialGFA * 100) / 100,
        Math.round(b.adjustedCountedGFA * 100) / 100,
        Math.round(b.adjustedDeductionGFA * 100) / 100,
        Math.round(b.adjustedTotalGFA * 100) / 100,
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, "Chi tiết Tòa nhà");
}

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
    ["ID", "Tên", "Hình dạng", "DT điển hình (m²)"],
    ...project.buildingTypes.map((bt) => [bt.id, bt.label, bt.shape, bt.typicalArea]),
    [],
    ["PHÂN BỔ"],
    ["Lô đất", "Các tòa"],
    ...project.assignments.map((a) => [a.lotId, a.buildings.join(", ")]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, "Cấu hình");
}
