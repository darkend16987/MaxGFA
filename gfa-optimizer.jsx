import { useState, useCallback, useMemo, useEffect, useRef } from "react";

// ============================================================
// GFA OPTIMIZER - Phase 1: Total GFA Optimization Engine
// For Vietnamese Construction Consulting (INNO JSC)
// ============================================================

// --- UTILITY: Vietnamese number formatting ---
const fmtNum = (n, d = 2) => {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
};
const fmtPct = (n) => (n == null ? "—" : (n * 100).toFixed(2) + "%");

// --- LEGAL RULES ENGINE ---
const LEGAL_RULES = {
  QCVN_01_2021: {
    id: "QCVN_01_2021",
    name: "QCVN 01:2021/BXD",
    rules: {
      maxCombinedFAR: 13, // Hệ số SDD chung đế+tháp không vượt 13 lần
      deductions: [
        { id: "basement_parking", label: "Tầng hầm (đỗ xe, kỹ thuật, PCCC, lánh nạn)", auto: true },
        { id: "mep_floors", label: "Tầng kỹ thuật (MEP)", auto: true },
        { id: "fire_escape", label: "Gian lánh nạn, thang thoát hiểm", auto: true },
        { id: "elevator_unused", label: "Giếng thang máy tầng không dừng", auto: true },
        { id: "roof_non_commercial", label: "Mái (không kinh doanh)", auto: true },
      ],
    },
  },
  CV_3633_BXD: {
    id: "CV_3633_BXD",
    name: "CV 3633/BXD-KHCN (08/2023)",
    rules: {
      separateDensityForPodiumTower: true,
      elevatorUnusedFloorExcluded: true,
      poolOnRoofCounted: true,
    },
  },
  BB_CUC_QLHDXD: {
    id: "BB_CUC_QLHDXD",
    name: "Biên bản Cục QLHĐXD (05/2024)",
    rules: {
      mixedFloorPartialDeduction: true,
      openSpaceNotCounted: true,
      structuralColumnsInTransitNotDeducted: true,
    },
  },
  CV_1637_BXD: {
    id: "CV_1637_BXD",
    name: "CV 1637/BXD-KHCN (05/2022)",
    rules: {
      detailedDeductions: true,
    },
  },
};

// --- BUILDING SHAPE DEFINITIONS ---
const BUILDING_SHAPES = {
  I: { label: "Chữ I", icon: "▯", color: "#2563eb", defaultRatio: { w: 85, d: 19 } },
  L: { label: "Chữ L", icon: "⌐", color: "#7c3aed", defaultRatio: { w: 60, d: 46 } },
  H: { label: "Chữ H", icon: "ꞁꞁ", color: "#059669", defaultRatio: { w: 60, d: 40 } },
  U: { label: "Chữ U", icon: "⊔", color: "#d97706", defaultRatio: { w: 55, d: 40 } },
  Z: { label: "Chữ Z", icon: "Z", color: "#dc2626", defaultRatio: { w: 75, d: 29 } },
  SQ: { label: "Vuông", icon: "□", color: "#0891b2", defaultRatio: { w: 36, d: 36 } },
};

// --- DEFAULT PROJECT DATA (sample) ---
const DEFAULT_PROJECT = {
  name: "Dự án mẫu",
  lots: [
    { id: "A", name: "Lô A", area: 24474, kMax: 5.30, densityMax: 0.40, floorRange: [3, 30] },
    { id: "B", name: "Lô B", area: 18682, kMax: 4.63, densityMax: 0.35, floorRange: [3, 30] },
    { id: "C", name: "Lô C", area: 28890, kMax: 5.98, densityMax: 0.40, floorRange: [3, 30] },
    { id: "D", name: "Lô D", area: 26850, kMax: 6.44, densityMax: 0.40, floorRange: [3, 30] },
  ],
  buildingTypes: [
    { id: "L_short", shape: "L", label: "L ngắn", typicalArea: 1472.67, variants: [] },
    { id: "L_long", shape: "L", label: "L dài", typicalArea: 1778.53, variants: [] },
    { id: "Z1", shape: "Z", label: "Z", typicalArea: 1472.67, variants: [] },
    { id: "I1", shape: "I", label: "I1", typicalArea: 1472.67, variants: [] },
    { id: "I2", shape: "I", label: "I2", typicalArea: 1685.84, variants: [] },
    { id: "SQ1", shape: "SQ", label: "Vuông", typicalArea: 1188.16, variants: [] },
  ],
  assignments: [
    { lotId: "A", buildings: ["L_short", "L_short", "I2"] },
    { lotId: "B", buildings: ["Z1", "Z1"] },
    { lotId: "C", buildings: ["Z1", "Z1", "Z1", "Z1"] },
    { lotId: "D", buildings: ["L_short", "L_short", "Z1", "Z1"] },
  ],
  deductionRate: 0.03, // ~3% cho kỹ thuật, PCCC, tum, mái per tầng
  commercialFloors: 2,
  kTargetMin: 0.90, // 90% of kMax as min target
};

