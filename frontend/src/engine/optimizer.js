// ============================================================
// OPTIMIZATION ENGINE — Phase 1 Rewrite
// ============================================================
// Core insight: Bài toán Phase 1 là LP thuần túy.
//
//   MAX  Σ (N_t × S_t)     — tổng diện tích sàn XD
//   s.t. Σ(n_tj × S_t) / area_j ≤ k_max_j   — per-lot K
//        S_t_min ≤ S_t ≤ S_t_max              — bounds
//
// LP cho nghiệm CHÍNH XÁC, không cần Monte Carlo random.
// Monte Carlo được giữ lại như fallback cho bài toán phức tạp.
// ============================================================

import { calculateGFA } from "./directCalculation";
import { solveGFAOptimization, computeSensitivity } from "./lpSolver";

/**
 * Run LP-based optimization (recommended for Phase 1).
 * Exact solution, no randomness.
 *
 * @param {Object} project - Full project config
 * @param {Object} options - { boundsRange: 0.5 (±50% of current) }
 * @returns {Object} { result, types, stats, sensitivity }
 */
export function runLPOptimization(project, options = {}) {
  const { buildingTypes, lots, assignments, settings } = project;
  const { boundsRange = 0.5 } = options;

  // Baseline
  const baselineResult = calculateGFA(project);
  const baselineGFA = baselineResult.projectTotal.totalCountedGFA;

  // Build LP problem
  const types = buildingTypes.map((bt) => ({
    id: bt.id,
    totalFloors: bt.totalFloors || settings.maxFloors || 30,
  }));

  // Compute current S_t for each type (totalGFA per building)
  const currentS = {};
  buildingTypes.forEach((bt) => {
    const floors = bt.totalFloors || lots[0]?.maxFloors || 30;
    currentS[bt.id] = bt.totalGFA || bt.typicalArea * floors;
  });

  // Set bounds: allow ±boundsRange around current S_t
  const boundsMin = {};
  const boundsMax = {};
  buildingTypes.forEach((bt) => {
    const S = currentS[bt.id];
    boundsMin[bt.id] = S * (1 - boundsRange);
    boundsMax[bt.id] = S * (1 + boundsRange);
  });

  // Override with user-specified bounds if any
  if (options.bounds) {
    if (options.bounds.min) Object.assign(boundsMin, options.bounds.min);
    if (options.bounds.max) Object.assign(boundsMax, options.bounds.max);
  }

  const problem = {
    lots: lots.map((l) => ({ id: l.id, area: l.area, kMax: l.kMax })),
    types,
    assignments,
    bounds: { min: boundsMin, max: boundsMax },
  };

  // Solve LP
  const lpResult = solveGFAOptimization(problem);

  if (lpResult.status !== 'optimal') {
    return {
      result: baselineResult,
      types: buildingTypes,
      stats: {
        method: "lp_failed",
        reason: lpResult.reason || lpResult.status,
        baselineGFA,
        bestGFA: baselineGFA,
        improvement: 0,
      },
      sensitivity: null,
    };
  }

  // Build optimized building types with new S_t values
  const optimizedTypes = buildingTypes.map((bt) => {
    const optimalS = lpResult.solution[bt.id];
    const floors = bt.totalFloors || lots[0]?.maxFloors || 30;
    const newTypicalArea = optimalS / floors;

    return {
      ...bt,
      typicalArea: newTypicalArea,
      totalGFA: optimalS,
    };
  });

  // Run calculation with optimized types
  const optimizedProject = { ...project, buildingTypes: optimizedTypes };
  const result = calculateGFA(optimizedProject);

  // Sensitivity analysis
  const sensitivity = computeSensitivity(lpResult, problem);

  const improvement = baselineGFA > 0
    ? ((result.projectTotal.totalCountedGFA - baselineGFA) / baselineGFA) * 100
    : 0;

  return {
    result,
    types: optimizedTypes,
    stats: {
      method: "lp_exact",
      baselineGFA,
      bestGFA: result.projectTotal.totalCountedGFA,
      improvement,
      bindingLots: lpResult.bindingLots,
      iterations: 1, // LP is single-pass
    },
    sensitivity,
    lpResult, // raw LP output for debugging
  };
}

/**
 * Run iterative optimization (Monte Carlo with perturbation).
 * Kept as fallback for complex/non-linear constraints.
 *
 * @param {Object} project - Full project config
 * @param {Object} options
 * @returns {Object} { result, types, stats }
 */
