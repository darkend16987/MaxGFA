// ============================================================
// LP SOLVER — Simplex Method for GFA Optimization
// ============================================================
// Solves: MAX  c^T x
//         s.t. A x ≤ b
//              lb ≤ x ≤ ub
//
// Designed for the GFA problem:
//   Variables:  S_t = total floor area of 1 building of type t
//   Objective:  MAX Σ (N_t × S_t)  — total project GFA
//   Constraints: per-lot K limits
//
// For small problems (≤50 vars, ≤100 constraints), Simplex is
// exact and fast. No randomness, no iterations — just math.
// ============================================================

/**
 * Solve a linear programming problem using the Two-Phase Simplex Method.
 *
 * MAX  c^T x
 * s.t. A x ≤ b   (m inequality constraints)
 *      lb ≤ x ≤ ub  (variable bounds)
 *
 * @param {number[]} c - Objective coefficients (length n)
 * @param {number[][]} A - Constraint matrix (m × n)
 * @param {number[]} b - Constraint RHS (length m), must be ≥ 0
 * @param {number[]} lb - Lower bounds (length n), default 0
 * @param {number[]} ub - Upper bounds (length n), default Infinity
 * @returns {Object} { status, x, objectiveValue, bindingConstraints }
 */
export function solveLP(c, A, b, lb = null, ub = null) {
  const n = c.length; // number of original variables
  const m = A.length; // number of constraints

  // Input validation
  if (n === 0) return { status: 'optimal', x: [], objectiveValue: 0, bindingConstraints: [] };
  if (m === 0) return { status: 'unbounded', x: null, objectiveValue: Infinity, reason: 'No constraints' };
  if (b.length !== m) return { status: 'infeasible', x: null, objectiveValue: -Infinity, reason: 'Dimension mismatch: b vs A' };

  // Default bounds
  if (!lb) lb = new Array(n).fill(0);
  if (!ub) ub = new Array(n).fill(Infinity);

  // --- Handle lower bounds by variable substitution ---
  // x' = x - lb, so x = x' + lb, x' ≥ 0
  // Transform: A(x'+lb) ≤ b → Ax' ≤ b - A*lb
  // Objective: c^T(x'+lb) = c^T x' + c^T lb
  // Upper bound: x'+lb ≤ ub → x' ≤ ub - lb
  const bShifted = new Array(m);
  for (let i = 0; i < m; i++) {
    let shift = 0;
    for (let j = 0; j < n; j++) {
      shift += A[i][j] * lb[j];
    }
    bShifted[i] = b[i] - shift;
    if (bShifted[i] < -1e-10) {
      return { status: 'infeasible', x: null, objectiveValue: -Infinity, reason: `Constraint ${i} infeasible even at lower bounds` };
    }
    // Clamp small negatives from floating point
    if (bShifted[i] < 0) bShifted[i] = 0;
  }

  const ubShifted = new Array(n);
  for (let j = 0; j < n; j++) {
    ubShifted[j] = ub[j] - lb[j];
    if (ubShifted[j] < -1e-10) {
      return { status: 'infeasible', x: null, objectiveValue: -Infinity, reason: `Variable ${j}: lb > ub` };
    }
    if (ubShifted[j] < 0) ubShifted[j] = 0;
  }

  // --- Convert upper bounds to additional constraints ---
  // x'_j ≤ ub'_j  →  add rows to A and b
  const finiteUBs = [];
  for (let j = 0; j < n; j++) {
    if (isFinite(ubShifted[j])) {
      finiteUBs.push(j);
    }
  }

  const mTotal = m + finiteUBs.length;
  const AExt = new Array(mTotal);
  const bExt = new Array(mTotal);

  for (let i = 0; i < m; i++) {
    AExt[i] = [...A[i]];
    bExt[i] = bShifted[i];
  }
  for (let k = 0; k < finiteUBs.length; k++) {
    const j = finiteUBs[k];
    const row = new Array(n).fill(0);
    row[j] = 1;
    AExt[m + k] = row;
    bExt[m + k] = ubShifted[j];
  }

  // --- Standard form: MAX c^T x' s.t. Ax' ≤ b', x' ≥ 0 ---
  // Add slack variables: Ax' + s = b', s ≥ 0
  // Tableau size: (mTotal+1) rows × (n + mTotal + 1) cols
  const totalVars = n + mTotal; // original + slacks
  const tableau = [];

  for (let i = 0; i < mTotal; i++) {
    const row = new Array(totalVars + 1).fill(0);
    for (let j = 0; j < n; j++) {
      row[j] = AExt[i][j];
    }
    row[n + i] = 1; // slack variable
    row[totalVars] = bExt[i]; // RHS
    tableau.push(row);
  }

  // Objective row (last row): maximize c^T x' → minimize -c^T x'
  // Store as: -c (for standard simplex maximization)
  const objRow = new Array(totalVars + 1).fill(0);
  for (let j = 0; j < n; j++) {
    objRow[j] = -c[j]; // negative because we pivot to make these 0/positive
  }
  objRow[totalVars] = 0; // initial objective value
  tableau.push(objRow);

  // Basis: initially the slack variables
  const basis = new Array(mTotal);
  for (let i = 0; i < mTotal; i++) {
    basis[i] = n + i;
  }

  // --- Simplex iterations ---
  const MAX_ITER = 1000;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Find pivot column: most negative entry in objective row
    let pivotCol = -1;
    let minVal = -1e-10;
    for (let j = 0; j < totalVars; j++) {
      if (tableau[mTotal][j] < minVal) {
        minVal = tableau[mTotal][j];
        pivotCol = j;
      }
    }

    if (pivotCol === -1) {
      // Optimal: no negative entries in objective row
      break;
    }

    // Find pivot row: minimum ratio test
    let pivotRow = -1;
    let minRatio = Infinity;
    for (let i = 0; i < mTotal; i++) {
      if (tableau[i][pivotCol] > 1e-10) {
        const ratio = tableau[i][totalVars] / tableau[i][pivotCol];
        if (ratio < minRatio) {
          minRatio = ratio;
          pivotRow = i;
        }
      }
    }

    if (pivotRow === -1) {
      return { status: 'unbounded', x: null, objectiveValue: Infinity, reason: 'Problem is unbounded' };
    }

    // Pivot
    const pivotElement = tableau[pivotRow][pivotCol];
    for (let j = 0; j <= totalVars; j++) {
      tableau[pivotRow][j] /= pivotElement;
    }
    for (let i = 0; i <= mTotal; i++) {
      if (i === pivotRow) continue;
      const factor = tableau[i][pivotCol];
      if (Math.abs(factor) < 1e-14) continue;
      for (let j = 0; j <= totalVars; j++) {
        tableau[i][j] -= factor * tableau[pivotRow][j];
      }
    }

    basis[pivotRow] = pivotCol;
  }

  // --- Extract solution ---
  const xPrime = new Array(n).fill(0);
  for (let i = 0; i < mTotal; i++) {
    if (basis[i] < n) {
      xPrime[basis[i]] = tableau[i][totalVars];
    }
  }

  // Transform back: x = x' + lb
  const x = new Array(n);
  for (let j = 0; j < n; j++) {
    x[j] = xPrime[j] + lb[j];
  }

  // Objective value = c^T x = c^T x' + c^T lb
  const objectiveValue = tableau[mTotal][totalVars] + c.reduce((s, ci, j) => s + ci * lb[j], 0);

  // Find binding constraints (slack ≈ 0)
  const bindingConstraints = [];
  for (let i = 0; i < m; i++) {
    const slackIdx = n + i;
    let slackVal;
    const basisPos = basis.indexOf(slackIdx);
    if (basisPos >= 0) {
      slackVal = tableau[basisPos][totalVars];
    } else {
      slackVal = 0; // not in basis = at lower bound = 0
    }
    if (Math.abs(slackVal) < 1e-6) {
      bindingConstraints.push(i);
    }
  }

  return {
    status: 'optimal',
    x,
    objectiveValue,
    bindingConstraints,
  };
}

