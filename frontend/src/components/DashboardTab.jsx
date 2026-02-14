import LotCard from "./LotCard";
import TypeSummaryCard from "./TypeSummaryCard";
import { fmtNum } from "../utils/format";
import { colors, fonts } from "../styles/theme";

export default function DashboardTab({ result, expandedLots, toggleLot, optimizationLog }) {
  const pt = result.projectTotal;

  const kpiCards = [
    {
      label: "Tổng DT sàn (tính K)",
      value: fmtNum(pt.totalCountedGFA, 0),
      unit: "m²",
      color: colors.blue,
      icon: "◫",
      tooltip: "Tổng diện tích sàn được TÍNH VÀO hệ số K theo QCVN.\nCông thức: Σ(DT điển hình × số tầng tính K) cho tất cả tòa.\nĐây là chỉ tiêu pháp lý chính, dùng để kiểm tra K = DT sàn / DT đất ≤ K max.",
    },
    {
      label: "Tổng DT sàn thực",
      value: fmtNum(pt.totalActualGFA, 0),
      unit: "m²",
      color: colors.purple,
      icon: "▤",
      tooltip: "Tổng diện tích sàn XÂY DỰNG THỰC TẾ, bao gồm cả tầng kỹ thuật, PCCC, tum thang máy, mái.\nLuôn > DT tính K vì có thêm tầng trừ (không vi phạm K).\nCông thức: DT tính K + Σ(DT điển hình × số tầng trừ).",
    },
    {
      label: "Hệ số SDD TB",
      value: pt.avgK.toFixed(2),
      unit: "lần",
      color: colors.green,
      icon: "K",
      tooltip: "Hệ số sử dụng đất trung bình toàn dự án.\nCông thức: Tổng DT sàn tính K / Tổng DT đất.\nQuy chuẩn QCVN 01:2021 yêu cầu ≤ 13 lần.",
    },
    {
      label: "Tỷ lệ tối ưu TB",
      value: (pt.avgUtilization * 100).toFixed(1) + "%",
      unit: "",
      color: colors.amber,
      icon: "%",
      tooltip: "Trung bình % K đạt được so với K max cho phép.\n100% = tận dụng tối đa hệ số K.\nMục tiêu: ≥ 90% (ngưỡng tối ưu mặc định).",
    },
  ];

  return (
    <div className="animate-in">
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {kpiCards.map((kpi, i) => (
          <div
            key={i}
            title={kpi.tooltip}
            style={{
              background: colors.bgCardGradient,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: "20px 24px",
              position: "relative",
              overflow: "hidden",
              cursor: "help",
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
            <div style={{ fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, fontFamily: fonts.mono, lineHeight: 1 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>{kpi.unit}</div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
        {/* Left: Lot Results */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
            Phân tích theo Lô đất ({result.lotResults.length} lô · {pt.totalBuildings} tòa)
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {result.lotResults.map((lr) => (
              <LotCard
                key={lr.lot.id}
                lotResult={lr}
                expanded={expandedLots[lr.lot.id]}
                onToggle={() => toggleLot(lr.lot.id)}
              />
            ))}
          </div>
        </div>

        {/* Right: Type Summary + Log */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
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
              <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                Lịch sử tối ưu
              </h2>
              <div style={{ background: colors.bgCard, borderRadius: 10, padding: 12, maxHeight: 240, overflow: "auto" }}>
                {optimizationLog.map((log, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: `1px solid ${colors.borderLight}`,
                      fontSize: 11,
                    }}
                  >
                    <span style={{ color: colors.textMuted }}>{log.time}</span>
                    <span style={{ color: colors.textSecondary }}>{log.action}</span>
                    <span style={{ color: colors.greenLight, fontFamily: fonts.mono, fontWeight: 600 }}>
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
  );
}
