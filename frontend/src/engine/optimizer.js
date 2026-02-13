// ============================================================
// OPTIMIZATION ENGINE
// Phase B: Iterative optimization to maximize total GFA
// ============================================================
// Core insight: Building types share typical area across lots.
// Changing f_t for type T affects ALL lots containing T.
// This coupling means we cannot optimize lots independently.
//
// Strategy: Monte Carlo perturbation with constraint checking.
// Future: Genetic Algorithm, Linear Programming relaxation.
// ============================================================

import { calculateGFA } from "./directCalculation";

/**
 * Run iterative optimization (Monte Carlo with perturbation).
 *
 * @param {Object} project - Full project config
 * @param {Object} options - Optimization options
 * @param {number} options.iterations - Number of iterations (default 800)
 * @param {number} options.perturbationRange - ±range for area perturbation (default 0.08 = 8%)
 * @param {Function} options.onProgress - Progress callback (iteration, bestGFA)
 * @returns {Object} { result, types, iterations, improvement }
 */
export function runIterativeOptimization(project, options = {}) {
  const {
    iterations = project.settings?.optimizationIterations || 800,
    perturbationRange = project.settings?.perturbationRange || 0.08,
    onProgress = null,
  } = options;

  const { buildingTypes } = project;

  // Baseline: calculate with current config
  const baselineResult = calculateGFA(project);
  const baselineGFA = baselineResult.projectTotal.totalCountedGFA;

  let bestResult = baselineResult;
  let bestTypes = buildingTypes;
  let bestTotalGFA = baselineGFA;

  // Track statistics
  let validCount = 0;
  let improvedCount = 0;

  for (let i = 0; i < iterations; i++) {
    // Generate trial: perturb each building type's typical area
    const trialTypes = buildingTypes.map((bt) => ({
      ...bt,
      typicalArea: bt.typicalArea * (1 - perturbationRange + Math.random() * perturbationRange * 2),
    }));

    // Run calculation with trial types
    const trialProject = { ...project, buildingTypes: trialTypes };
    const trialResult = calculateGFA(trialProject);

    // Check ALL constraints satisfied (small tolerance for floating point)
    const tolerance = 1.001;
    const allValid = trialResult.lotResults.every(
      (lr) =>
        lr.kAchieved <= lr.kMax * tolerance &&
        lr.densityAchieved <= lr.densityMax * tolerance
    );

    // Also check combined FAR ≤ 13
    const combinedFARValid = trialResult.projectTotal.combinedFAR <= 13 * tolerance;

    if (allValid && combinedFARValid) {
      validCount++;
      if (trialResult.projectTotal.totalCountedGFA > bestTotalGFA) {
        bestTotalGFA = trialResult.projectTotal.totalCountedGFA;
        bestResult = trialResult;
        bestTypes = trialTypes;
        improvedCount++;
      }
    }

    // Progress callback every 50 iterations
    if (onProgress && (i + 1) % 50 === 0) {
      onProgress({
        iteration: i + 1,
        totalIterations: iterations,
        bestGFA: bestTotalGFA,
        validCount,
        improvedCount,
        progress: (i + 1) / iterations,
      });
    }
  }

  const improvement = baselineGFA > 0
    ? ((bestTotalGFA - baselineGFA) / baselineGFA) * 100
    : 0;

  return {
    result: bestResult,
    types: bestTypes,
    stats: {
      iterations,
      validCount,
      improvedCount,
      baselineGFA,
      bestGFA: bestTotalGFA,
      improvement, // percentage
    },
  };
}

/**
 * Run a smarter optimization that tries to push each type to
 * maximize utilization across all lots it appears in.
 *
 * Strategy: For each building type, find the tightest constraint
 * across all lots it's assigned to, then set typical area to
 * maximize within that constraint.
 *
 * @param {Object} project
 * @returns {Object} { result, types, stats }
 */
