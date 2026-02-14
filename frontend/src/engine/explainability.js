// ============================================================
// EXPLAINABILITY ENGINE
// Phase 1.5: Generate structured explanations for results
// ============================================================
// Every number needs a "why": formula breakdown, constraint
// status, optimization assessment, and trade-off analysis.
// This is rule-based (no AI), derived directly from calc data.
// ============================================================

import { calculateGFA } from "./directCalculation";

/**
 * Generate full explanations for a calculation result.
 *
 * @param {Object} project - Project configuration
 * @param {Object} result - Result from calculateGFA()
 * @returns {Object} { lotExplanations[], projectExplanation }
 */
export function explainResult(project, result) {
  const { settings, assignments, buildingTypes } = project;
  const { deductionRate, commercialFloors } = settings;

  // Build type-to-lots mapping for trade-off analysis
  const typeToLots = new Map();
  assignments.forEach((a) => {
    a.buildings.forEach((btId) => {
      if (!typeToLots.has(btId)) typeToLots.set(btId, new Set());
      typeToLots.get(btId).add(a.lotId);
    });
  });

  const lotExplanations = result.lotResults.map((lr) => {
    if (lr.status === "unassigned") {
      return {
        lotId: lr.lot.id,
        lotName: lr.lot.name,
        status: "unassigned",
        formulas: {},
        constraints: [],
        bindingConstraint: null,
        optimization: { score: 0, assessment: "unassigned", headroom: null, bottleneck: null },
        tradeoffs: [],
      };
    }

    const maxFloors = lr.maxFloors;
    const countedFloors = maxFloors - Math.ceil(maxFloors * deductionRate);
    const deductionFloors = Math.ceil(maxFloors * deductionRate);

    // === FORMULAS ===
    const buildingBreakdown = lr.buildings.map((b) => ({
      typeId: b.typeId,
      label: b.type.label,
      typicalArea: b.adjustedTypicalArea,
      countedGFA: b.adjustedCountedGFA,
      totalGFA: b.adjustedTotalGFA,
    }));

    const totalTypicalStr = lr.buildings
      .map((b) => `${b.type.label}(${Math.round(b.adjustedTypicalArea)})`)
      .join(" + ");

    const formulas = {
      countedFloors: {
        formula: `${maxFloors} tầng - ceil(${maxFloors} × ${deductionRate}) trừ = ${countedFloors} tầng tính K`,
        detail: `Trong đó: ${commercialFloors} tầng TMDV + ${countedFloors - commercialFloors} tầng ở`,
      },
      kCalculation: {
        formula: `K = Tổng DT sàn tính K / DT đất = ${fmt(lr.totalCountedGFA)} / ${fmt(lr.lot.area)} = ${lr.kAchieved.toFixed(3)}`,
        detail: `Tổng DT sàn tính K = Σ(DT điển hình × ${countedFloors} tầng tính K) = ${fmt(lr.totalCountedGFA)} m²`,
      },
      densityCalculation: {
        formula: `MĐXD = Tổng footprint / DT đất = ${fmt(lr.buildings.reduce((s, b) => s + b.adjustedTypicalArea, 0))} / ${fmt(lr.lot.area)} = ${(lr.densityAchieved * 100).toFixed(1)}%`,
        detail: `Footprint = ${totalTypicalStr}`,
      },
      gfaBreakdown: {
        formula: `Tổng DT sàn thực = DT tính K + DT trừ = ${fmt(lr.totalCountedGFA)} + ${fmt(lr.totalActualGFA - lr.totalCountedGFA)} = ${fmt(lr.totalActualGFA)} m²`,
        detail: `DT trừ = Σ(DT điển hình × ${deductionFloors} tầng trừ) — cho KT, PCCC, tum, mái`,
      },
      buildings: buildingBreakdown,
    };

    if (lr.wasScaled) {
      formulas.scaling = {
        formula: `Đã scale xuống ${(lr.scaleFactor * 100).toFixed(1)}% do vượt ràng buộc`,
        detail: `DT điển hình thực tế = DT gốc × ${lr.scaleFactor.toFixed(4)}`,
      };
    }

    // === CONSTRAINTS ===
    const kUsage = lr.kMax > 0 ? (lr.kAchieved / lr.kMax) * 100 : 0;
    const densityUsage = lr.densityMax > 0 ? (lr.densityAchieved / lr.densityMax) * 100 : 0;

    const constraints = [
      {
        name: "Hệ số K",
        rule: `K ≤ ${lr.kMax.toFixed(2)}`,
        value: lr.kAchieved,
        limit: lr.kMax,
        slack: lr.kMax - lr.kAchieved,
        usage: kUsage,
        status: lr.kAchieved <= lr.kMax ? "met" : "violated",
        slackGFA: (lr.kMax - lr.kAchieved) * lr.lot.area,
      },
      {
        name: "Mật độ XD",
        rule: `MĐXD ≤ ${(lr.densityMax * 100).toFixed(0)}%`,
        value: lr.densityAchieved,
        limit: lr.densityMax,
        slack: lr.densityMax - lr.densityAchieved,
        usage: densityUsage,
        status: lr.densityAchieved <= lr.densityMax ? "met" : "violated",
        slackGFA: null,
      },
    ];

    const bindingConstraint = kUsage >= densityUsage ? "K" : "MĐXD";

    // === OPTIMIZATION ASSESSMENT ===
    const headroomGFA = constraints[0].slackGFA;
    const optimization = {
      score: lr.utilizationRate * 100,
      assessment: lr.status,
      headroom: headroomGFA > 0
        ? `Còn K capacity: ${lr.remainingKCapacity.toFixed(3)} → ~${fmt(headroomGFA)} m² GFA thêm được`
        : `Đã đạt tối đa K cho phép`,
      bottleneck: bindingConstraint === "K"
        ? `K ratio là ràng buộc chặt nhất (${kUsage.toFixed(1)}% sử dụng)`
        : `Mật độ XD là ràng buộc chặt nhất (${densityUsage.toFixed(1)}% sử dụng)`,
      recommendation: getRecommendation(lr, constraints),
    };

    // === TRADE-OFFS ===
    const tradeoffs = computeTradeoffs(lr, project, result, typeToLots);

    return {
      lotId: lr.lot.id,
      lotName: lr.lot.name,
      status: lr.status,
      formulas,
      constraints,
      bindingConstraint,
      optimization,
      tradeoffs,
    };
  });

  // === PROJECT-LEVEL EXPLANATION ===
  const pt = result.projectTotal;
  const projectExplanation = {
    farCompliance: {
      status: pt.combinedFARCompliant ? "met" : "violated",
      formula: `FAR tổng = ${pt.combinedFAR.toFixed(2)} ${pt.combinedFARCompliant ? "≤" : ">"} 13`,
      usage: (pt.combinedFAR / 13) * 100,
      detail: pt.combinedFARCompliant
        ? `ĐẠT — còn ${((13 - pt.combinedFAR) / 13 * 100).toFixed(1)}% capacity`
        : `KHÔNG ĐẠT — vượt ${((pt.combinedFAR - 13) / 13 * 100).toFixed(1)}%`,
    },
    summary: {
      totalLandArea: pt.totalLandArea,
      totalCountedGFA: pt.totalCountedGFA,
      totalActualGFA: pt.totalActualGFA,
      avgK: pt.avgK,
      avgUtilization: pt.avgUtilization,
      optimalLots: result.lotResults.filter((lr) => lr.status === "optimal").length,
      totalLots: result.lotResults.filter((lr) => lr.status !== "unassigned").length,
    },
  };

  return { lotExplanations, projectExplanation };
}

