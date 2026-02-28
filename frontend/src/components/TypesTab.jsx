import { useState } from "react";
import ConfigInput from "./ConfigInput";
import { BUILDING_SHAPES } from "../data/buildingShapes";
import { generateId } from "../data/defaultProject";
import { colors, fonts } from "../styles/theme";

export default function TypesTab({ project, setProject }) {
  const [newTypeLabel, setNewTypeLabel] = useState("");

  const updateBuildingType = (typeId, field, value) => {
    setProject((p) => ({
      ...p,
      buildingTypes: p.buildingTypes.map((bt) => (bt.id === typeId ? { ...bt, [field]: value } : bt)),
    }));
  };

  const addBuildingType = () => {
    const label = newTypeLabel.trim() || "Mẫu mới";
    const id = generateId("type");
    const newType = {
      id,
      shape: "I",
      label,
      typicalArea: 1200,
      minTypicalArea: 800,
      maxTypicalArea: 1600,
      totalFloors: 30,
      commercialFloors: 2,
      variants: [],
      description: "",
    };
    setProject((p) => ({
      ...p,
      buildingTypes: [...p.buildingTypes, newType],
    }));
    setNewTypeLabel("");
  };

  const removeBuildingType = (typeId) => {
    setProject((p) => ({
      ...p,
      buildingTypes: p.buildingTypes.filter((bt) => bt.id !== typeId),
      // Also remove from assignments
      assignments: p.assignments.map((a) => ({
        ...a,
        buildings: a.buildings.filter((id) => id !== typeId),
      })),
    }));
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Mẫu Tòa nhà</h2>
          <p style={{ fontSize: 13, color: colors.textSecondary }}>
            Cấu hình diện tích sàn điển hình cho từng mẫu. Các tòa cùng mẫu sẽ có diện tích giống nhau.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={newTypeLabel}
            onChange={(e) => setNewTypeLabel(e.target.value)}
            placeholder="Tên mẫu mới..."
            style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              color: colors.textPrimary,
              padding: "6px 10px",
              fontSize: 12,
              width: 140,
              outline: "none",
            }}
          />
          <button
            onClick={addBuildingType}
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
            + Thêm mẫu
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {project.buildingTypes.map((bt) => {
          const shape = BUILDING_SHAPES[bt.shape];
          return (
            <div
              key={bt.id}
              style={{
                background: colors.bgCardGradient,
                border: `1px solid ${shape?.color || colors.border}44`,
                borderRadius: 12,
                padding: 20,
                position: "relative",
              }}
            >
              {/* Remove button */}
              <button
                onClick={() => removeBuildingType(bt.id)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  background: `${colors.red}22`,
                  border: `1px solid ${colors.red}44`,
                  borderRadius: 6,
                  color: colors.red,
                  cursor: "pointer",
                  padding: "2px 8px",
                  fontSize: 12,
                }}
                title="Xóa mẫu tòa"
              >
                ×
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
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
                    fontSize: 24,
                  }}
                >
                  {shape?.icon}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{bt.label}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>
                    {shape?.label} · ID: {bt.id}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <ConfigInput
                  label="DT sàn điển hình"
                  value={bt.typicalArea}
                  onChange={(v) => updateBuildingType(bt.id, "typicalArea", v)}
                  suffix="m²"
                />
                <div>
                  <label style={{ fontSize: 10, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Hình dạng
                  </label>
                  <select
                    value={bt.shape}
                    onChange={(e) => updateBuildingType(bt.id, "shape", e.target.value)}
                    style={{
                      width: "100%",
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 6,
                      color: colors.textPrimary,
                      padding: "8px 12px",
                      fontSize: 14,
                      marginTop: 4,
                      outline: "none",
                    }}
                  >
                    {Object.entries(BUILDING_SHAPES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.icon} {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Min/Max typical area bounds — ràng buộc C4 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <ConfigInput
                  label="DT sàn tối thiểu"
                  value={bt.minTypicalArea || ""}
                  onChange={(v) => updateBuildingType(bt.id, "minTypicalArea", v)}
                  suffix="m²"
                />
                <ConfigInput
                  label="DT sàn tối đa"
                  value={bt.maxTypicalArea || ""}
                  onChange={(v) => updateBuildingType(bt.id, "maxTypicalArea", v)}
                  suffix="m²"
                />
              </div>
              {bt.minTypicalArea > 0 && bt.maxTypicalArea > 0 && bt.minTypicalArea > bt.maxTypicalArea && (
                <div style={{ fontSize: 11, color: colors.red, marginBottom: 8 }}>
                  DT tối thiểu phải nhỏ hơn DT tối đa
                </div>
              )}
              {bt.minTypicalArea > 0 && bt.typicalArea < bt.minTypicalArea && (
                <div style={{ fontSize: 11, color: colors.amber, marginBottom: 8 }}>
                  DT điển hình hiện tại thấp hơn giới hạn tối thiểu
                </div>
              )}
              {bt.maxTypicalArea > 0 && bt.typicalArea > bt.maxTypicalArea && (
                <div style={{ fontSize: 11, color: colors.amber, marginBottom: 8 }}>
                  DT điển hình hiện tại cao hơn giới hạn tối đa
                </div>
              )}

              {/* Floor breakdown — Tầng ở / Tầng TMDV */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <ConfigInput
                  label="Tổng số tầng"
                  value={bt.totalFloors || ""}
                  onChange={(v) => updateBuildingType(bt.id, "totalFloors", v)}
                  suffix="tầng"
                />
                <ConfigInput
                  label="Tầng TMDV"
                  value={bt.commercialFloors ?? ""}
                  onChange={(v) => updateBuildingType(bt.id, "commercialFloors", v)}
                  suffix="tầng"
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 10, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Tầng ở (tính dân)
                  </label>
                  <div style={{
                    padding: "8px 12px",
                    fontSize: 14,
                    fontFamily: fonts.mono,
                    color: colors.cyan,
                    fontWeight: 600,
                    background: `${colors.cyan}11`,
                    borderRadius: 6,
                    border: `1px solid ${colors.cyan}33`,
                  }}>
                    {(bt.totalFloors || 0) - (bt.commercialFloors ?? 0)} tầng
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <ConfigInput
                  label="Tên hiển thị"
                  value={bt.label}
                  onChange={(v) => updateBuildingType(bt.id, "label", v)}
                  type="text"
                />
                <ConfigInput
                  label="ID (dùng trong phân bổ)"
                  value={bt.id}
                  onChange={(v) => updateBuildingType(bt.id, "id", v)}
                  type="text"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