// ============================================================
// OPTIMIZATION ENGINE
// ============================================================
function optimizeGFA(project) {
  const { lots, buildingTypes, assignments, deductionRate, commercialFloors, kTargetMin } = project;

  // Build type map
  const typeMap = {};
  buildingTypes.forEach((bt) => (typeMap[bt.id] = bt));

  // Step 1: For each lot, calculate capacity and constraints
  const lotResults = lots.map((lot) => {
    const assignment = assignments.find((a) => a.lotId === lot.id);
    if (!assignment) return { lot, buildings: [], totalGFA: 0, kAchieved: 0, densityAchieved: 0, status: "unassigned" };

    const buildings = assignment.buildings.map((btId) => typeMap[btId]);
    const numBuildings = buildings.length;

    // Total footprint (sum of typical areas for density calc)
    const totalFootprint = buildings.reduce((s, b) => s + b.typicalArea, 0);
    const densityAchieved = totalFootprint / lot.area;

    // Max GFA allowed by K
    const maxGFA = lot.area * lot.kMax;
    const targetMinGFA = lot.area * lot.kMax * kTargetMin;

    // Calculate GFA per building
    // Each building: typicalArea * numFloors (residential) + commercial floors
    // Since Phase 1: all buildings of same type have same total GFA
    // Total GFA = sum of (typicalArea * totalFloors) for each building
    // where totalFloors includes commercial + residential + deductions

    // For simplicity in Phase 1: totalFloors = lot.floorRange[1] (max)
    const maxFloors = lot.floorRange[1];
    const residentialFloors = maxFloors - commercialFloors;
    const deductionFloors = Math.ceil(maxFloors * deductionRate);

    // GFA that counts toward K (hệ số SDD)
    const buildingGFAs = buildings.map((b) => {
      const commercialGFA = b.typicalArea * commercialFloors;
      const residentialGFA = b.typicalArea * residentialFloors;
      const countedGFA = commercialGFA + residentialGFA; // tính hệ số
      const totalGFA = countedGFA + b.typicalArea * deductionFloors; // tổng thực
      return {
        type: b,
        typicalArea: b.typicalArea,
        totalFloors: maxFloors,
        commercialGFA,
        residentialGFA,
        countedGFA,
        totalGFA,
        deductionGFA: b.typicalArea * deductionFloors,
      };
    });

    const totalCountedGFA = buildingGFAs.reduce((s, b) => s + b.countedGFA, 0);
    const totalActualGFA = buildingGFAs.reduce((s, b) => s + b.totalGFA, 0);
    const kAchieved = totalCountedGFA / lot.area;

    // Check if over K
    const isOverK = kAchieved > lot.kMax;
    const isOverDensity = densityAchieved > lot.densityMax;

    // If over, we need to scale down typical areas
    let scaleFactor = 1;
    if (isOverK) {
      scaleFactor = Math.min(scaleFactor, maxGFA / totalCountedGFA);
    }
    if (isOverDensity) {
      scaleFactor = Math.min(scaleFactor, (lot.area * lot.densityMax) / totalFootprint);
    }

    const adjustedBuildings = buildingGFAs.map((b) => ({
      ...b,
      adjustedTypicalArea: b.typicalArea * scaleFactor,
      adjustedCountedGFA: b.countedGFA * scaleFactor,
      adjustedTotalGFA: b.totalGFA * scaleFactor,
    }));

    const adjustedTotalCounted = adjustedBuildings.reduce((s, b) => s + b.adjustedCountedGFA, 0);
    const adjustedTotalActual = adjustedBuildings.reduce((s, b) => s + b.adjustedTotalGFA, 0);
    const adjustedK = adjustedTotalCounted / lot.area;
    const adjustedDensity = adjustedBuildings.reduce((s, b) => s + b.adjustedTypicalArea, 0) / lot.area;

    const utilizationRate = adjustedK / lot.kMax;

    return {
      lot,
      buildings: adjustedBuildings,
      totalCountedGFA: adjustedTotalCounted,
      totalActualGFA: adjustedTotalActual,
      kAchieved: adjustedK,
      kMax: lot.kMax,
      densityAchieved: adjustedDensity,
      densityMax: lot.densityMax,
      utilizationRate,
      scaleFactor,
      status: utilizationRate >= kTargetMin ? "optimal" : utilizationRate >= 0.8 ? "good" : "low",
      maxFloors,
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
      avgTypicalArea: 0,
      lots: [],
    };
  });

  lotResults.forEach((lr) => {
    lr.buildings.forEach((b) => {
      const agg = typeAggregation[b.type.id];
      if (agg) {
        agg.count++;
        agg.totalCountedGFA += b.adjustedCountedGFA;
        agg.totalActualGFA += b.adjustedTotalGFA;
        agg.lots.push(lr.lot.id);
      }
    });
  });

  Object.values(typeAggregation).forEach((agg) => {
    if (agg.count > 0) {
      agg.avgTypicalArea = agg.totalCountedGFA / agg.count / (DEFAULT_PROJECT.lots[0]?.floorRange?.[1] || 30);
    }
  });

  // Project totals
  const projectTotal = {
    totalCountedGFA: lotResults.reduce((s, lr) => s + lr.totalCountedGFA, 0),
    totalActualGFA: lotResults.reduce((s, lr) => s + lr.totalActualGFA, 0),
    totalLandArea: lots.reduce((s, l) => s + l.area, 0),
    totalBuildings: assignments.reduce((s, a) => s + a.buildings.length, 0),
    avgK: 0,
    avgUtilization: 0,
  };
  projectTotal.avgK = projectTotal.totalCountedGFA / projectTotal.totalLandArea;
  projectTotal.avgUtilization = lotResults.reduce((s, lr) => s + lr.utilizationRate, 0) / lotResults.length;

  return { lotResults, typeAggregation, projectTotal };
}

