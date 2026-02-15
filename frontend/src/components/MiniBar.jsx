import { colors } from "../styles/theme";

export default function MiniBar({ value, max, color = colors.blue, height = 6 }) {
  const ratio = max > 0 ? (value / max) * 100 : 0;
  const isOver = ratio > 100;
  const pct = Math.max(0, Math.min(ratio, 100));
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
          background: isOver ? colors.red : pct > 95 ? colors.amber : pct > 85 ? color : colors.textMuted,
          borderRadius: height / 2,
          transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </div>
  );
}
