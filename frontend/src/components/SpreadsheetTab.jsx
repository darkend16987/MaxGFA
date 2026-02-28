import { useState, useCallback, useMemo } from "react";
import { explainResult } from "../engine/explainability";
import { reverseCalculate } from "../engine/reverseCalculation";
import { calculateGFA } from "../engine/directCalculation";
import { BUILDING_SHAPES } from "../data/buildingShapes";
import { fmtNum } from "../utils/format";
import { colors, fonts } from "../styles/theme";

// ============================================================
// SPREADSHEET TAB — Interactive grid UI
// Phase 2.0: Excel-like editable tables with linked cells
// ============================================================

const SHEETS = [
  { id: "lots", label: "Lo dat" },
  { id: "types", label: "Mau toa" },
  { id: "results", label: "Ket qua" },
  { id: "explain", label: "Giai trinh" },
  { id: "reverse", label: "Tinh nguoc" },
];

// Shared cell styles
const cellBase = {
  padding: "6px 10px",
  fontSize: 12,
  fontFamily: fonts.mono,
  borderRight: `1px solid ${colors.border}`,
  borderBottom: `1px solid ${colors.border}`,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const headerCell = {
  ...cellBase,
  background: "#1a2332",
  color: colors.textSecondary,
  fontWeight: 700,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  position: "sticky",
  top: 0,
  zIndex: 2,
  fontFamily: fonts.body,
};

const inputCell = {
  background: "transparent",
  border: "none",
  color: colors.cyan,
  fontFamily: fonts.mono,
  fontSize: 12,
  width: "100%",
  outline: "none",
  padding: 0,
};

const readOnlyCell = {
  ...cellBase,
  color: colors.textPrimary,
};

const computedCell = {
  ...cellBase,
  color: colors.greenLight,
  fontWeight: 600,
};

export default function SpreadsheetTab({ project, setProject, result }) {
  const [activeSheet, setActiveSheet] = useState("lots");
  const [reverseState, setReverseState] = useState({
    lotId: project.lots[0]?.id || "",
    targetType: "kTarget",
    targetValue: "",
    lockedTypes: [],
    result: null,
  });

  // Compute explanations
  const explanation = useMemo(() => {
    if (!result) return null;
    return explainResult(project, result);
  }, [project, result]);

  return (
    <div className="animate-in">
      {/* Sheet content */}
      <div
        style={{
          background: colors.bgCard,
          border: `1px solid ${colors.border}`,
          borderRadius: "12px 12px 0 0",
          minHeight: 500,
          overflow: "hidden",
        }}
      >
        {activeSheet === "lots" && (
          <SheetLots project={project} setProject={setProject} result={result} />
        )}
        {activeSheet === "types" && (
          <SheetTypes project={project} setProject={setProject} result={result} />
        )}
        {activeSheet === "results" && <SheetResults result={result} />}
        {activeSheet === "explain" && (
          <SheetExplain explanation={explanation} result={result} />
        )}
        {activeSheet === "reverse" && (
          <SheetReverse
            project={project}
            setProject={setProject}
            result={result}
            reverseState={reverseState}
            setReverseState={setReverseState}
          />
        )}
      </div>

      {/* Sheet tabs at bottom (like Excel) */}
      <div
        style={{
          display: "flex",
          gap: 0,
          background: "#0a1120",
          borderRadius: "0 0 12px 12px",
          borderTop: `1px solid ${colors.border}`,
          overflow: "hidden",
        }}
      >
        {SHEETS.map((sheet) => (
          <button
            key={sheet.id}
            onClick={() => setActiveSheet(sheet.id)}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRight: `1px solid ${colors.border}`,
              background:
                activeSheet === sheet.id
                  ? colors.bgCard
                  : "transparent",
              color:
                activeSheet === sheet.id
                  ? colors.textPrimary
                  : colors.textMuted,
              fontSize: 12,
              fontWeight: activeSheet === sheet.id ? 700 : 400,
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: fonts.body,
            }}
          >
            {sheet.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "10px 16px",
            fontSize: 10,
            color: colors.textDim,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: colors.cyan,
              display: "inline-block",
            }}
          />
          = editable
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: colors.greenLight,
              display: "inline-block",
            }}
          />
          = computed
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHEET: Lots — Editable lot configuration + computed results
// ============================================================
function SheetLots({ project, setProject, result }) {
  const updateLot = (lotId, field, value) => {
    setProject((p) => ({
      ...p,
      lots: p.lots.map((l) =>
        l.id === lotId ? { ...l, [field]: value } : l
      ),
    }));
  };

  const updateAssignment = (lotId, value) => {
    const buildings = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setProject((p) => ({
      ...p,
      assignments: p.assignments.map((a) =>
        a.lotId === lotId ? { ...a, buildings } : a
      ),
    }));
  };

  const columns = [
    { key: "id", label: "ID", width: 60, editable: false },
    { key: "name", label: "Ten lo", width: 100, editable: true, type: "text" },
    { key: "area", label: "DT dat (m2)", width: 110, editable: true, type: "number" },
    { key: "kMax", label: "K max", width: 70, editable: true, type: "number" },
    { key: "densityMax", label: "MDXD max", width: 85, editable: true, type: "number" },
    { key: "maxFloors", label: "Tang max", width: 75, editable: true, type: "number" },
    { key: "maxPopulation", label: "Dan so max", width: 90, editable: true, type: "number" },
    { key: "buildings", label: "Toa nha (phan bo)", width: 200, editable: true, type: "text" },
    { key: "_kAchieved", label: "K dat", width: 70, computed: true },
    { key: "_kUsage", label: "% K", width: 65, computed: true },
    { key: "_density", label: "MDXD %", width: 70, computed: true },
    { key: "_gfa", label: "DT san K (m2)", width: 120, computed: true },
    { key: "_gfaActual", label: "DT san thuc (m2)", width: 120, computed: true },
    { key: "_population", label: "Dan so", width: 80, computed: true },
    { key: "_status", label: "Trang thai", width: 80, computed: true },
  ];

  return (
    <div style={{ overflow: "auto", maxHeight: 600 }}>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          minWidth: columns.reduce((s, c) => s + c.width, 0),
        }}
      >
        <thead>
          <tr>
            <th style={{ ...headerCell, width: 32, textAlign: "center" }}>#</th>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  ...headerCell,
                  width: col.width,
                  color: col.computed ? colors.greenLight : colors.textSecondary,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {project.lots.map((lot, idx) => {
            const lr = result?.lotResults.find((r) => r.lot.id === lot.id);
            const assignment = project.assignments.find(
              (a) => a.lotId === lot.id
            );

            return (
              <tr key={lot.id} style={{ background: idx % 2 === 0 ? "transparent" : "#0c1525" }}>
                <td style={{ ...cellBase, textAlign: "center", color: colors.textDim, fontSize: 10 }}>
                  {idx + 1}
                </td>
                {columns.map((col) => {
                  // Computed columns
                  if (col.computed) {
                    let value = "—";
                    let color = colors.greenLight;

                    if (lr) {
                      switch (col.key) {
                        case "_kAchieved":
                          value = lr.kAchieved.toFixed(2);
                          break;
                        case "_kUsage":
                          value = (lr.utilizationRate * 100).toFixed(1) + "%";
                          color = lr.utilizationRate >= 0.9 ? colors.greenLight : lr.utilizationRate >= 0.8 ? colors.amber : colors.red;
                          break;
                        case "_density":
                          value = (lr.densityAchieved * 100).toFixed(1) + "%";
                          break;
                        case "_gfa":
                          value = fmtNum(lr.totalCountedGFA, 0);
                          break;
                        case "_gfaActual":
                          value = fmtNum(lr.totalActualGFA, 0);
                          break;
                        case "_population":
                          value = lr.populationCalc > 0 ? fmtNum(lr.populationCalc, 0) : "—";
                          if (lr.isOverPopulation) color = colors.red;
                          else if (lr.maxPopulation > 0) color = colors.amber;
                          break;
                        case "_status": {
                          const statusLabels = { optimal: "Toi uu", good: "Kha", low: "Thap", over: "Vuot", unassigned: "—" };
                          const statusColors = { optimal: colors.green, good: colors.amber, low: colors.red, over: colors.red, unassigned: colors.textDim };
                          value = statusLabels[lr.status] || "—";
                          color = statusColors[lr.status] || colors.textDim;
                          break;
                        }
                      }
                    }

                    return (
                      <td key={col.key} style={{ ...computedCell, color }}>
                        {value}
                      </td>
                    );
                  }

                  // Buildings assignment column
                  if (col.key === "buildings") {
                    return (
                      <td key={col.key} style={{ ...cellBase, padding: "2px 4px" }}>
                        <input
                          type="text"
                          value={assignment?.buildings.join(", ") || ""}
                          onChange={(e) => updateAssignment(lot.id, e.target.value)}
                          style={inputCell}
                        />
                      </td>
                    );
                  }

                  // Editable lot fields
                  if (col.editable) {
                    return (
                      <td key={col.key} style={{ ...cellBase, padding: "2px 4px" }}>
                        <input
                          type={col.type || "text"}
                          value={lot[col.key] ?? ""}
                          onChange={(e) => {
                            const v = col.type === "number"
                              ? parseFloat(e.target.value) || 0
                              : e.target.value;
                            updateLot(lot.id, col.key, v);
                          }}
                          style={inputCell}
                          step={col.type === "number" ? "any" : undefined}
                        />
                      </td>
                    );
                  }

                  // Read-only
                  return (
                    <td key={col.key} style={{ ...readOnlyCell, fontWeight: 700 }}>
                      {lot[col.key]}
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {/* Totals row */}
          {result && (
            <tr style={{ background: "#1a2332" }}>
              <td style={{ ...cellBase, fontWeight: 700 }} />
              <td colSpan={2} style={{ ...cellBase, fontWeight: 700, color: colors.textPrimary }}>
                TONG
              </td>
              <td style={{ ...computedCell }}>{fmtNum(project.lots.reduce((s, l) => s + l.area, 0), 0)}</td>
              <td style={cellBase} />
              <td style={cellBase} />
              <td style={cellBase} />
              <td style={cellBase} />
              <td style={{ ...computedCell }}>{result.projectTotal.avgK.toFixed(2)}</td>
              <td style={{ ...computedCell }}>
                {(result.projectTotal.avgUtilization * 100).toFixed(1)}%
              </td>
              <td style={cellBase} />
              <td style={{ ...computedCell, color: colors.cyan }}>
                {fmtNum(result.projectTotal.totalCountedGFA, 0)}
              </td>
              <td style={{ ...computedCell, color: colors.purple }}>
                {fmtNum(result.projectTotal.totalActualGFA, 0)}
              </td>
              <td style={{ ...computedCell, color: result.projectTotal.combinedFARCompliant ? colors.green : colors.red }}>
                {result.projectTotal.combinedFARCompliant ? "DAT" : "VUOT"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// SHEET: Types — Editable building type configuration
// ============================================================
function SheetTypes({ project, setProject, result }) {
  const updateType = (typeId, field, value) => {
    setProject((p) => ({
      ...p,
      buildingTypes: p.buildingTypes.map((bt) =>
        bt.id === typeId ? { ...bt, [field]: value } : bt
      ),
    }));
  };

  const typeAgg = result?.typeAggregation || {};

  return (
    <div style={{ overflow: "auto", maxHeight: 600 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ ...headerCell, width: 32 }}>#</th>
            <th style={headerCell}>ID</th>
            <th style={headerCell}>Ten</th>
            <th style={headerCell}>Hinh dang</th>
            <th style={{ ...headerCell, color: colors.cyan }}>DT dien hinh (m2)</th>
            <th style={{ ...headerCell, color: colors.amber }}>DT min (m2)</th>
            <th style={{ ...headerCell, color: colors.amber }}>DT max (m2)</th>
            <th style={{ ...headerCell, color: colors.greenLight }}>So luong</th>
            <th style={{ ...headerCell, color: colors.greenLight }}>Cac lo</th>
            <th style={{ ...headerCell, color: colors.greenLight }}>Tong DT K (m2)</th>
            <th style={{ ...headerCell, color: colors.greenLight }}>Tong DT thuc (m2)</th>
          </tr>
        </thead>
        <tbody>
          {project.buildingTypes.map((bt, idx) => {
            const agg = typeAgg[bt.id];
            const shape = BUILDING_SHAPES[bt.shape];
            return (
              <tr key={bt.id} style={{ background: idx % 2 === 0 ? "transparent" : "#0c1525" }}>
                <td style={{ ...cellBase, textAlign: "center", color: colors.textDim, fontSize: 10 }}>
                  {idx + 1}
                </td>
                <td style={{ ...readOnlyCell, fontWeight: 700 }}>{bt.id}</td>
                <td style={{ ...cellBase, padding: "2px 4px" }}>
                  <input
                    type="text"
                    value={bt.label}
                    onChange={(e) => updateType(bt.id, "label", e.target.value)}
                    style={inputCell}
                  />
                </td>
                <td style={{ ...cellBase, padding: "2px 4px" }}>
                  <select
                    value={bt.shape}
                    onChange={(e) => updateType(bt.id, "shape", e.target.value)}
                    style={{
                      ...inputCell,
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    {Object.entries(BUILDING_SHAPES).map(([k, v]) => (
                      <option key={k} value={k} style={{ background: colors.bgCard }}>
                        {v.icon} {v.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ ...cellBase, padding: "2px 4px" }}>
                  <input
                    type="number"
                    value={bt.typicalArea}
                    onChange={(e) =>
                      updateType(bt.id, "typicalArea", parseFloat(e.target.value) || 0)
                    }
                    style={{ ...inputCell, color: colors.cyan }}
                    step="any"
                  />
                </td>
                <td style={{ ...cellBase, padding: "2px 4px" }}>
                  <input
                    type="number"
                    value={bt.minTypicalArea || ""}
                    onChange={(e) =>
                      updateType(bt.id, "minTypicalArea", parseFloat(e.target.value) || 0)
                    }
                    style={{ ...inputCell, color: colors.amber }}
                    step="any"
                    placeholder="—"
                  />
                </td>
                <td style={{ ...cellBase, padding: "2px 4px" }}>
                  <input
                    type="number"
                    value={bt.maxTypicalArea || ""}
                    onChange={(e) =>
                      updateType(bt.id, "maxTypicalArea", parseFloat(e.target.value) || 0)
                    }
                    style={{ ...inputCell, color: colors.amber }}
                    step="any"
                    placeholder="—"
                  />
                </td>
                <td style={computedCell}>{agg?.count || 0}</td>
                <td style={{ ...computedCell, fontSize: 11 }}>
                  {agg ? [...new Set(agg.lots)].join(", ") : "—"}
                </td>
                <td style={computedCell}>{agg ? fmtNum(agg.totalCountedGFA, 0) : "—"}</td>
                <td style={computedCell}>{agg ? fmtNum(agg.totalActualGFA, 0) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// SHEET: Results — Read-only building-level detail
// ============================================================
function SheetResults({ result }) {
  if (!result) return <EmptySheet message="Chua co ket qua" />;

  return (
    <div style={{ overflow: "auto", maxHeight: 600 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1100 }}>
        <thead>
          <tr>
            <th style={{ ...headerCell, width: 32 }}>#</th>
            <th style={headerCell}>Lo dat</th>
            <th style={headerCell}>Mau toa</th>
            <th style={headerCell}>Hinh dang</th>
            <th style={headerCell}>DT dien hinh</th>
            <th style={headerCell}>Tang</th>
            <th style={headerCell}>Tang TMDV</th>
            <th style={headerCell}>Tang o</th>
            <th style={headerCell}>Tang tru</th>
            <th style={headerCell}>DT TMDV</th>
            <th style={headerCell}>DT o</th>
            <th style={headerCell}>DT tinh K</th>
            <th style={headerCell}>DT tru</th>
            <th style={headerCell}>DT tong</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let rowNum = 0;
            return result.lotResults.flatMap((lr) =>
              lr.buildings.map((b) => {
                rowNum++;
                const shape = BUILDING_SHAPES[b.type.shape];
                return (
                  <tr key={`${lr.lot.id}-${rowNum}`} style={{ background: rowNum % 2 === 0 ? "#0c1525" : "transparent" }}>
                    <td style={{ ...cellBase, textAlign: "center", color: colors.textDim, fontSize: 10 }}>
                      {rowNum}
                    </td>
                    <td style={{ ...readOnlyCell, fontWeight: 700 }}>{lr.lot.id}</td>
                    <td style={readOnlyCell}>{b.type.label}</td>
                    <td style={readOnlyCell}>
                      {shape?.icon} {shape?.label}
                    </td>
                    <td style={computedCell}>{fmtNum(b.adjustedTypicalArea, 1)}</td>
                    <td style={readOnlyCell}>{b.totalFloors}</td>
                    <td style={readOnlyCell}>{b.commercialFloors}</td>
                    <td style={readOnlyCell}>{b.residentialFloors}</td>
                    <td style={readOnlyCell}>{b.deductionFloors}</td>
                    <td style={computedCell}>{fmtNum(b.adjustedCommercialGFA, 0)}</td>
                    <td style={computedCell}>{fmtNum(b.adjustedResidentialGFA, 0)}</td>
                    <td style={{ ...computedCell, color: colors.cyan }}>{fmtNum(b.adjustedCountedGFA, 0)}</td>
                    <td style={computedCell}>{fmtNum(b.adjustedDeductionGFA, 0)}</td>
                    <td style={{ ...computedCell, color: colors.purple }}>{fmtNum(b.adjustedTotalGFA, 0)}</td>
                  </tr>
                );
              })
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// SHEET: Explain — Structured result explanations
// ============================================================
function SheetExplain({ explanation, result }) {
  const [expandedLot, setExpandedLot] = useState(null);

  if (!explanation) return <EmptySheet message="Nhan 'Tinh lai' de xem giai trinh" />;

  const pe = explanation.projectExplanation;

  return (
    <div style={{ overflow: "auto", maxHeight: 600, padding: 20 }}>
      {/* Project-level summary */}
      <div
        style={{
          background: "#0c1525",
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          Tong quan du an
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <MetricBox
            label="FAR tong"
            value={pe.farCompliance.formula}
            status={pe.farCompliance.status}
            detail={pe.farCompliance.detail}
          />
          <MetricBox
            label="Lo toi uu"
            value={`${pe.summary.optimalLots} / ${pe.summary.totalLots} lo`}
            status={pe.summary.optimalLots === pe.summary.totalLots ? "met" : "partial"}
          />
          <MetricBox
            label="Tong DT san tinh K"
            value={`${fmtNum(pe.summary.totalCountedGFA, 0)} m2`}
            status="info"
            detail={`TB K = ${pe.summary.avgK.toFixed(2)}, TB utilization = ${(pe.summary.avgUtilization * 100).toFixed(1)}%`}
          />
        </div>
      </div>

      {/* Per-lot explanations */}
      {explanation.lotExplanations
        .filter((le) => le.status !== "unassigned")
        .map((le) => (
          <div
            key={le.lotId}
            style={{
              background: "#0c1525",
              borderRadius: 10,
              marginBottom: 12,
              border: `1px solid ${colors.border}`,
              overflow: "hidden",
            }}
          >
            {/* Lot header */}
            <div
              onClick={() => setExpandedLot(expandedLot === le.lotId ? null : le.lotId)}
              style={{
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 700, color: colors.textPrimary, fontSize: 14 }}>
                  {le.lotId}
                </span>
                <span style={{ color: colors.textSecondary, fontSize: 12 }}>{le.lotName}</span>
                <StatusPill status={le.status} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11 }}>
                {le.constraints.map((c) => (
                  <span
                    key={c.name}
                    style={{
                      color: c.usage > 95 ? colors.red : c.usage > 85 ? colors.amber : colors.green,
                      fontFamily: fonts.mono,
                    }}
                  >
                    {c.name}: {c.usage.toFixed(1)}%
                  </span>
                ))}
                <span style={{ color: colors.textMuted, transform: expandedLot === le.lotId ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  ▾
                </span>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedLot === le.lotId && (
              <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${colors.borderLight}` }}>
                {/* Formulas */}
                <Section title="Cong thuc tinh">
                  {Object.entries(le.formulas)
                    .filter(([k]) => k !== "buildings" && k !== "scaling")
                    .map(([key, f]) => (
                      <FormulaRow key={key} formula={f.formula} detail={f.detail} />
                    ))}
                  {le.formulas.scaling && (
                    <FormulaRow
                      formula={le.formulas.scaling.formula}
                      detail={le.formulas.scaling.detail}
                      warning
                    />
                  )}
                </Section>

                {/* Constraints */}
                <Section title="Rang buoc">
                  {le.constraints.map((c) => (
                    <ConstraintRow key={c.name} constraint={c} />
                  ))}
                </Section>

                {/* Optimization */}
                <Section title="Danh gia toi uu">
                  <div style={{ fontSize: 12, color: colors.textPrimary, marginBottom: 6 }}>
                    {le.optimization.bottleneck}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                    {le.optimization.headroom}
                  </div>
                  <div style={{ fontSize: 12, color: colors.amber, fontStyle: "italic" }}>
                    {le.optimization.recommendation}
                  </div>
                </Section>

                {/* Trade-offs */}
                {le.tradeoffs.length > 0 && (
                  <Section title="Anh huong cheo (shared types)">
                    {le.tradeoffs.map((t, i) => (
                      <TradeoffRow key={i} tradeoff={t} />
                    ))}
                  </Section>
                )}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

// ============================================================
// SHEET: Reverse — Target → Config inverse calculation
// ============================================================
function SheetReverse({ project, setProject, result, reverseState, setReverseState }) {
  const handleCalculate = useCallback(() => {
    const target = {};
    const val = parseFloat(reverseState.targetValue);
    if (isNaN(val) || val <= 0) return;

    if (reverseState.targetType === "totalCountedGFA") target.totalCountedGFA = val;
    else if (reverseState.targetType === "kTarget") target.kTarget = val;
    else if (reverseState.targetType === "utilizationTarget") target.utilizationTarget = val / 100;

    const res = reverseCalculate({
      project,
      result,
      lotId: reverseState.lotId,
      target,
      lockedTypes: reverseState.lockedTypes,
    });

    setReverseState((s) => ({ ...s, result: res }));
  }, [project, result, reverseState.lotId, reverseState.targetType, reverseState.targetValue, reverseState.lockedTypes, setReverseState]);

  const handleApply = useCallback(() => {
    const res = reverseState.result;
    if (!res || !res.feasible || !res.trialTypes) return;

    setProject((p) => ({ ...p, buildingTypes: res.trialTypes }));
    setReverseState((s) => ({ ...s, result: null }));
  }, [reverseState.result, setProject, setReverseState]);

  const rv = reverseState.result;

  return (
    <div style={{ overflow: "auto", maxHeight: 600, padding: 20 }}>
      {/* Input form */}
      <div
        style={{
          background: "#0c1525",
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
          Tinh nguoc: Target → Cau hinh
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          {/* Lot selector */}
          <div>
            <label style={labelStyle}>Lo dat</label>
            <select
              value={reverseState.lotId}
              onChange={(e) => setReverseState((s) => ({ ...s, lotId: e.target.value, result: null }))}
              style={selectStyle}
            >
              {project.lots.map((lot) => (
                <option key={lot.id} value={lot.id} style={{ background: colors.bgCard }}>
                  {lot.id} — {lot.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target type */}
          <div>
            <label style={labelStyle}>Loai target</label>
            <select
              value={reverseState.targetType}
              onChange={(e) => setReverseState((s) => ({ ...s, targetType: e.target.value, result: null }))}
              style={selectStyle}
            >
              <option value="kTarget" style={{ background: colors.bgCard }}>He so K</option>
              <option value="totalCountedGFA" style={{ background: colors.bgCard }}>Tong DT san K (m2)</option>
              <option value="utilizationTarget" style={{ background: colors.bgCard }}>Ty le toi uu (%)</option>
            </select>
          </div>

          {/* Target value */}
          <div>
            <label style={labelStyle}>
              Gia tri target
              {reverseState.targetType === "kTarget" && " (lan)"}
              {reverseState.targetType === "totalCountedGFA" && " (m2)"}
              {reverseState.targetType === "utilizationTarget" && " (%)"}
            </label>
            <input
              type="number"
              value={reverseState.targetValue}
              onChange={(e) => setReverseState((s) => ({ ...s, targetValue: e.target.value, result: null }))}
              placeholder={
                reverseState.targetType === "kTarget"
                  ? "VD: 5.25"
                  : reverseState.targetType === "totalCountedGFA"
                    ? "VD: 130000"
                    : "VD: 98"
              }
              style={{
                ...selectStyle,
                fontFamily: fonts.mono,
              }}
              step="any"
            />
          </div>

          <button
            onClick={handleCalculate}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Tinh nguoc
          </button>
        </div>

        {/* Locked types */}
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Khoa mau toa (khong thay doi)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            {project.buildingTypes.map((bt) => {
              const isLocked = reverseState.lockedTypes.includes(bt.id);
              return (
                <button
                  key={bt.id}
                  onClick={() => {
                    setReverseState((s) => ({
                      ...s,
                      lockedTypes: isLocked
                        ? s.lockedTypes.filter((id) => id !== bt.id)
                        : [...s.lockedTypes, bt.id],
                      result: null,
                    }));
                  }}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: `1px solid ${isLocked ? colors.red : colors.border}`,
                    background: isLocked ? `${colors.red}22` : "transparent",
                    color: isLocked ? colors.red : colors.textSecondary,
                    fontSize: 11,
                    cursor: "pointer",
                    fontFamily: fonts.mono,
                  }}
                >
                  {isLocked ? "X " : ""}{bt.label} ({bt.id})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      {rv && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Feasibility banner */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: rv.feasible ? `${colors.green}15` : `${colors.red}15`,
              border: `1px solid ${rv.feasible ? colors.green : colors.red}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: rv.feasible ? colors.green : colors.red }}>
                {rv.feasible ? "Kha thi" : "Khong kha thi"}
              </div>
              {rv.error && <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{rv.error}</div>}
              {rv.suggestion && <div style={{ fontSize: 12, color: colors.amber, marginTop: 4 }}>{rv.suggestion}</div>}
              {rv.warnings?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {rv.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 11, color: colors.amber }}>
                      ! {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {rv.feasible && (
              <button
                onClick={handleApply}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: colors.green,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Ap dung
              </button>
            )}
          </div>

          {/* Target summary */}
          {rv.target && (
            <div style={{ background: "#0c1525", borderRadius: 10, padding: 16, border: `1px solid ${colors.border}` }}>
              <div style={{ ...sectionTitle }}>Target</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                <SmallMetric label="Lo" value={`${rv.target.lotId} — ${rv.target.lotName}`} />
                <SmallMetric label="GFA hien tai" value={`${fmtNum(rv.target.currentGFA, 0)} m2`} />
                <SmallMetric label="GFA target" value={`${fmtNum(rv.target.targetGFA, 0)} m2`} color={colors.cyan} />
                <SmallMetric
                  label="Chenh lech"
                  value={`${rv.target.deltaGFA >= 0 ? "+" : ""}${fmtNum(rv.target.deltaGFA, 0)} m2`}
                  color={rv.target.deltaGFA >= 0 ? colors.green : colors.red}
                />
              </div>
            </div>
          )}

          {/* Type changes */}
          {rv.typeChanges?.length > 0 && (
            <div style={{ background: "#0c1525", borderRadius: 10, padding: 16, border: `1px solid ${colors.border}` }}>
              <div style={{ ...sectionTitle }}>Thay doi mau toa can thiet</div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={headerCell}>Mau toa</th>
                    <th style={headerCell}>DT cu (m2)</th>
                    <th style={headerCell}>DT moi (m2)</th>
                    <th style={headerCell}>Thay doi</th>
                    <th style={headerCell}>Anh huong lot</th>
                  </tr>
                </thead>
                <tbody>
                  {rv.typeChanges.map((tc) => (
                    <tr key={tc.typeId}>
                      <td style={readOnlyCell}>{tc.typeLabel} ({tc.typeId})</td>
                      <td style={{ ...computedCell, fontFamily: fonts.mono }}>{fmtNum(tc.oldTypicalArea, 1)}</td>
                      <td style={{ ...computedCell, color: colors.cyan, fontFamily: fonts.mono }}>
                        {fmtNum(tc.newTypicalArea, 1)}
                      </td>
                      <td
                        style={{
                          ...computedCell,
                          color: tc.percentChange >= 0 ? colors.green : colors.red,
                        }}
                      >
                        {tc.percentChange >= 0 ? "+" : ""}
                        {tc.percentChange.toFixed(2)}%
                      </td>
                      <td style={{ ...readOnlyCell, fontSize: 11 }}>{tc.affectedLots.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Impact on all lots */}
          {rv.impactOnLots && (
            <div style={{ background: "#0c1525", borderRadius: 10, padding: 16, border: `1px solid ${colors.border}` }}>
              <div style={{ ...sectionTitle }}>Anh huong len cac lo</div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={headerCell}>Lo</th>
                    <th style={headerCell}>K truoc</th>
                    <th style={headerCell}>K sau</th>
                    <th style={headerCell}>K max</th>
                    <th style={headerCell}>GFA truoc</th>
                    <th style={headerCell}>GFA sau</th>
                    <th style={headerCell}>Delta</th>
                    <th style={headerCell}>Trang thai</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(rv.impactOnLots).map((impact) => {
                    const hasIssue = impact.exceedsK || impact.exceedsDensity;
                    return (
                      <tr
                        key={impact.lotId}
                        style={{
                          background: impact.isTarget
                            ? `${colors.blue}15`
                            : hasIssue
                              ? `${colors.red}10`
                              : "transparent",
                        }}
                      >
                        <td style={{ ...readOnlyCell, fontWeight: impact.isTarget ? 700 : 400 }}>
                          {impact.lotId} {impact.isTarget ? "(target)" : ""}
                        </td>
                        <td style={{ ...computedCell, fontFamily: fonts.mono }}>{impact.kBefore.toFixed(2)}</td>
                        <td
                          style={{
                            ...computedCell,
                            color: impact.exceedsK ? colors.red : colors.cyan,
                            fontFamily: fonts.mono,
                          }}
                        >
                          {impact.kAfter.toFixed(2)}
                        </td>
                        <td style={{ ...readOnlyCell, fontFamily: fonts.mono }}>{impact.kMax.toFixed(2)}</td>
                        <td style={{ ...computedCell, fontFamily: fonts.mono }}>{fmtNum(impact.gfaBefore, 0)}</td>
                        <td style={{ ...computedCell, color: colors.cyan, fontFamily: fonts.mono }}>
                          {fmtNum(impact.gfaAfter, 0)}
                        </td>
                        <td
                          style={{
                            ...computedCell,
                            color: impact.gfaDelta >= 0 ? colors.green : colors.red,
                          }}
                        >
                          {impact.gfaDelta >= 0 ? "+" : ""}
                          {fmtNum(impact.gfaDelta, 0)}
                        </td>
                        <td style={{ ...readOnlyCell }}>
                          {hasIssue ? (
                            <span style={{ color: colors.red, fontWeight: 700 }}>VUOT</span>
                          ) : (
                            <span style={{ color: colors.green }}>OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Project impact */}
              {rv.projectImpact && (
                <div style={{ marginTop: 12, display: "flex", gap: 24, fontSize: 11, color: colors.textSecondary }}>
                  <span>
                    Tong GFA: {fmtNum(rv.projectImpact.gfaBefore, 0)} → {fmtNum(rv.projectImpact.gfaAfter, 0)} m2
                    ({rv.projectImpact.gfaDelta >= 0 ? "+" : ""}{fmtNum(rv.projectImpact.gfaDelta, 0)})
                  </span>
                  <span>
                    FAR: {rv.projectImpact.farBefore.toFixed(2)} → {rv.projectImpact.farAfter.toFixed(2)}
                    {rv.projectImpact.farExceeds && (
                      <span style={{ color: colors.red, fontWeight: 700 }}> VUOT 13</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!rv && (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: colors.textMuted,
            fontSize: 13,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>&#8644;</div>
          <div>Nhap target va nhan "Tinh nguoc" de xem ket qua</div>
          <div style={{ fontSize: 11, marginTop: 8, color: colors.textDim }}>
            Thay doi GFA 1 lo → xem anh huong day chuyen len toan du an
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Shared sub-components
// ============================================================

function EmptySheet({ message }) {
  return (
    <div style={{ padding: 60, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
      {message}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FormulaRow({ formula, detail, warning = false }) {
  return (
    <div
      style={{
        padding: "6px 10px",
        background: warning ? `${colors.amber}11` : `${colors.blue}08`,
        borderRadius: 6,
        marginBottom: 4,
        borderLeft: `3px solid ${warning ? colors.amber : colors.blue}`,
      }}
    >
      <div style={{ fontSize: 12, color: warning ? colors.amber : colors.textPrimary, fontFamily: fonts.mono }}>
        {formula}
      </div>
      {detail && (
        <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{detail}</div>
      )}
    </div>
  );
}

function ConstraintRow({ constraint: c }) {
  const barColor = c.usage > 95 ? colors.red : c.usage > 85 ? colors.amber : colors.green;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", gap: 8, alignItems: "center", marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 600 }}>{c.name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 8, background: colors.borderLight, borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(c.usage, 100)}%`,
              height: "100%",
              background: barColor,
              borderRadius: 4,
              transition: "width 0.4s",
            }}
          />
        </div>
        <span style={{ fontSize: 11, fontFamily: fonts.mono, color: barColor, minWidth: 45, textAlign: "right" }}>
          {c.usage.toFixed(1)}%
        </span>
      </div>
      <div style={{ fontSize: 10, color: colors.textMuted, textAlign: "right" }}>
        {c.rule}
      </div>
    </div>
  );
}

function TradeoffRow({ tradeoff: t }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: t.hasConflict ? `${colors.red}11` : `${colors.amber}08`,
        borderRadius: 6,
        marginBottom: 4,
        borderLeft: `3px solid ${t.hasConflict ? colors.red : colors.amber}`,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: colors.textPrimary, marginBottom: 4 }}>
        {t.scenario}
      </div>
      <div style={{ fontSize: 11, color: colors.textSecondary }}>
        Lo nay: K {t.thisLot.newK.toFixed(2)} ({t.thisLot.deltaK >= 0 ? "+" : ""}{t.thisLot.deltaK.toFixed(3)})
        {t.thisLot.wouldExceed && <span style={{ color: colors.red }}> VUOT</span>}
      </div>
      {t.otherLots.map((o) => (
        <div key={o.lotId} style={{ fontSize: 11, color: colors.textSecondary }}>
          Lo {o.lotId}: K {o.currentK.toFixed(2)} → {o.newK.toFixed(2)}
          {o.wouldExceed && <span style={{ color: colors.red }}> VUOT K max</span>}
        </div>
      ))}
    </div>
  );
}

function MetricBox({ label, value, status, detail }) {
  const statusColors = {
    met: colors.green,
    violated: colors.red,
    partial: colors.amber,
    info: colors.blue,
  };
  return (
    <div
      style={{
        padding: "10px 14px",
        background: `${statusColors[status] || colors.blue}11`,
        borderRadius: 8,
        borderLeft: `3px solid ${statusColors[status] || colors.blue}`,
      }}
    >
      <div style={{ fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 600, fontFamily: fonts.mono }}>
        {value}
      </div>
      {detail && <div style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>{detail}</div>}
    </div>
  );
}

function SmallMetric({ label, value, color = colors.textPrimary }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color, fontFamily: fonts.mono, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    optimal: { bg: colors.statusOptimal.bg, text: colors.statusOptimal.text, label: "Toi uu" },
    good: { bg: colors.statusGood.bg, text: colors.statusGood.text, label: "Kha" },
    low: { bg: colors.statusLow.bg, text: colors.statusLow.text, label: "Thap" },
  };
  const s = map[status] || map.low;
  return (
    <span style={{ background: s.bg, color: s.text, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

// Shared inline styles
const labelStyle = {
  fontSize: 10,
  color: colors.textSecondary,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  display: "block",
  marginBottom: 4,
};

const selectStyle = {
  width: "100%",
  background: colors.bgInput,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  color: colors.textPrimary,
  padding: "8px 12px",
  fontSize: 12,
  outline: "none",
};

const sectionTitle = {
  fontSize: 11,
  fontWeight: 700,
  color: colors.textSecondary,
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 12,
};
