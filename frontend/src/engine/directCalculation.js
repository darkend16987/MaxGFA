// ============================================================
// DIRECT CALCULATION ENGINE — Phase 1 Rewrite
// ============================================================
// Phase 1: Biến quyết định là S_t = tổng DT sàn XD của 1 tòa.
//
// KHÔNG dùng global scale factor. Tính trực tiếp từ S_t đã cho.
// Nếu S_t chưa tối ưu → gọi LP Solver (optimizer).
// Engine này chỉ TÍNH, không SCALE.
//
// Công thức:
//   k_lot = Σ(n_tj × S_t) / area_lot
//   Ràng buộc: k_lot ≤ k_max_lot
//   Mục tiêu: MAX Σ_all (S_t)
//
// Invariant: Cùng mẫu tòa = cùng S_t ở MỌI lô.
// ============================================================

/**
 * Run direct calculation on a project configuration.
 * Simply computes K, MDXD, and GFA from current type areas.
 * NO scaling is performed — use the optimizer to find optimal areas.
 *
 * @param {Object} project - Full project config
 * @returns {Object} { lotResults, typeAggregation, projectTotal }
 */
export function calculateGFA(project) {
  const { lots, buildingTypes, assignments, settings } = project;
  const { kTargetMin = 0.90 } = settings;

  // Build type lookup map
  const typeMap = new Map();
  buildingTypes.forEach((bt) => typeMap.set(bt.id, bt));

  // ============================================================
  // Compute results per lot — no scaling, direct computation
  // ============================================================
  const lotResults = lots.map((lot) => {
    const assignment = assignments.find((a) => a.lotId === lot.id);
    if (!assignment || assignment.buildings.length === 0) {
      return createEmptyLotResult(lot);
    }

    // Resolve building types for this lot
    const buildings = assignment.buildings
      .map((btId) => typeMap.get(btId))
      .filter(Boolean);

    if (buildings.length === 0) {
      return createEmptyLotResult(lot);
    }

    // For Phase 1: S_t is the total GFA per building
    // We use buildingType.totalGFA if available, otherwise compute from typicalArea × totalFloors
    const buildingDetails = buildings.map((bt) => {
      const totalFloors = bt.totalFloors || lot.maxFloors || 30;
      const commercialFloors = bt.commercialFloors ?? settings.commercialFloors ?? 2;
      const residentialFloors = totalFloors - commercialFloors;

      // S_t: total GFA of this building (the key variable in Phase 1)
      // If totalGFA is explicitly set, use it; otherwise compute from typical area
      const totalGFA = bt.totalGFA || bt.typicalArea * totalFloors;

      // For backward compatibility, we still compute typical area
      const typicalArea = bt.typicalArea || (totalFloors > 0 ? totalGFA / totalFloors : 0);

      // Counted GFA (for K calculation) — Phase 1 simplified: same as totalGFA
      // Phase 2 will subtract deductions (KT, PCCC, tum...)
      const deductionRate = settings.deductionRate || 0;
      const countedGFA = totalGFA * (1 - deductionRate);
      const deductionGFA = totalGFA * deductionRate;

      const deductionFloors = deductionRate > 0 ? Math.ceil(totalFloors * deductionRate) : 0;

      return {
        typeId: bt.id,
        type: bt,
        typicalArea,
        totalFloors,
        commercialFloors,
        residentialFloors,
        deductionFloors,
        totalGFA,         // Tổng DT sàn XD (biến Phase 1)
        countedGFA,       // Phần tính vào hệ số K
        deductionGFA,     // Phần trừ (KT, PCCC, tum...)
        // Backward compatibility fields
        adjustedTypicalArea: typicalArea,
        adjustedCountedGFA: countedGFA,
        adjustedTotalGFA: totalGFA,
        adjustedDeductionGFA: deductionGFA,
        commercialGFA: typicalArea * commercialFloors,
        residentialGFA: typicalArea * residentialFloors,
        adjustedCommercialGFA: typicalArea * commercialFloors,
        adjustedResidentialGFA: typicalArea * residentialFloors,
      };
    });

    // Lot sums
    const totalFootprint = buildingDetails.reduce((s, b) => s + b.typicalArea, 0);
    const densityAchieved = lot.area > 0 ? totalFootprint / lot.area : 0;
    const totalCountedGFA = buildingDetails.reduce((s, b) => s + b.countedGFA, 0);
    const totalActualGFA = buildingDetails.reduce((s, b) => s + b.totalGFA, 0);

    // K = total counted GFA / lot area
    const kAchieved = lot.area > 0 ? totalCountedGFA / lot.area : 0;

    const utilizationRate = lot.kMax > 0 ? kAchieved / lot.kMax : 0;
    const isOverK = kAchieved > lot.kMax * 1.001; // small tolerance
    const isOverDensity = lot.densityMax > 0 && densityAchieved > lot.densityMax * 1.001;

    // Status determination
    let status = "low";
    if (isOverK || isOverDensity) status = "over";
    else if (utilizationRate >= kTargetMin) status = "optimal";
    else if (utilizationRate >= 0.80) status = "good";

    return {
      lot,
      buildings: buildingDetails,
      buildingCount: buildings.length,
      totalCountedGFA,
      totalActualGFA,
      kAchieved,
      kMax: lot.kMax,
      densityAchieved,
      densityMax: lot.densityMax,
      utilizationRate,
      scaleFactor: 1, // No scaling in Phase 1 rewrite
      status,
      maxFloors: lot.maxFloors,
      isOverK,
      isOverDensity,
      wasScaled: false,
      // Additional metrics
      remainingKCapacity: lot.kMax - kAchieved,
      remainingDensityCapacity: lot.densityMax > 0 ? lot.densityMax - densityAchieved : Infinity,
      maxAllowableGFA: lot.area * lot.kMax,
    };
  });

  // ============================================================
  // Aggregate by building type
  // ============================================================
  const typeAggregation = {};
  buildingTypes.forEach((bt) => {
    typeAggregation[bt.id] = {
      type: bt,
      count: 0,
      totalCountedGFA: 0,
      totalActualGFA: 0,
      lots: [],
      instances: [],
    };
  });

  lotResults.forEach((lr) => {
    lr.buildings.forEach((b) => {
      const agg = typeAggregation[b.typeId];
      if (agg) {
        agg.count++;
        agg.totalCountedGFA += b.countedGFA;
        agg.totalActualGFA += b.totalGFA;
        agg.lots.push(lr.lot.id);
        agg.instances.push({
          lotId: lr.lot.id,
          adjustedTypicalArea: b.typicalArea,
          adjustedCountedGFA: b.countedGFA,
          adjustedTotalGFA: b.totalGFA,
        });
      }
    });
  });

  // ============================================================
  // Project totals
  // ============================================================
  const totalLandArea = lots.reduce((s, l) => s + l.area, 0);
  const totalCountedGFA = lotResults.reduce((s, lr) => s + lr.totalCountedGFA, 0);
  const totalActualGFA = lotResults.reduce((s, lr) => s + lr.totalActualGFA, 0);
  const totalBuildings = assignments.reduce((s, a) => s + a.buildings.length, 0);
  const avgK = totalLandArea > 0 ? totalCountedGFA / totalLandArea : 0;
  const activeLots = lotResults.filter((lr) => lr.buildings.length > 0);
  const avgUtilization =
    activeLots.length > 0
      ? activeLots.reduce((s, lr) => s + lr.utilizationRate, 0) / activeLots.length
      : 0;

  const projectTotal = {
    totalCountedGFA,
    totalActualGFA,
    totalLandArea,
    totalBuildings,
    totalLots: lots.length,
    avgK,
    avgUtilization,
    globalScaleFactor: 1, // backward compat — no scaling
    combinedFAR: avgK,
    combinedFARCompliant: avgK <= 13,
  };

  return { lotResults, typeAggregation, projectTotal };
}

