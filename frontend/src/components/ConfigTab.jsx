import { useState } from "react";
import ConfigInput from "./ConfigInput";
import { BUILDING_SHAPES } from "../data/buildingShapes";
import { generateId } from "../data/defaultProject";
import { colors, fonts } from "../styles/theme";

export default function ConfigTab({ project, setProject }) {
  const [newLotId, setNewLotId] = useState("");

  const updateLot = (lotId, field, value) => {
    setProject((p) => ({
      ...p,
      lots: p.lots.map((l) => (l.id === lotId ? { ...l, [field]: value } : l)),
    }));
  };

  const addLot = () => {
    const id = newLotId.trim() || generateId("lot");
    const newLot = {
      id,
      name: `Lô ${id}`,
      area: 20000,
      kMax: 5.0,
      densityMax: 0.40,
      maxFloors: 30,
      minFloors: 3,
      notes: "",
    };
    setProject((p) => ({
      ...p,
      lots: [...p.lots, newLot],
      assignments: [...p.assignments, { lotId: id, buildings: [] }],
    }));
    setNewLotId("");
  };

  const removeLot = (lotId) => {
    setProject((p) => ({
      ...p,
      lots: p.lots.filter((l) => l.id !== lotId),
      assignments: p.assignments.filter((a) => a.lotId !== lotId),
    }));
  };

  const updateAssignmentArray = (lotId, buildings) => {
    setProject((p) => ({
      ...p,
      assignments: p.assignments.map((a) => (a.lotId === lotId ? { ...a, buildings } : a)),
    }));
  };

  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Cấu hình Dự án</h2>
      <p style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 24 }}>
        Thiết lập thông số các lô đất và phân bổ tòa nhà. Thay đổi sẽ được phản ánh khi nhấn "Tính lại".
      </p>

      {/* Project Settings */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 16,
          marginBottom: 32,
          background: colors.bgCard,
          padding: 20,
          borderRadius: 12,
        }}
      >
        <ConfigInput
          label="Tên dự án"
          value={project.name}
          onChange={(v) => setProject((p) => ({ ...p, name: v }))}
          type="text"
        />
        <ConfigInput
          label="Tỷ lệ trừ (KT, PCCC...)"
          value={project.settings.deductionRate}
          onChange={(v) => setProject((p) => ({ ...p, settings: { ...p.settings, deductionRate: v } }))}
          suffix="x"
        />
        <ConfigInput
          label="Số tầng TMDV"
          value={project.settings.commercialFloors}
          onChange={(v) => setProject((p) => ({ ...p, settings: { ...p.settings, commercialFloors: v } }))}
          suffix="tầng"
        />
        <ConfigInput
          label="Ngưỡng K tối thiểu"
          value={project.settings.kTargetMin}
          onChange={(v) => setProject((p) => ({ ...p, settings: { ...p.settings, kTargetMin: v } }))}
          suffix="x Kmax"
        />
      </div>

      {/* Lot Configuration */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1 }}>
          Thông số Lô đất ({project.lots.length} lô)
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={newLotId}
            onChange={(e) => setNewLotId(e.target.value)}
            placeholder="ID lô mới..."
            style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              color: colors.textPrimary,
              padding: "6px 10px",
              fontSize: 12,
              width: 120,
              outline: "none",
            }}
          />
          <button
            onClick={addLot}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: `1px solid ${colors.green}`,
              background: `${colors.green}22`,
              color: colors.green,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Thêm lô
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {project.lots.map((lot) => (
          <div key={lot.id} style={{ background: colors.bgCard, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 100px 100px 100px 40px", gap: 12, alignItems: "end" }}>
              <ConfigInput label="Ký hiệu" value={lot.id} onChange={(v) => updateLot(lot.id, "id", v)} type="text" small />
              <ConfigInput label="Tên lô" value={lot.name} onChange={(v) => updateLot(lot.id, "name", v)} type="text" small />
              <ConfigInput label="Diện tích" value={lot.area} onChange={(v) => updateLot(lot.id, "area", v)} suffix="m²" small />
              <ConfigInput label="K max" value={lot.kMax} onChange={(v) => updateLot(lot.id, "kMax", v)} suffix="lần" small />
              <ConfigInput label="MĐXD max" value={lot.densityMax} onChange={(v) => updateLot(lot.id, "densityMax", v)} small />
              <ConfigInput label="Tầng max" value={lot.maxFloors} onChange={(v) => updateLot(lot.id, "maxFloors", v)} suffix="tầng" small />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeLot(lot.id);
                }}
                style={{
                  background: `${colors.red}22`,
                  border: `1px solid ${colors.red}44`,
                  borderRadius: 6,
                  color: colors.red,
                  cursor: "pointer",
                  padding: "4px 0",
                  fontSize: 14,
                  alignSelf: "end",
                  marginBottom: 1,
                }}
                title="Xóa lô đất"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Assignment Table */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginTop: 32, marginBottom: 12 }}>
        Phân bổ Tòa nhà
      </h3>
      <div style={{ background: colors.bgCard, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
          Mỗi lô chứa danh sách ID mẫu tòa (cách nhau bằng dấu phẩy). Ví dụ: L_short, L_short, Z1
        </div>
        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12 }}>
          Mẫu tòa hiện có: {project.buildingTypes.map((bt) => bt.id).join(", ")}
        </div>
        {project.assignments.map((a) => (
          <div key={a.lotId} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, marginBottom: 8, alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary, fontFamily: fonts.mono }}>
              Lô {a.lotId}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", background: colors.borderLight, padding: "8px 12px", borderRadius: 6, border: `1px solid ${colors.border}` }}>
              {a.buildings.map((bId, idx) => {
                const bType = project.buildingTypes.find(bt => bt.id === bId);
                const bName = bType ? bType.name : bId;
                return (
                  <div key={`${bId}-${idx}`} style={{ display: "flex", alignItems: "center", background: `${colors.green}22`, border: `1px solid ${colors.green}44`, color: colors.green, padding: "4px 8px", borderRadius: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>{bName} ({bId})</span>
                    <button
                      onClick={() => {
                        const newBuildings = [...a.buildings];
                        newBuildings.splice(idx, 1);
                        updateAssignmentArray(a.lotId, newBuildings);
                      }}
                      style={{ background: "transparent", border: "none", color: "inherit", marginLeft: 6, cursor: "pointer", fontSize: 16, fontWeight: "bold", padding: "0 2px", lineHeight: 1 }}
                      title="Xóa"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    updateAssignmentArray(a.lotId, [...a.buildings, e.target.value]);
                  }
                }}
                style={{
                  background: colors.bgCard,
                  border: `1px dashed ${colors.border}`,
                  borderRadius: 4,
                  color: colors.textSecondary,
                  padding: "4px 8px",
                  fontSize: 13,
                  outline: "none",
                  cursor: "pointer",
                  fontFamily: fonts.sans,
                }}
              >
                <option value="">+ Thêm tòa nhà...</option>
                {project.buildingTypes.map(bt => (
                  <option key={bt.id} value={bt.id}>{bt.name} ({bt.id})</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