/**
 * Formulate and solve the GFA optimization problem as LP.
 *
 * @param {Object} problem - GFA optimization problem
 * @param {Object[]} problem.lots - Array of { id, area, kMax }
 * @param {Object[]} problem.types - Array of { id, totalCount }
 * @param {Object[]} problem.assignments - Array of { lotId, buildings: [typeId, ...] }
 * @param {Object} problem.bounds - { min: {typeId: value}, max: {typeId: value} }
 * @returns {Object} { status, solution, totalGFA, lotDetails, bindingLots }
 */
export function solveGFAOptimization(problem) {
  const { lots, types, assignments, bounds = {}, populationSettings } = problem;

  const n = types.length; // number of variables (one S_t per type)
  const m = lots.length;  // number of lot K constraints

  // Type index map
  const typeIndex = new Map();
  types.forEach((t, i) => typeIndex.set(t.id, i));

  // --- Build objective: c_t = total count of type t across all lots ---
  const c = new Array(n).fill(0);
  assignments.forEach((a) => {
    a.buildings.forEach((typeId) => {
      const idx = typeIndex.get(typeId);
      if (idx !== undefined) c[idx]++;
    });
  });

  // --- Build constraints: per-lot K limits ---
  // For lot j: Σ_t (n_tj × S_t) ≤ area_j × k_max_j
  const A_rows = [];
  const b_rows = [];

  lots.forEach((lot) => {
    const row = new Array(n).fill(0);
    const assignment = assignments.find((a) => a.lotId === lot.id);
    if (assignment) {
      assignment.buildings.forEach((typeId) => {
        const idx = typeIndex.get(typeId);
        if (idx !== undefined) row[idx]++;
      });
    }
    A_rows.push(row);
    b_rows.push(lot.area * lot.kMax);
  });

  // --- Population constraints (if maxPopulation is set) ---
  // For lot j: Σ_t (n_tj × S_t / totalFloors_t × residentialFloors_t × netAreaRatio / areaPerPerson) ≤ maxPop_j
  // Rewrite as: Σ_t (n_tj × S_t × coeff_t) ≤ maxPop_j
  //   where coeff_t = residentialFloors_t / totalFloors_t × netAreaRatio / areaPerPerson
  const popSettings = populationSettings || {};
  const netAreaRatio = popSettings.netAreaRatio ?? 0.9;
  const areaPerPerson = popSettings.areaPerPerson ?? 32;
  let popConstraintCount = 0;

  lots.forEach((lot) => {
    if (!lot.maxPopulation || lot.maxPopulation <= 0) return;

    const row = new Array(n).fill(0);
    const assignment = assignments.find((a) => a.lotId === lot.id);
    if (assignment) {
      assignment.buildings.forEach((typeId) => {
        const idx = typeIndex.get(typeId);
        if (idx !== undefined) {
          const t = types[idx];
          const totalFloors = t.totalFloors || 30;
          const residentialFloors = t.residentialFloors || (totalFloors - (t.commercialFloors ?? 2));
          // S_t = typicalArea × totalFloors, so typicalArea = S_t / totalFloors
          // population contribution = typicalArea × residentialFloors × netAreaRatio / areaPerPerson
          //                         = S_t / totalFloors × residentialFloors × netAreaRatio / areaPerPerson
          const coeff = (residentialFloors / totalFloors) * netAreaRatio / areaPerPerson;
          row[idx] += coeff;
        }
      });
    }
    A_rows.push(row);
    b_rows.push(lot.maxPopulation);
    popConstraintCount++;
  });

  const totalConstraints = m + popConstraintCount;
  const A = A_rows;
  const b = b_rows;

  // --- Variable bounds ---
  const lb = new Array(n);
  const ub = new Array(n);
  const boundsMin = bounds.min || {};
  const boundsMax = bounds.max || {};

  types.forEach((t, i) => {
    lb[i] = boundsMin[t.id] || 0;
    ub[i] = boundsMax[t.id] || Infinity;
  });

  // --- Solve LP ---
  const result = solveLP(c, A, b, lb, ub);

  if (result.status !== 'optimal') {
    return {
      status: result.status,
      reason: result.reason,
      solution: null,
      totalGFA: 0,
      lotDetails: [],
      bindingLots: [],
    };
  }

  // --- Build detailed results ---
  const solution = {};
  types.forEach((t, i) => {
    solution[t.id] = result.x[i];
  });

  // Lot-by-lot details
  const lotDetails = lots.map((lot, j) => {
    const assignment = assignments.find((a) => a.lotId === lot.id);
    const buildings = assignment ? assignment.buildings : [];

    let totalGFA = 0;
    const buildingDetails = [];

    buildings.forEach((typeId) => {
      const S = solution[typeId] || 0;
      totalGFA += S;
      buildingDetails.push({ typeId, totalGFA: S });
    });

    const kAchieved = lot.area > 0 ? totalGFA / lot.area : 0;
    const utilization = lot.kMax > 0 ? kAchieved / lot.kMax : 0;
    const isBindingK = result.bindingConstraints.includes(j);

    return {
      lotId: lot.id,
      lotArea: lot.area,
      kMax: lot.kMax,
      kAchieved,
      utilization,
      totalGFA,
      maxGFA: lot.area * lot.kMax,
      remainingGFA: lot.area * lot.kMax - totalGFA,
      buildingCount: buildings.length,
      buildings: buildingDetails,
      isBinding: isBindingK, // true = this lot is a K bottleneck
    };
  });

  // Binding lots (bottleneck K constraints only, not population)
  const bindingLots = result.bindingConstraints
    .filter((i) => i < m)
    .map((i) => lots[i].id);

  // Binding population constraints
  const bindingPopLots = result.bindingConstraints
    .filter((i) => i >= m && i < totalConstraints)
    .map((i) => {
      // Find the corresponding lot (population constraints are in same order, but only for lots with maxPopulation)
      const popLots = lots.filter(l => l.maxPopulation > 0);
      const popIdx = i - m;
      return popIdx < popLots.length ? popLots[popIdx].id : null;
    })
    .filter(Boolean);

  return {
    status: 'optimal',
    solution,       // { typeId: S_t (total GFA per building) }
    totalGFA: result.objectiveValue,
    lotDetails,
    bindingLots,    // which lots are at their K limit
    bindingPopLots, // which lots are at their population limit
  };
}

