// ============================================================
// DIRECT CALCULATION ENGINE
// Phase A: Compute GFA, K, MĐXD for current configuration
// ============================================================
// This is the core computation that runs every time config changes.
// It takes a project configuration and returns detailed results
// for each lot, each building, and project-wide aggregates.
// ============================================================

/**
 * Run direct calculation on a project configuration.
 *
 * @param {Object} project - Full project config
 * @param {Object[]} project.lots - Array of lot definitions
 * @param {Object[]} project.buildingTypes - Array of building type templates
 * @param {Object[]} project.assignments - Array of {lotId, buildings[]}
 * @param {Object} project.settings - Global settings
 * @returns {Object} { lotResults, typeAggregation, projectTotal }
 */
export function calculateGFA(project) {
  const { lots, buildingTypes, assignments, settings } = project;
  const { deductionRate, commercialFloors, kTargetMin } = settings;

  // Build type lookup map
  const typeMap = new Map();
  buildingTypes.forEach((bt) => typeMap.set(bt.id, bt));

  // Calculate each lot
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

    const maxFloors = lot.maxFloors;
    const residentialFloors = maxFloors - commercialFloors;
    const deductionFloors = Math.ceil(maxFloors * deductionRate);

    // Compute total footprint (sum of typical areas for density calculation)
    const totalFootprint = buildings.reduce((sum, b) => sum + b.typicalArea, 0);
    const densityAchieved = totalFootprint / lot.area;

    // Max GFA allowed by K constraint
    const maxGFAByK = lot.area * lot.kMax;

    // Calculate GFA per building
    const buildingDetails = buildings.map((bt) => {
      const commercialGFA = bt.typicalArea * commercialFloors;
      const residentialGFA = bt.typicalArea * residentialFloors;
      const countedGFA = commercialGFA + residentialGFA; // Tính vào hệ số K
      const deductionGFA = bt.typicalArea * deductionFloors; // Trừ: KT, PCCC, tum...
      const totalGFA = countedGFA + deductionGFA; // Tổng thực tế

      return {
        typeId: bt.id,
        type: bt,
        typicalArea: bt.typicalArea,
        totalFloors: maxFloors,
        commercialFloors,
        residentialFloors,
        deductionFloors,
        commercialGFA,
        residentialGFA,
        countedGFA,
        deductionGFA,
        totalGFA,
      };
    });

    // Sum for the lot
    const totalCountedGFA = buildingDetails.reduce((s, b) => s + b.countedGFA, 0);
    const totalActualGFA = buildingDetails.reduce((s, b) => s + b.totalGFA, 0);
    const kAchieved = totalCountedGFA / lot.area;

    // Check constraint violations
    const isOverK = kAchieved > lot.kMax;
    const isOverDensity = densityAchieved > lot.densityMax;

    // Auto-scale if constraints violated
    let scaleFactor = 1;
    if (isOverK) {
      scaleFactor = Math.min(scaleFactor, maxGFAByK / totalCountedGFA);
    }
    if (isOverDensity) {
      scaleFactor = Math.min(scaleFactor, (lot.area * lot.densityMax) / totalFootprint);
    }

    // Apply scale factor
    const adjustedBuildings = buildingDetails.map((b) => ({
      ...b,
      adjustedTypicalArea: b.typicalArea * scaleFactor,
      adjustedCountedGFA: b.countedGFA * scaleFactor,
      adjustedTotalGFA: b.totalGFA * scaleFactor,
      adjustedDeductionGFA: b.deductionGFA * scaleFactor,
      adjustedCommercialGFA: b.commercialGFA * scaleFactor,
      adjustedResidentialGFA: b.residentialGFA * scaleFactor,
    }));

    const adjTotalCounted = adjustedBuildings.reduce((s, b) => s + b.adjustedCountedGFA, 0);
    const adjTotalActual = adjustedBuildings.reduce((s, b) => s + b.adjustedTotalGFA, 0);
    const adjK = adjTotalCounted / lot.area;
    const adjDensity = adjustedBuildings.reduce((s, b) => s + b.adjustedTypicalArea, 0) / lot.area;
    const utilizationRate = adjK / lot.kMax;

    // Status determination
    let status = "low";
    if (utilizationRate >= kTargetMin) status = "optimal";
    else if (utilizationRate >= 0.80) status = "good";

    return {
      lot,
      buildings: adjustedBuildings,
      buildingCount: buildings.length,
      totalCountedGFA: adjTotalCounted,
      totalActualGFA: adjTotalActual,
      kAchieved: adjK,
      kMax: lot.kMax,
      densityAchieved: adjDensity,
      densityMax: lot.densityMax,
      utilizationRate,
      scaleFactor,
      status,
      maxFloors,
      isOverK,
      isOverDensity,
      wasScaled: scaleFactor < 1,
      // Additional metrics
      remainingKCapacity: lot.kMax - adjK,
      remainingDensityCapacity: lot.densityMax - adjDensity,
      maxAllowableGFA: maxGFAByK,
    };
  });

  // Aggregate by building type
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
        agg.totalCountedGFA += b.adjustedCountedGFA;
        agg.totalActualGFA += b.adjustedTotalGFA;
        agg.lots.push(lr.lot.id);
        agg.instances.push({
          lotId: lr.lot.id,
          adjustedTypicalArea: b.adjustedTypicalArea,
          adjustedCountedGFA: b.adjustedCountedGFA,
          adjustedTotalGFA: b.adjustedTotalGFA,
        });
      }
    });
  });

  // Project totals
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
    // Check combined FAR constraint (QCVN 01:2021 Mục 2.6.3: ≤ 13 lần)
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
    if (lot.densityMax <= 0 || lot.densityMax > 1) {
      issues.push({ level: "warning", message: `Lô ${lot.id}: Mật độ XD max nên trong khoảng (0, 1]` });
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

  return issues;
}