// ============================================================
// ITERATIVE OPTIMIZER - tries different typical area combinations
// ============================================================
function runIterativeOptimization(project, iterations = 500) {
  const { lots, buildingTypes, assignments, deductionRate, commercialFloors, kTargetMin } = project;
  const typeMap = {};
  buildingTypes.forEach((bt) => (typeMap[bt.id] = { ...bt }));

  let bestResult = null;
  let bestTotalGFA = 0;

  for (let i = 0; i < iterations; i++) {
    // Random perturbation of typical areas (±10%)
    const trialTypes = buildingTypes.map((bt) => ({
      ...bt,
      typicalArea: bt.typicalArea * (0.92 + Math.random() * 0.16),
    }));

    const trialProject = { ...project, buildingTypes: trialTypes };
    const result = optimizeGFA(trialProject);

    // Check all constraints satisfied
    const allValid = result.lotResults.every(
      (lr) => lr.kAchieved <= lr.kMax * 1.001 && lr.densityAchieved <= lr.densityMax * 1.001
    );

    if (allValid && result.projectTotal.totalCountedGFA > bestTotalGFA) {
      bestTotalGFA = result.projectTotal.totalCountedGFA;
      bestResult = { result, types: trialTypes };
    }
  }

  return bestResult || { result: optimizeGFA(project), types: buildingTypes };
}

// ============================================================
// UI COMPONENTS
// ============================================================

// --- Status Badge ---
function StatusBadge({ status }) {
  const styles = {
    optimal: { bg: "#065f46", text: "#a7f3d0", label: "Tối ưu" },
    good: { bg: "#92400e", text: "#fde68a", label: "Khá" },
    low: { bg: "#991b1b", text: "#fecaca", label: "Thấp" },
    unassigned: { bg: "#374151", text: "#9ca3af", label: "Chưa gán" },
  };
  const s = styles[status] || styles.unassigned;
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      {s.label}
    </span>
  );
}

// --- Mini Bar Chart ---
function MiniBar({ value, max, color = "#3b82f6", height = 6 }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ background: "#1e293b", borderRadius: height / 2, height, width: "100%", overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: pct > 95 ? "#ef4444" : pct > 85 ? color : "#64748b",
          borderRadius: height / 2,
          transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </div>
  );
}