/**
 * Generate recommendation based on lot result.
 */
function getRecommendation(lr, constraints) {
  if (lr.status === "optimal") {
    return "Lô đã tối ưu — K gần đạt mức tối đa cho phép.";
  }
  if (lr.status === "good") {
    const kSlack = constraints[0].slackGFA;
    return `Có thể tăng thêm ~${fmt(kSlack)} m² DT sàn bằng cách tăng DT điển hình hoặc thêm tòa.`;
  }
  if (lr.status === "low") {
    const kSlack = constraints[0].slackGFA;
    return `K utilization thấp — lãng phí ~${fmt(kSlack)} m² DT sàn tiềm năng. Cần tăng DT điển hình hoặc số tòa.`;
  }
  return "Chưa gán tòa nhà cho lô.";
}

/**
 * Compute trade-off analysis: what happens if you change parameters.
 */
function computeTradeoffs(lr, project, result, typeToLots) {
  const tradeoffs = [];
  const { settings } = project;
  const countedFloors = lr.maxFloors - Math.ceil(lr.maxFloors * settings.deductionRate);

  // For each unique building type in this lot
  const typeIds = [...new Set(lr.buildings.map((b) => b.typeId))];

  typeIds.forEach((typeId) => {
    const affectedLots = typeToLots.get(typeId);
    if (!affectedLots || affectedLots.size <= 1) return;

    const otherLots = [...affectedLots].filter((id) => id !== lr.lot.id);
    const typeBldgs = lr.buildings.filter((b) => b.typeId === typeId);
    const count = typeBldgs.length;
    const currentArea = typeBldgs[0].adjustedTypicalArea;

    // 1% increase in typical area for this type
    const deltaArea = currentArea * 0.01;
    const deltaGFA = deltaArea * countedFloors * count;
    const deltaK = deltaGFA / lr.lot.area;

    // Impact on other lots
    const otherImpacts = otherLots.map((otherLotId) => {
      const otherLR = result.lotResults.find((r) => r.lot.id === otherLotId);
      if (!otherLR) return null;

      const otherCount = otherLR.buildings.filter((b) => b.typeId === typeId).length;
      const otherCountedFloors = otherLR.maxFloors - Math.ceil(otherLR.maxFloors * settings.deductionRate);
      const otherDeltaGFA = deltaArea * otherCountedFloors * otherCount;
      const otherDeltaK = otherDeltaGFA / otherLR.lot.area;
      const newK = otherLR.kAchieved + otherDeltaK;

      return {
        lotId: otherLotId,
        currentK: otherLR.kAchieved,
        newK,
        wouldExceed: newK > otherLR.kMax,
        deltaK: otherDeltaK,
      };
    }).filter(Boolean);

    if (otherImpacts.length > 0) {
      tradeoffs.push({
        typeId,
        typeLabel: typeBldgs[0].type.label,
        scenario: `Tăng DT ${typeBldgs[0].type.label} thêm 1%`,
        thisLot: {
          deltaGFA: +deltaGFA,
          deltaK: +deltaK,
          newK: lr.kAchieved + deltaK,
          wouldExceed: (lr.kAchieved + deltaK) > lr.kMax,
        },
        otherLots: otherImpacts,
        hasConflict: otherImpacts.some((o) => o.wouldExceed) || (lr.kAchieved + deltaK) > lr.kMax,
      });
    }
  });

  return tradeoffs;
}

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("vi-VN");
}
