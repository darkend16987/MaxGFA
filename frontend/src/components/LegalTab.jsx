import { LEGAL_RULES } from "../data/legalRules";
import { colors } from "../styles/theme";

export default function LegalTab() {
  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Quy định Pháp lý</h2>
      <p style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
        Các văn bản quy phạm pháp luật được tham chiếu trong tính toán.
      </p>
      <div
        style={{
          background: `${colors.amber}11`,
          border: `1px solid ${colors.amber}33`,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 24,
          fontSize: 13,
          color: colors.amber,
        }}
      >
        Nguyên tắc: Khi có 2 quy định chồng chéo về cùng 1 vấn đề, quy định có lợi hơn cho chủ đầu tư sẽ được áp dụng.
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {Object.values(LEGAL_RULES).map((rule) => (
          <div
            key={rule.id}
            style={{
              background: colors.bgCardGradient,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: colors.blue }} />
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>{rule.name}</h3>
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12, paddingLeft: 20 }}>
              {rule.description} · {rule.date}
            </div>

            <div style={{ paddingLeft: 20 }}>
              {/* Deductions list */}
              {rule.rules.deductions && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: colors.textSecondary, textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>
                    Diện tích được trừ khi tính hệ số SDD:
                  </div>
                  {rule.rules.deductions.map((d) => (
                    <div key={d.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <span style={{ color: colors.green, fontSize: 12, marginTop: 1 }}>✓</span>
                      <div>
                        <span style={{ fontSize: 13, color: "#cbd5e1" }}>{d.label}</span>
                        {d.description && (
                          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{d.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Max combined FAR */}
              {rule.rules.maxCombinedFAR && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#cbd5e1" }}>
                  Hệ số SDD chung (đế + tháp) tối đa:{" "}
                  <strong style={{ color: colors.amber }}>{rule.rules.maxCombinedFAR} lần</strong>
                </div>
              )}

              {/* Notes */}
              {rule.rules.notes &&
                rule.rules.notes.map((note, i) => (
                  <div key={i} style={{ marginTop: 4, fontSize: 13, color: "#cbd5e1" }}>
                    <span style={{ color: colors.green }}>✓</span> {note}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