function createEmptyLotResult(lot) {
  return {
    lot,
    buildings: [],
    buildingCount: 0,
    totalCountedGFA: 0,
    totalActualGFA: 0,
    kAchieved: 0,
    kMax: lot.kMax,
    densityAchieved: 0,
    densityMax: lot.densityMax,
    utilizationRate: 0,
    scaleFactor: 1,
    status: "unassigned",
    maxFloors: lot.maxFloors,
    isOverK: false,
    isOverDensity: false,
    wasScaled: false,
    remainingKCapacity: lot.kMax,
    remainingDensityCapacity: lot.densityMax,
    maxAllowableGFA: lot.area * lot.kMax,
  };
}

/**
 * Validate a project configuration for logical errors.
 * Returns an array of { level: 'error'|'warning', message } objects.
 */
export function validateProject(project) {
  const issues = [];
  const { lots, buildingTypes, assignments } = project;

  if (lots.length === 0) {
    issues.push({ level: "error", message: "Chưa có lô đất nào được cấu hình" });
  }

  if (buildingTypes.length === 0) {
    issues.push({ level: "error", message: "Chưa có mẫu tòa nhà nào được cấu hình" });
  }

  // Check each lot
  lots.forEach((lot) => {
    if (lot.area <= 0) {
      issues.push({ level: "error", message: `Lô ${lot.id}: Diện tích phải > 0` });
    }
    if (lot.kMax <= 0) {
      issues.push({ level: "error", message: `Lô ${lot.id}: Hệ số K max phải > 0` });
    }
  });

  // Check assignments reference valid lots and types
  const typeIds = new Set(buildingTypes.map((bt) => bt.id));
  const lotIds = new Set(lots.map((l) => l.id));

  assignments.forEach((a) => {
    if (!lotIds.has(a.lotId)) {
      issues.push({ level: "error", message: `Phân bổ tham chiếu lô "${a.lotId}" không tồn tại` });
    }
    a.buildings.forEach((btId) => {
      if (!typeIds.has(btId)) {
        issues.push({ level: "warning", message: `Lô ${a.lotId}: Mẫu tòa "${btId}" không tồn tại` });
      }
    });
  });

  // Check for unassigned lots
  const assignedLotIds = new Set(assignments.map((a) => a.lotId));
  lots.forEach((lot) => {
    if (!assignedLotIds.has(lot.id)) {
      issues.push({ level: "warning", message: `Lô ${lot.id} chưa được phân bổ tòa nhà nào` });
    }
  });

  // Check typicalArea within min/max bounds (C4 constraint)
  buildingTypes.forEach((bt) => {
    if (bt.minTypicalArea > 0 && bt.maxTypicalArea > 0 && bt.minTypicalArea > bt.maxTypicalArea) {
      issues.push({ level: "error", message: `Mẫu ${bt.label}: DT tối thiểu (${bt.minTypicalArea}) > DT tối đa (${bt.maxTypicalArea})` });
    }
    if (bt.minTypicalArea > 0 && bt.typicalArea < bt.minTypicalArea) {
      issues.push({ level: "warning", message: `Mẫu ${bt.label}: DT điển hình (${bt.typicalArea.toFixed(0)} m²) thấp hơn giới hạn tối thiểu (${bt.minTypicalArea} m²)` });
    }
    if (bt.maxTypicalArea > 0 && bt.typicalArea > bt.maxTypicalArea) {
      issues.push({ level: "warning", message: `Mẫu ${bt.label}: DT điển hình (${bt.typicalArea.toFixed(0)} m²) cao hơn giới hạn tối đa (${bt.maxTypicalArea} m²)` });
    }
  });

  return issues;
}