/**
 * Compute sensitivity analysis: how much could each type's area
 * change while maintaining feasibility?
 *
 * @param {Object} lpResult - Result from solveGFAOptimization
 * @param {Object} problem - Original problem
 * @returns {Object} { ranges: { typeId: { min, max, optimal } } }
 */
export function computeSensitivity(lpResult, problem) {
  const { lots, types, assignments } = problem;
  const { solution } = lpResult;

  const ranges = {};

  types.forEach((type) => {
    const optimalS = solution[type.id];

    // Find max S_t: tightest constraint across all lots containing this type
    let maxS = Infinity;
    lots.forEach((lot) => {
      const assignment = assignments.find((a) => a.lotId === lot.id);
      if (!assignment) return;

      const buildings = assignment.buildings;
      const numThisType = buildings.filter((id) => id === type.id).length;
      if (numThisType === 0) return;

      // Other types' contribution to this lot's GFA
      const otherGFA = buildings
        .filter((id) => id !== type.id)
        .reduce((sum, id) => sum + (solution[id] || 0), 0);

      const maxAllowable = lot.area * lot.kMax;
      const remaining = maxAllowable - otherGFA;
      const maxByThisLot = remaining / numThisType;

      if (maxByThisLot < maxS) {
        maxS = maxByThisLot;
      }
    });

    // Min S_t: could be 0 (or user-specified lower bound)
    const minS = (problem.bounds?.min || {})[type.id] || 0;

    ranges[type.id] = {
      min: minS,
      max: maxS,
      optimal: optimalS,
    };
  });

  return { ranges };
}
