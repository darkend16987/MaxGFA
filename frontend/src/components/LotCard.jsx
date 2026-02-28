import StatusBadge from "./StatusBadge";
import MiniBar from "./MiniBar";
import { BUILDING_SHAPES } from "../data/buildingShapes";
import { fmtNum } from "../utils/format";
import { colors, fonts } from "../styles/theme";

export default function LotCard({ lotResult, expanded, onToggle }) {
  const lr = lotResult;

  return (
    <div
      style={{
        background: colors.bgCardGradient,
        border: `1px solid ${colors.border}`,
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
              background:
                lr.status === "optimal"
                  ? colors.greenDark
                  : lr.status === "over"
                    ? colors.statusOver.bg
                    : lr.status === "good"
                      ? colors.statusGood.bg
                      : colors.statusUnassigned.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
              color: colors.textPrimary,
              fontFamily: fonts.mono,
            }}
          >
            {lr.lot.id}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>{lr.lot.name}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary }}>
              {fmtNum(lr.lot.area, 0)} m² · {lr.buildingCount} tòa · {lr.maxFloors} tầng
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StatusBadge status={lr.status} />
          <span
            style={{
              color: colors.textMuted,
              fontSize: 18,
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 0.3s",
              display: "inline-block",
            }}
          >
            ▾
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ padding: "0 20px 16px", display: "grid", gridTemplateColumns: lr.maxPopulation > 0 ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
        {/* K ratio */}
        <div
          title={"Hệ số sử dụng đất = Tổng DT sàn tính K / DT đất lô\n= " + fmtNum(lr.totalCountedGFA, 0) + " / " + fmtNum(lr.lot.area, 0) + " = " + lr.kAchieved.toFixed(3) + "\nRàng buộc: K ≤ " + lr.kMax.toFixed(2) + " (QCVN)"}
          style={{ cursor: "help" }}
        >
          <div style={{ fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Hệ số SDD
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary, fontFamily: fonts.mono }}>
            {lr.kAchieved.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: colors.textMuted }}>/ {lr.kMax.toFixed(2)} max</div>
          <MiniBar value={lr.kAchieved} max={lr.kMax} color={colors.blue} />
        </div>
        {/* Density */}
        <div
          title={"Mật độ xây dựng = Tổng footprint / DT đất lô\n= Σ(DT điển hình) / " + fmtNum(lr.lot.area, 0) + " = " + (lr.densityAchieved * 100).toFixed(2) + "%\nRàng buộc: MĐXD ≤ " + (lr.densityMax * 100).toFixed(0) + "%"}
          style={{ cursor: "help" }}
        >
          <div style={{ fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Mật độ XD
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary, fontFamily: fonts.mono }}>
            {(lr.densityAchieved * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: colors.textMuted }}>/ {(lr.densityMax * 100).toFixed(0)}% max</div>
          <MiniBar value={lr.densityAchieved} max={lr.densityMax} color={colors.purple} />
        </div>
        {/* Total GFA */}
        <div
          title={"DT sàn tính vào hệ số K cho lô này.\n= Σ(DT điển hình × " + lr.maxFloors + " tầng tính K)\n= " + fmtNum(lr.totalCountedGFA, 0) + " m²\nDT sàn thực (bao gồm tầng trừ): " + fmtNum(lr.totalActualGFA, 0) + " m²"}
          style={{ cursor: "help" }}
        >
          <div style={{ fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Tổng DT sàn (tính K)
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.greenLight, fontFamily: fonts.mono }}>
            {fmtNum(lr.totalCountedGFA, 0)}
          </div>
          <div style={{ fontSize: 10, color: colors.textMuted }}>m²</div>
          <MiniBar value={lr.utilizationRate} max={1} color={colors.green} />
        </div>
        {/* Population */}
        {lr.maxPopulation > 0 && (
          <div
            title={`Dân số = Σ(DT điển hình × tầng ở × hệ số thông thủy / DT/người)\n= ${fmtNum(lr.populationCalc, 0)} người\nGiới hạn: ${fmtNum(lr.maxPopulation, 0)} người`}
            style={{ cursor: "help" }}
          >
            <div style={{ fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Dân số
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: lr.isOverPopulation ? colors.red : colors.textPrimary, fontFamily: fonts.mono }}>
              {fmtNum(lr.populationCalc, 0)}
            </div>
            <div style={{ fontSize: 10, color: colors.textMuted }}>/ {fmtNum(lr.maxPopulation, 0)} max</div>
            <MiniBar value={lr.populationCalc} max={lr.maxPopulation} color={colors.amber} />
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${colors.borderLight}`, padding: "16px 20px", background: colors.bgExpanded }}>
          <div style={{ fontSize: 11, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Chi tiết từng tòa
          </div>
          {lr.wasScaled && (
            <div style={{ fontSize: 11, color: colors.amber, marginBottom: 8, padding: "6px 10px", background: "#78350f22", borderRadius: 6 }}>
              * Toàn bộ mẫu tòa đã scale xuống {(lr.scaleFactor * 100).toFixed(1)}% (global) do có lô vượt ràng buộc
            </div>
          )}
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
                    background: colors.borderLight,
                    borderRadius: 8,
                    borderLeft: `3px solid ${shape?.color || colors.textMuted}`,
                  }}
                >
                  <span style={{ fontSize: 18, textAlign: "center" }}>{shape?.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{b.type.label}</div>
                    <div style={{ fontSize: 10, color: colors.textSecondary }}>
                      DT điển hình: {fmtNum(b.adjustedTypicalArea, 1)} m²
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>Tính hệ số</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.cyan, fontFamily: fonts.mono }}>
                      {fmtNum(b.adjustedCountedGFA, 0)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>Tổng thực</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.indigo, fontFamily: fonts.mono }}>
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