export function runIterativeOptimization(project, options = {}) {
  const {
    iterations = project.settings?.optimizationIterations || 800,
    perturbationRange = project.settings?.perturbationRange || 0.08,
    onProgress = null,
  } = options;

  const { buildingTypes } = project;

  // Baseline
  const baselineResult = calculateGFA(project);
  const baselineGFA = baselineResult.projectTotal.totalCountedGFA;
  const baselineValid = baselineResult.lotResults.every((lr) => lr.status !== "over");

  let bestResult = baselineResult;
  let bestTypes = buildingTypes;
  // If baseline violates constraints, set bestTotalGFA to 0 so any valid trial is accepted
  let bestTotalGFA = baselineValid ? baselineGFA : 0;
  let bestIsValid = baselineValid;

  let validCount = 0;
  let improvedCount = 0;

  for (let i = 0; i < iterations; i++) {
    // Generate trial: perturb each building type's typical area (and totalGFA if set)
    const trialTypes = buildingTypes.map((bt) => {
      const factor = 1 - perturbationRange + Math.random() * perturbationRange * 2;
      return {
        ...bt,
        typicalArea: bt.typicalArea * factor,
        ...(bt.totalGFA ? { totalGFA: bt.totalGFA * factor } : {}),
      };
    });

    const trialProject = { ...project, buildingTypes: trialTypes };
    const trialResult = calculateGFA(trialProject);

    // Check ALL constraints satisfied
    const allValid = trialResult.lotResults.every(
      (lr) => lr.status !== "over"
    );

    if (allValid) {
      validCount++;
      const trialGFA = trialResult.projectTotal.totalCountedGFA;
      // Accept if: (a) better GFA among valid solutions, or (b) first valid when baseline was invalid
      if (trialGFA > bestTotalGFA || !bestIsValid) {
        bestTotalGFA = trialGFA;
        bestResult = trialResult;
        bestTypes = trialTypes;
        bestIsValid = true;
        improvedCount++;
      }
    }

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
      method: "monte_carlo",
      iterations,
      validCount,
      improvedCount,
      baselineGFA,
      bestGFA: bestTotalGFA,
      improvement,
    },
  };
}

/**
 * Run combined optimization: LP first, then Monte Carlo refinement.
 * LP gives exact optimum for linear constraints.
 * MC can explore non-linear edge cases.
 *
 * @param {Object} project
 * @param {Object} options
 * @returns {Object} Best result across all methods
 */
export function runCombinedOptimization(project, options = {}) {
  const { onProgress } = options;
  const iterations = project.settings?.optimizationIterations || 800;

  // Step 1: LP optimization (exact solution)
  const lpResult = runLPOptimization(project, {
    boundsRange: options.boundsRange || 0.5,
  });

  // Step 2: Monte Carlo from LP starting point (refinement)
  const lpProject = { ...project, buildingTypes: lpResult.types };
  const mcFromLP = runIterativeOptimization(lpProject, {
    iterations: Math.floor(iterations / 2),
    onProgress,
  });

  // Step 3: Monte Carlo from original (exploration)
  const mcOriginal = runIterativeOptimization(project, {
    iterations: Math.floor(iterations / 2),
  });

  // Return the best VALID result across all methods
  // A result is "valid" if no lot violates constraints (status !== "over")
  const candidates = [
    { label: "lp_exact", ...lpResult },
    { label: "lp+mc", ...mcFromLP },
    { label: "mc_original", ...mcOriginal },
  ];

  // Check validity: all lots must satisfy constraints
  const isValid = (candidate) =>
    candidate.result.lotResults.every((lr) => lr.status !== "over");

  const validCandidates = candidates.filter(isValid);

  // Prefer valid results; only fall back to invalid if none are valid
  const pool = validCandidates.length > 0 ? validCandidates : candidates;

  const best = pool.reduce((a, b) =>
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
      totalIterations: iterations + 1,
      baselineGFA,
      bestGFA: best.result.projectTotal.totalCountedGFA,
      improvement,
      candidates: candidates.map((c) => ({
        label: c.label,
        gfa: c.result.projectTotal.totalCountedGFA,
      })),
      bindingLots: lpResult.stats.bindingLots || [],
    },
    sensitivity: lpResult.sensitivity,
  };
}

// Keep backward compat: runSmartOptimization → delegates to LP
export function runSmartOptimization(project) {
  return runLPOptimization(project);
}
