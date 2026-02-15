// ============================================================
// REVERSE CALCULATION ENGINE
// Phase 1.6: Target → Config (inverse problem)
// ============================================================
// Forward: Config → GFA, K
// Reverse: Target GFA/K → Required config changes + impacts
//
// Key challenge: Building types are SHARED across lots.
// Changing typicalArea for type T affects ALL lots using T.
// ============================================================

import { calculateGFA } from "./directCalculation";

/**
 * Reverse calculation: given a target, compute required changes.
 *
 * @param {Object} params
 * @param {Object} params.project - Current project config
 * @param {Object} params.result - Current calc result
 * @param {string} params.lotId - Target lot ID
 * @param {Object} params.target - ONE OF:
 *   { totalCountedGFA: number } - Target total counted GFA for the lot
 *   { kTarget: number } - Target K ratio for the lot
 *   { utilizationTarget: number } - Target utilization (0-1) for the lot
 * @param {string[]} [params.lockedTypes=[]] - Type IDs not allowed to change
 * @returns {Object} ReverseResult
 */
export function reverseCalculate({ project, result, lotId, target, lockedTypes = [] }) {
  const { lots, buildingTypes, assignments, settings } = project;
  const { deductionRate, commercialFloors } = settings;

  const lot = lots.find((l) => l.id === lotId);
  if (!lot) return { feasible: false, error: "Lô không tồn tại" };

  const lr = result.lotResults.find((r) => r.lot.id === lotId);
  if (!lr || lr.status === "unassigned") {
    return { feasible: false, error: "Lô chưa được gán tòa nhà" };
  }

  // Resolve target to totalCountedGFA
  let targetGFA;
  if (target.totalCountedGFA != null) {
    targetGFA = target.totalCountedGFA;
  } else if (target.kTarget != null) {
    targetGFA = target.kTarget * lot.area;
  } else if (target.utilizationTarget != null) {
    targetGFA = target.utilizationTarget * lot.kMax * lot.area;
  } else {
    return { feasible: false, error: "Thiếu target (totalCountedGFA, kTarget, hoặc utilizationTarget)" };
  }

  const currentGFA = lr.totalCountedGFA;
  const requiredK = targetGFA / lot.area;

  // Pre-flight checks
  if (requiredK > lot.kMax) {
    // Compute max feasible
    const maxFeasibleGFA = lot.kMax * lot.area;
    return {
      feasible: false,
      error: `K cần đạt = ${requiredK.toFixed(2)} > K max = ${lot.kMax.toFixed(2)}`,
      maxFeasibleGFA,
      maxFeasibleK: lot.kMax,
      suggestion: `GFA tối đa cho lô này = ${Math.round(maxFeasibleGFA).toLocaleString("vi-VN")} m² (K = ${lot.kMax.toFixed(2)})`,
    };
  }

  if (targetGFA < 0) {
    return { feasible: false, error: "Target GFA không thể âm" };
  }

  // Calculate scale factor needed
  if (currentGFA === 0) {
    return { feasible: false, error: "Lô hiện không có GFA (không có tòa nhà)" };
  }

  const scaleFactor = targetGFA / currentGFA;

  // Determine which types need to change
  const assignment = assignments.find((a) => a.lotId === lotId);
  const typeIdsInLot = [...new Set(assignment.buildings)];
  const changeableTypes = typeIdsInLot.filter((id) => !lockedTypes.includes(id));
  const lockedTypesInLot = typeIdsInLot.filter((id) => lockedTypes.includes(id));

  if (changeableTypes.length === 0) {
    const reason = typeIdsInLot.length === 0
      ? "Lô không có tòa nhà để thay đổi"
      : "Tất cả mẫu tòa trong lô đều bị khóa";
    return { feasible: false, error: reason };
  }

  // Compute GFA contribution from locked vs changeable types
  const countedFloors = lr.maxFloors - Math.ceil(lr.maxFloors * deductionRate);
  let lockedGFA = 0;
  let changeableGFA = 0;

  lr.buildings.forEach((b) => {
    if (lockedTypes.includes(b.typeId)) {
      lockedGFA += b.adjustedCountedGFA;
    } else {
      changeableGFA += b.adjustedCountedGFA;
    }
  });

  const requiredChangeableGFA = targetGFA - lockedGFA;
  if (requiredChangeableGFA < 0) {
    return {
      feasible: false,
      error: "Các mẫu tòa bị khóa đã tạo ra GFA lớn hơn target",
    };
  }

  const changeableScaleFactor = changeableGFA > 0 ? requiredChangeableGFA / changeableGFA : 1;

  // Compute new typical areas for changeable types
  const requiredTypicalAreas = {};
  const originalTypicalAreas = {};

  changeableTypes.forEach((typeId) => {
    const bt = buildingTypes.find((t) => t.id === typeId);
    if (!bt) return;

    originalTypicalAreas[typeId] = bt.typicalArea;

    // The buildings of this type in the target lot
    const bldgs = lr.buildings.filter((b) => b.typeId === typeId);
    if (bldgs.length === 0) return;

    // New typical area = current adjusted × scale factor
    const currentAdjusted = bldgs[0].adjustedTypicalArea;
    const newArea = currentAdjusted * changeableScaleFactor;
    requiredTypicalAreas[typeId] = newArea;
  });

  // Now simulate the impact on ALL lots
  const trialTypes = buildingTypes.map((bt) => {
    if (requiredTypicalAreas[bt.id] != null) {
      return { ...bt, typicalArea: requiredTypicalAreas[bt.id] };
    }
    return bt;
  });

  const trialProject = { ...project, buildingTypes: trialTypes };
  const trialResult = calculateGFA(trialProject);

  // Analyze impact on each lot
  const impactOnLots = {};
  let allFeasible = true;
  const warnings = [];

  trialResult.lotResults.forEach((trialLR) => {
    const origLR = result.lotResults.find((r) => r.lot.id === trialLR.lot.id);
    if (!origLR) return;

    const kBefore = origLR.kAchieved;
    const kAfter = trialLR.kAchieved;
    const densityBefore = origLR.densityAchieved;
    const densityAfter = trialLR.densityAchieved;
    const gfaBefore = origLR.totalCountedGFA;
    const gfaAfter = trialLR.totalCountedGFA;

    const kExceeds = kAfter > trialLR.kMax;
    const densityExceeds = densityAfter > trialLR.densityMax;

    if (trialLR.lot.id !== lotId && (kExceeds || densityExceeds)) {
      allFeasible = false;
      if (kExceeds) {
        warnings.push(`${trialLR.lot.id}: K = ${kAfter.toFixed(2)} vượt K max = ${trialLR.kMax.toFixed(2)}`);
      }
      if (densityExceeds) {
        warnings.push(`${trialLR.lot.id}: MĐXD = ${(densityAfter * 100).toFixed(1)}% vượt max = ${(trialLR.densityMax * 100).toFixed(0)}%`);
      }
    }

    impactOnLots[trialLR.lot.id] = {
      lotId: trialLR.lot.id,
      lotName: trialLR.lot.name,
      isTarget: trialLR.lot.id === lotId,
      kBefore,
      kAfter,
      kMax: trialLR.kMax,
      kDelta: kAfter - kBefore,
      densityBefore,
      densityAfter,
      densityMax: trialLR.densityMax,
      gfaBefore,
      gfaAfter,
      gfaDelta: gfaAfter - gfaBefore,
      utilizationBefore: origLR.utilizationRate,
      utilizationAfter: trialLR.utilizationRate,
      statusBefore: origLR.status,
      statusAfter: trialLR.status,
      exceedsK: kExceeds,
      exceedsDensity: densityExceeds,
    };
  });

  // Check combined FAR
  const combinedFARAfter = trialResult.projectTotal.combinedFAR;
  const farExceeds = combinedFARAfter > 13;
  if (farExceeds) {
    allFeasible = false;
    warnings.push(`FAR tổng = ${combinedFARAfter.toFixed(2)} vượt giới hạn 13`);
  }

  // Compute change summary for types
  const typeChanges = changeableTypes.map((typeId) => {
    const bt = buildingTypes.find((t) => t.id === typeId);
    const oldArea = originalTypicalAreas[typeId];
    const newArea = requiredTypicalAreas[typeId];
    const pctChange = oldArea > 0 ? ((newArea - oldArea) / oldArea) * 100 : 0;
    const affectedLots = [];

    assignments.forEach((a) => {
      if (a.buildings.includes(typeId)) {
        affectedLots.push(a.lotId);
      }
    });

    return {
      typeId,
      typeLabel: bt?.label || typeId,
      oldTypicalArea: oldArea,
      newTypicalArea: newArea,
      percentChange: pctChange,
      affectedLots,
    };
  });

  return {
    feasible: allFeasible,
    warnings,

    // Target summary
    target: {
      lotId,
      lotName: lot.name,
      targetGFA,
      currentGFA,
      deltaGFA: targetGFA - currentGFA,
      requiredK,
      currentK: lr.kAchieved,
    },

    // Required type changes
    typeChanges,
    requiredTypicalAreas,

    // Impact analysis
    impactOnLots,

    // Trial result (for preview)
    trialResult,
    trialTypes,

    // Project-level
    projectImpact: {
      gfaBefore: result.projectTotal.totalCountedGFA,
      gfaAfter: trialResult.projectTotal.totalCountedGFA,
      gfaDelta: trialResult.projectTotal.totalCountedGFA - result.projectTotal.totalCountedGFA,
      farBefore: result.projectTotal.combinedFAR,
      farAfter: combinedFARAfter,
      farExceeds,
    },
  };
}

