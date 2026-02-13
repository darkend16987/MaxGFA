import { colors, fonts } from "../styles/theme";

export default function ConfigInput({ label, value, onChange, type = "number", suffix, small = false, placeholder = "" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        style={{
          fontSize: 10,
          color: colors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) =>
            onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)
          }
          style={{
            background: colors.bgInput,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            color: colors.textPrimary,
            padding: small ? "4px 8px" : "8px 12px",
            fontSize: small ? 12 : 14,
            fontFamily: fonts.mono,
            width: "100%",
            outline: "none",
          }}
        />
        {suffix && (
          <span style={{ fontSize: 11, color: colors.textMuted, whiteSpace: "nowrap" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
