import { BUILDING_SHAPES } from "../data/buildingShapes";
import { fmtNum } from "../utils/format";
import { colors, fonts } from "../styles/theme";

export default function TypeSummaryCard({ agg }) {
  const shape = BUILDING_SHAPES[agg.type.shape];
  return (
    <div
      style={{
        background: colors.bgCardGradient,
        border: `1px solid ${shape?.color || colors.border}33`,
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
          background: `${shape?.color || colors.border}22`,
          border: `2px solid ${shape?.color || colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        {shape?.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{agg.type.label}</div>
        <div style={{ fontSize: 11, color: colors.textSecondary }}>
          {agg.count} tòa · Lô {[...new Set(agg.lots)].join(", ")}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 10, color: colors.textMuted, textTransform: "uppercase" }}>Tổng DT sàn</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: shape?.color || colors.textPrimary,
            fontFamily: fonts.mono,
          }}
        >
          {fmtNum(agg.totalCountedGFA, 0)}
        </div>
        <div style={{ fontSize: 10, color: colors.textMuted }}>m² (tính K)</div>
      </div>
    </div>
  );
}