/**
 * Find the maximum feasible GFA for a lot (considering all constraints).
 *
 * @param {Object} params
 * @param {Object} params.project
 * @param {Object} params.result
 * @param {string} params.lotId
 * @param {string[]} [params.lockedTypes=[]]
 * @returns {Object} { maxGFA, maxK, limitedBy }
 */
export function findMaxFeasibleGFA({ project, result, lotId, lockedTypes = [] }) {
  const lot = project.lots.find((l) => l.id === lotId);
  if (!lot) return null;

  // Binary search for max feasible GFA
  const lr = result.lotResults.find((r) => r.lot.id === lotId);
  if (!lr || lr.status === "unassigned") return null;

  let low = 0;
  let high = lot.kMax * lot.area * 1.5; // generous upper bound
  let bestFeasible = null;

  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const trial = reverseCalculate({
      project,
      result,
      lotId,
      target: { totalCountedGFA: mid },
      lockedTypes,
    });

    if (trial.feasible) {
      bestFeasible = { maxGFA: mid, maxK: mid / lot.area, result: trial };
      low = mid;
    } else {
      high = mid;
    }
  }

  if (bestFeasible) {
    bestFeasible.limitedBy = bestFeasible.maxK >= lot.kMax * 0.999 ? "K max" : "Shared type constraint";
  }

  return bestFeasible;
}