export function runSmartOptimization(project) {
  const { lots, buildingTypes, assignments, settings } = project;
  const { commercialFloors, deductionRate } = settings;

  // Build a map: typeId -> [lotIds where it's used]
  const typeToLots = new Map();
  assignments.forEach((a) => {
    a.buildings.forEach((btId) => {
      if (!typeToLots.has(btId)) typeToLots.set(btId, []);
      typeToLots.get(btId).push(a.lotId);
    });
  });

  // For each type, compute the maximum allowable typical area
  // considering ALL lots it appears in
  const optimizedTypes = buildingTypes.map((bt) => {
    const usedInLots = typeToLots.get(bt.id) || [];
    if (usedInLots.length === 0) return bt;

    let minAllowableArea = Infinity;

    usedInLots.forEach((lotId) => {
      const lot = lots.find((l) => l.id === lotId);
      if (!lot) return;

      const assignment = assignments.find((a) => a.lotId === lotId);
      if (!assignment) return;

      const buildingsInLot = assignment.buildings;
      const numThisType = buildingsInLot.filter((id) => id === bt.id).length;
      const otherTypesArea = buildingsInLot
        .filter((id) => id !== bt.id)
        .reduce((sum, id) => {
          const other = buildingTypes.find((t) => t.id === id);
          return sum + (other ? other.typicalArea : 0);
        }, 0);

      const maxFloors = lot.maxFloors;
      const countedFloors = maxFloors - Math.ceil(maxFloors * deductionRate);

      // K constraint: numThisType * f_t * countedFloors + otherGFA ≤ lot.area * lot.kMax
      const otherCountedGFA = otherTypesArea * countedFloors;
      const remainingK = lot.area * lot.kMax - otherCountedGFA;
      const maxByK = remainingK / (numThisType * countedFloors);

      // Density constraint: numThisType * f_t + otherFootprint ≤ lot.area * lot.densityMax
      const remainingDensity = lot.area * lot.densityMax - otherTypesArea;
      const maxByDensity = remainingDensity / numThisType;

      const maxArea = Math.min(maxByK, maxByDensity);
      if (maxArea < minAllowableArea) {
        minAllowableArea = maxArea;
      }
    });

    // Use 98% of max to leave room for adjustment
    const targetArea = Math.min(minAllowableArea * 0.98, bt.typicalArea * 1.15);
    // Don't go below 85% of original
    const finalArea = Math.max(targetArea, bt.typicalArea * 0.85);

    return { ...bt, typicalArea: finalArea > 0 ? finalArea : bt.typicalArea };
  });

  const result = calculateGFA({ ...project, buildingTypes: optimizedTypes });

  return {
    result,
    types: optimizedTypes,
    stats: {
      method: "smart",
      iterations: 1,
      baselineGFA: calculateGFA(project).projectTotal.totalCountedGFA,
      bestGFA: result.projectTotal.totalCountedGFA,
    },
  };
}

/**
 * Run combined optimization: smart initialization + Monte Carlo refinement.
 * This is the recommended approach.
 *
 * @param {Object} project
 * @param {Object} options
 * @returns {Object} Best result
 */
export function runCombinedOptimization(project, options = {}) {
  const { onProgress } = options;
  const iterations = project.settings?.optimizationIterations || 800;

  // Step 1: Smart optimization as starting point
  const smartResult = runSmartOptimization(project);

  // Step 2: Monte Carlo refinement from smart starting point
  const refinedProject = { ...project, buildingTypes: smartResult.types };
  const mcResult = runIterativeOptimization(refinedProject, {
    iterations,
    onProgress,
  });

  // Step 3: Also run Monte Carlo from original starting point
  const originalMcResult = runIterativeOptimization(project, {
    iterations: Math.floor(iterations / 2),
  });

  // Return the best of all approaches
  const candidates = [
    { label: "smart", ...smartResult },
    { label: "smart+mc", ...mcResult },
    { label: "mc_original", ...originalMcResult },
  ];

  const best = candidates.reduce((a, b) =>
    a.result.projectTotal.totalCountedGFA >= b.result.projectTotal.totalCountedGFA ? a : b
  );

  const baselineGFA = calculateGFA(project).projectTotal.totalCountedGFA;
  const improvement = baselineGFA > 0
    ? ((best.result.projectTotal.totalCountedGFA - baselineGFA) / baselineGFA) * 100
    : 0;

  return {
    result: best.result,
    types: best.types,
    stats: {
      method: best.label,
      totalIterations: iterations + Math.floor(iterations / 2) + 1,
      baselineGFA,
      bestGFA: best.result.projectTotal.totalCountedGFA,
      improvement,
      candidates: candidates.map((c) => ({
        label: c.label,
        gfa: c.result.projectTotal.totalCountedGFA,
      })),
    },
  };
}
