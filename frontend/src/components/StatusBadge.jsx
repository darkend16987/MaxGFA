import { colors } from "../styles/theme";

const statusMap = {
  optimal: { bg: colors.statusOptimal.bg, text: colors.statusOptimal.text, label: "Tối ưu" },
  good: { bg: colors.statusGood.bg, text: colors.statusGood.text, label: "Khá" },
  low: { bg: colors.statusLow.bg, text: colors.statusLow.text, label: "Thấp" },
  unassigned: { bg: colors.statusUnassigned.bg, text: colors.statusUnassigned.text, label: "Chưa gán" },
};

export default function StatusBadge({ status }) {
  const s = statusMap[status] || statusMap.unassigned;
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
