// ============================================================
// DIRECT CALCULATION ENGINE
// Phase A: Compute GFA, K, MĐXD for current configuration
// ============================================================
// INVARIANT: Cùng mẫu tòa (building type) = cùng diện tích
// điển hình ở MỌI lô. Scaling phải GLOBAL, không per-lot.
//
// Two-pass approach:
//   Pass 1: Scan all lots → find global min scale factor
//   Pass 2: Apply global scale → compute final results
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

  // ============================================================
  // PASS 1: Find GLOBAL scale factor
  // Cùng mẫu = cùng diện tích → phải dùng chung 1 scale factor
  // cho toàn bộ dự án thay vì scale riêng từng lô.
  // ============================================================
  let globalScaleFactor = 1;

  lots.forEach((lot) => {
    const assignment = assignments.find((a) => a.lotId === lot.id);
    if (!assignment || assignment.buildings.length === 0) return;

    const buildings = assignment.buildings
      .map((btId) => typeMap.get(btId))
      .filter(Boolean);
    if (buildings.length === 0) return;

    const maxFloors = lot.maxFloors;
    const totalFootprint = buildings.reduce((sum, b) => sum + b.typicalArea, 0);

    // K constraint: sum(typicalArea × maxFloors) / lotArea ≤ kMax
    const rawK = (totalFootprint * maxFloors) / lot.area;
    if (rawK > lot.kMax) {
      globalScaleFactor = Math.min(globalScaleFactor, lot.kMax / rawK);
    }

    // Density constraint: sum(typicalArea) / lotArea ≤ densityMax
    const rawDensity = totalFootprint / lot.area;
    if (rawDensity > lot.densityMax) {
      globalScaleFactor = Math.min(globalScaleFactor, lot.densityMax / rawDensity);
    }
  });

  // ============================================================
  // PASS 2: Compute results using globally-consistent areas
  // adjustedTypicalArea = typicalArea × globalScaleFactor
  // → Cùng mẫu tòa ở bất kỳ lô nào đều cùng giá trị
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

    const maxFloors = lot.maxFloors;
    const residentialFloors = maxFloors - commercialFloors;
    const deductionFloors = Math.ceil(maxFloors * deductionRate);

    // Max GFA allowed by K constraint
    const maxGFAByK = lot.area * lot.kMax;

    // Calculate GFA per building using globally-scaled area
    const buildingDetails = buildings.map((bt) => {
      const effArea = bt.typicalArea * globalScaleFactor;

      const commercialGFA = effArea * commercialFloors;
      const residentialGFA = effArea * residentialFloors;
      const countedGFA = commercialGFA + residentialGFA; // Tính vào hệ số K
      const deductionGFA = effArea * deductionFloors; // Trừ: KT, PCCC, tum...
      const totalGFA = countedGFA + deductionGFA; // Tổng thực tế

      return {
        typeId: bt.id,
        type: bt,
        typicalArea: bt.typicalArea, // Giá trị gốc từ config
        adjustedTypicalArea: effArea, // Sau scaling (= gốc × globalScale)
        totalFloors: maxFloors,
        commercialFloors,
        residentialFloors,
        deductionFloors,
        commercialGFA,
        residentialGFA,
        countedGFA,
        deductionGFA,
        totalGFA,
        // Compatibility fields — same values, using effective area
        adjustedCountedGFA: countedGFA,
        adjustedTotalGFA: totalGFA,
        adjustedDeductionGFA: deductionGFA,
        adjustedCommercialGFA: commercialGFA,
        adjustedResidentialGFA: residentialGFA,
      };
    });

    // Lot sums (using effective areas)
    const totalFootprint = buildingDetails.reduce((s, b) => s + b.adjustedTypicalArea, 0);
    const densityAchieved = totalFootprint / lot.area;
    const totalCountedGFA = buildingDetails.reduce((s, b) => s + b.countedGFA, 0);
    const totalActualGFA = buildingDetails.reduce((s, b) => s + b.totalGFA, 0);
    const kAchieved = totalCountedGFA / lot.area;

    // Check if ORIGINAL (unscaled) config would violate constraints
    const rawFootprint = buildings.reduce((s, b) => s + b.typicalArea, 0);
    const isOverK = (rawFootprint * maxFloors) / lot.area > lot.kMax;
    const isOverDensity = rawFootprint / lot.area > lot.densityMax;

    const utilizationRate = lot.kMax > 0 ? kAchieved / lot.kMax : 0;

    // Status determination
    let status = "low";
    if (utilizationRate >= kTargetMin) status = "optimal";
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
      scaleFactor: globalScaleFactor,
      status,
      maxFloors,
      isOverK,
      isOverDensity,
      wasScaled: globalScaleFactor < 1,
      // Additional metrics
      remainingKCapacity: lot.kMax - kAchieved,
      remainingDensityCapacity: lot.densityMax - densityAchieved,
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
    globalScaleFactor,
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