// --- Lot Card ---
function LotCard({ lotResult, expanded, onToggle }) {
  const lr = lotResult;
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 0,
        overflow: "hidden",
        transition: "all 0.3s",
        cursor: "pointer",
      }}
      onClick={onToggle}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: lr.status === "optimal" ? "#065f46" : lr.status === "good" ? "#92400e" : "#374151",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
              color: "#f1f5f9",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {lr.lot.id}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{lr.lot.name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {fmtNum(lr.lot.area, 0)} m² · {lr.buildings.length} tòa · {lr.maxFloors} tầng
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StatusBadge status={lr.status} />
          <span style={{ color: "#64748b", fontSize: 18, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.3s" }}>▾</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ padding: "0 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Hệ số SDD
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", fontFamily: "'JetBrains Mono', monospace" }}>
            {lr.kAchieved.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: "#64748b" }}>/ {lr.kMax.toFixed(2)} max</div>
          <MiniBar value={lr.kAchieved} max={lr.kMax} color="#3b82f6" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Mật độ XD
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", fontFamily: "'JetBrains Mono', monospace" }}>
            {(lr.densityAchieved * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: "#64748b" }}>/ {(lr.densityMax * 100).toFixed(0)}% max</div>
          <MiniBar value={lr.densityAchieved} max={lr.densityMax} color="#8b5cf6" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Tổng DT sàn (tính K)
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#34d399", fontFamily: "'JetBrains Mono', monospace" }}>
            {fmtNum(lr.totalCountedGFA, 0)}
          </div>
          <div style={{ fontSize: 10, color: "#64748b" }}>m²</div>
          <MiniBar value={lr.utilizationRate} max={1} color="#10b981" />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid #1e293b", padding: "16px 20px", background: "#0c1222" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Chi tiết từng tòa
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {lr.buildings.map((b, i) => {
              const shape = BUILDING_SHAPES[b.type.shape];
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 1fr 120px 120px",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: "#1e293b",
                    borderRadius: 8,
                    borderLeft: `3px solid ${shape?.color || "#64748b"}`,
                  }}
                >
                  <span style={{ fontSize: 18, textAlign: "center" }}>{shape?.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{b.type.label}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>
                      DT điển hình: {fmtNum(b.adjustedTypicalArea, 1)} m²
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>Tính hệ số</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#67e8f9", fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmtNum(b.adjustedCountedGFA, 0)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>Tổng thực</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#a5b4fc", fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmtNum(b.adjustedTotalGFA, 0)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Type Summary Card ---
function TypeSummaryCard({ agg }) {
  const shape = BUILDING_SHAPES[agg.type.shape];
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        border: `1px solid ${shape?.color || "#334155"}33`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${shape?.color || "#334155"}22`,
          border: `2px solid ${shape?.color || "#334155"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        {shape?.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{agg.type.label}</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          {agg.count} tòa · Lô {[...new Set(agg.lots)].join(", ")}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Tổng DT sàn</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: shape?.color || "#f1f5f9", fontFamily: "'JetBrains Mono', monospace" }}>
          {fmtNum(agg.totalCountedGFA, 0)}
        </div>
        <div style={{ fontSize: 10, color: "#64748b" }}>m² (tính K)</div>
      </div>
    </div>
  );
}

// --- Config Panel Components ---
function ConfigInput({ label, value, onChange, type = "number", suffix, small = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
          style={{
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 6,
            color: "#f1f5f9",
            padding: small ? "4px 8px" : "8px 12px",
            fontSize: small ? 12 : 14,
            fontFamily: "'JetBrains Mono', monospace",
            width: "100%",
            outline: "none",
          }}
        />
        {suffix && <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APPLICATION
// ============================================================
export default function GFAOptimizer() {
  const [project, setProject] = useState(DEFAULT_PROJECT);
  const [result, setResult] = useState(null);
  const [expandedLots, setExpandedLots] = useState({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationLog, setOptimizationLog] = useState([]);

  // Run initial calculation
  useEffect(() => {
    const r = optimizeGFA(project);
    setResult(r);
  }, []);

  const handleRecalculate = useCallback(() => {
    const r = optimizeGFA(project);
    setResult(r);
    setOptimizationLog((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString(), action: "Tính toán lại", totalGFA: r.projectTotal.totalCountedGFA },
    ]);
  }, [project]);

  const handleOptimize = useCallback(() => {
    setIsOptimizing(true);
    setTimeout(() => {
      const best = runIterativeOptimization(project, 800);
      setResult(best.result);
      setProject((p) => ({ ...p, buildingTypes: best.types }));
      setIsOptimizing(false);
      setOptimizationLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          action: "Tối ưu hóa (800 iterations)",
          totalGFA: best.result.projectTotal.totalCountedGFA,
        },
      ]);
    }, 100);
  }, [project]);

  const toggleLot = (lotId) => setExpandedLots((prev) => ({ ...prev, [lotId]: !prev[lotId] }));

  // --- Update helpers ---
  const updateLot = (lotId, field, value) => {
    setProject((p) => ({
      ...p,
      lots: p.lots.map((l) => (l.id === lotId ? { ...l, [field]: value } : l)),
    }));
  };

  const updateBuildingType = (typeId, field, value) => {
    setProject((p) => ({
      ...p,
      buildingTypes: p.buildingTypes.map((bt) => (bt.id === typeId ? { ...bt, [field]: value } : bt)),
    }));
  };

  if (!result) return <div style={{ color: "#f1f5f9", padding: 40 }}>Đang tải...</div>;

  const pt = result.projectTotal;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#f1f5f9",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { border-color: #3b82f6 !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-in { animation: fadeIn 0.4s ease-out both; }
        .pulse { animation: pulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* === HEADER === */}
      <header
        style={{
          background: "linear-gradient(90deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          borderBottom: "1px solid #1e293b",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            ⌂
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>GFA Optimizer</h1>
            <p style={{ fontSize: 10, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" }}>
              Phase 1 · Tối ưu Tổng Diện Tích Sàn
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav style={{ display: "flex", gap: 2, background: "#0f172a", borderRadius: 10, padding: 3 }}>
          {[
            { id: "dashboard", label: "Tổng quan" },
            { id: "config", label: "Cấu hình" },
            { id: "types", label: "Mẫu tòa" },
            { id: "legal", label: "Pháp lý" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: activeTab === tab.id ? "#3b82f6" : "transparent",
                color: activeTab === tab.id ? "#fff" : "#94a3b8",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleRecalculate}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#f1f5f9",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ↻ Tính lại
          </button>
          <button
            onClick={handleOptimize}
            disabled={isOptimizing}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: isOptimizing ? "#1e293b" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: isOptimizing ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isOptimizing ? <span className="pulse">⚡ Đang tối ưu...</span> : "⚡ Tối ưu hóa"}
          </button>
        </div>
      </header>

      {/* === MAIN CONTENT === */}
      <main style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
        {/* ============ DASHBOARD TAB ============ */}
        {activeTab === "dashboard" && (
          <div className="animate-in">
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Tổng DT sàn (tính K)", value: fmtNum(pt.totalCountedGFA, 0), unit: "m²", color: "#3b82f6", icon: "◫" },
                { label: "Tổng DT sàn thực", value: fmtNum(pt.totalActualGFA, 0), unit: "m²", color: "#8b5cf6", icon: "▤" },
                { label: "Hệ số SDD TB", value: pt.avgK.toFixed(2), unit: "lần", color: "#10b981", icon: "K" },
                { label: "Tỷ lệ tối ưu TB", value: (pt.avgUtilization * 100).toFixed(1) + "%", unit: "", color: "#f59e0b", icon: "%" },
              ].map((kpi, i) => (
                <div
                  key={i}
                  style={{
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: "20px 24px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: -10,
                      right: -10,
                      fontSize: 60,
                      opacity: 0.05,
                      fontWeight: 900,
                      color: kpi.color,
                    }}
                  >
                    {kpi.icon}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                    {kpi.value}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{kpi.unit}</div>
                </div>
              ))}
            </div>

            {/* Two Column Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
              {/* Left: Lot Results */}
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
                  Phân tích theo Lô đất ({result.lotResults.length} lô · {pt.totalBuildings} tòa)
                </h2>
                <div style={{ display: "grid", gap: 12 }}>
                  {result.lotResults.map((lr) => (
                    <LotCard key={lr.lot.id} lotResult={lr} expanded={expandedLots[lr.lot.id]} onToggle={() => toggleLot(lr.lot.id)} />
                  ))}
                </div>
              </div>

              {/* Right: Type Summary + Log */}
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
                  Tổng hợp theo Mẫu tòa
                </h2>
                <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                  {Object.values(result.typeAggregation)
                    .filter((a) => a.count > 0)
                    .sort((a, b) => b.totalCountedGFA - a.totalCountedGFA)
                    .map((agg) => (
                      <TypeSummaryCard key={agg.type.id} agg={agg} />
                    ))}
                </div>

                {/* Optimization Log */}
                {optimizationLog.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                      Lịch sử tối ưu
                    </h2>
                    <div style={{ background: "#0f172a", borderRadius: 10, padding: 12, maxHeight: 200, overflow: "auto" }}>
                      {optimizationLog.map((log, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e293b", fontSize: 11 }}>
                          <span style={{ color: "#64748b" }}>{log.time}</span>
                          <span style={{ color: "#94a3b8" }}>{log.action}</span>
                          <span style={{ color: "#34d399", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                            {fmtNum(log.totalGFA, 0)} m²
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ CONFIG TAB ============ */}
        {activeTab === "config" && (
          <div className="animate-in">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Cấu hình Dự án</h2>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
              Thiết lập thông số các lô đất và phân bổ tòa nhà. Thay đổi sẽ được phản ánh khi nhấn "Tính lại".
            </p>

            {/* Project Settings */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 32, background: "#0f172a", padding: 20, borderRadius: 12 }}>
              <ConfigInput label="Tên dự án" value={project.name} onChange={(v) => setProject((p) => ({ ...p, name: v }))} type="text" />
              <ConfigInput label="Tỷ lệ trừ (KT, PCCC...)" value={project.deductionRate} onChange={(v) => setProject((p) => ({ ...p, deductionRate: v }))} suffix="×" />
              <ConfigInput label="Số tầng TMDV" value={project.commercialFloors} onChange={(v) => setProject((p) => ({ ...p, commercialFloors: v }))} suffix="tầng" />
              <ConfigInput label="Ngưỡng K tối thiểu" value={project.kTargetMin} onChange={(v) => setProject((p) => ({ ...p, kTargetMin: v }))} suffix="× Kmax" />
            </div>

            {/* Lot Configuration */}
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Thông số Lô đất
            </h3>
            <div style={{ display: "grid", gap: 12 }}>
              {project.lots.map((lot) => (
                <div key={lot.id} style={{ background: "#0f172a", borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 120px 120px 120px", gap: 12, alignItems: "end" }}>
                    <ConfigInput label="Ký hiệu" value={lot.id} onChange={(v) => updateLot(lot.id, "id", v)} type="text" small />
                    <ConfigInput label="Tên lô" value={lot.name} onChange={(v) => updateLot(lot.id, "name", v)} type="text" small />
                    <ConfigInput label="Diện tích" value={lot.area} onChange={(v) => updateLot(lot.id, "area", v)} suffix="m²" small />
                    <ConfigInput label="K max" value={lot.kMax} onChange={(v) => updateLot(lot.id, "kMax", v)} suffix="lần" small />
                    <ConfigInput label="MĐXD max" value={lot.densityMax} onChange={(v) => updateLot(lot.id, "densityMax", v)} suffix="%" small />
                    <ConfigInput label="Tầng max" value={lot.floorRange[1]} onChange={(v) => updateLot(lot.id, "floorRange", [lot.floorRange[0], v])} suffix="tầng" small />
                  </div>
                </div>
              ))}
            </div>

            {/* Assignment Table */}
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginTop: 32, marginBottom: 12 }}>
              Phân bổ Tòa nhà
            </h3>
            <div style={{ background: "#0f172a", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                Mỗi lô chứa danh sách mẫu tòa (ID cách nhau bằng dấu phẩy)
              </div>
              {project.assignments.map((a) => (
                <div key={a.lotId} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, marginBottom: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", fontFamily: "'JetBrains Mono', monospace" }}>Lô {a.lotId}</span>
                  <input
                    type="text"
                    value={a.buildings.join(", ")}
                    onChange={(e) => {
                      const buildings = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                      setProject((p) => ({
                        ...p,
                        assignments: p.assignments.map((as) => (as.lotId === a.lotId ? { ...as, buildings } : as)),
                      }));
                    }}
                    style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#f1f5f9",
                      padding: "8px 12px",
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: "none",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ BUILDING TYPES TAB ============ */}
        {activeTab === "types" && (
          <div className="animate-in">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Mẫu Tòa nhà</h2>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
              Cấu hình diện tích sàn điển hình cho từng mẫu. Các tòa cùng mẫu sẽ có diện tích giống nhau.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {project.buildingTypes.map((bt) => {
                const shape = BUILDING_SHAPES[bt.shape];
                return (
                  <div
                    key={bt.id}
                    style={{
                      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                      border: `1px solid ${shape?.color || "#334155"}44`,
                      borderRadius: 12,
                      padding: 20,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          background: `${shape?.color || "#334155"}22`,
                          border: `2px solid ${shape?.color || "#334155"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 24,
                        }}
                      >
                        {shape?.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{bt.label}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {shape?.label} · ID: {bt.id}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <ConfigInput
                        label="DT sàn điển hình"
                        value={bt.typicalArea}
                        onChange={(v) => updateBuildingType(bt.id, "typicalArea", v)}
                        suffix="m²"
                      />
                      <div>
                        <label style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Hình dạng</label>
                        <select
                          value={bt.shape}
                          onChange={(e) => updateBuildingType(bt.id, "shape", e.target.value)}
                          style={{
                            width: "100%",
                            background: "#0f172a",
                            border: "1px solid #334155",
                            borderRadius: 6,
                            color: "#f1f5f9",
                            padding: "8px 12px",
                            fontSize: 14,
                            marginTop: 4,
                            outline: "none",
                          }}
                        >
                          {Object.entries(BUILDING_SHAPES).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.icon} {v.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============ LEGAL TAB ============ */}
        {activeTab === "legal" && (
          <div className="animate-in">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Quy định Pháp lý</h2>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
              Các văn bản quy phạm pháp luật được tham chiếu trong tính toán. Theo nguyên tắc: quy định có lợi hơn cho chủ đầu tư sẽ được áp dụng.
            </p>
            <div style={{ display: "grid", gap: 16 }}>
              {Object.values(LEGAL_RULES).map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: "#3b82f6",
                      }}
                    />
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>{rule.name}</h3>
                  </div>
                  <div style={{ paddingLeft: 20 }}>
                    {rule.rules.deductions && (
                      <div>
                        <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>
                          Diện tích được trừ khi tính hệ số SDD:
                        </div>
                        {rule.rules.deductions.map((d) => (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ color: "#10b981", fontSize: 12 }}>✓</span>
                            <span style={{ fontSize: 13, color: "#cbd5e1" }}>{d.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {rule.rules.maxCombinedFAR && (
                      <div style={{ marginTop: 8, fontSize: 13, color: "#cbd5e1" }}>
                        Hệ số SDD chung (đế + tháp) tối đa:{" "}
                        <strong style={{ color: "#f59e0b" }}>{rule.rules.maxCombinedFAR} lần</strong>
                      </div>
                    )}
                    {rule.rules.separateDensityForPodiumTower && (
                      <div style={{ marginTop: 8, fontSize: 13, color: "#cbd5e1" }}>
                        <span style={{ color: "#10b981" }}>✓</span> Mật độ xây dựng tính riêng cho khối đế và khối tháp
                      </div>
                    )}
                    {rule.rules.elevatorUnusedFloorExcluded && (
                      <div style={{ marginTop: 4, fontSize: 13, color: "#cbd5e1" }}>
                        <span style={{ color: "#10b981" }}>✓</span> Giếng thang máy tầng không dừng: không tính vào hệ số SDD
                      </div>
                    )}
                    {rule.rules.mixedFloorPartialDeduction && (
                      <div style={{ marginTop: 4, fontSize: 13, color: "#cbd5e1" }}>
                        <span style={{ color: "#10b981" }}>✓</span> Tầng hỗn hợp: chỉ trừ phần đỗ xe/kỹ thuật/lánh nạn
                      </div>
                    )}
                    {rule.rules.openSpaceNotCounted && (
                      <div style={{ marginTop: 4, fontSize: 13, color: "#cbd5e1" }}>
                        <span style={{ color: "#10b981" }}>✓</span> Không gian trống (không tường bao, không công năng): không tính DT sàn
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "24px 32px",
          borderTop: "1px solid #1e293b",
          fontSize: 11,
          color: "#475569",
        }}
      >
        GFA Optimizer v1.0 · Phase 1: Tối ưu Tổng Diện Tích Sàn · Built for INNO JSC
      </footer>
    </div>
  );
}
