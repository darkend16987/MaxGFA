import { colors } from "../styles/theme";

export default function MiniBar({ value, max, color = colors.blue, height = 6 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      style={{
        background: colors.borderLight,
        borderRadius: height / 2,
        height,
        width: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: pct > 95 ? colors.red : pct > 85 ? color : colors.textMuted,
          borderRadius: height / 2,
          transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </div>
  );
}
