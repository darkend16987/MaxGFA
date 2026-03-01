import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchProjects, createProject, archiveProject, unarchiveProject, deleteProject } from "../lib/database";
import { DEFAULT_PROJECT } from "../data/defaultProject";
import { colors, fonts } from "../styles/theme";

export default function ProjectListPage({ onOpenProject }) {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      setError("Không thể tải danh sách dự án: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const name = newName.trim() || "Dự án mới";
    try {
      const project = await createProject(name, { ...DEFAULT_PROJECT, name });
      setNewName("");
      setCreating(false);
      onOpenProject(project.id);
    } catch (err) {
      setError("Không thể tạo dự án: " + err.message);
    }
  };

  const handleArchive = async (id) => {
    try {
      await archiveProject(id);
      await load();
    } catch (err) {
      setError("Lỗi: " + err.message);
    }
  };

  const handleUnarchive = async (id) => {
    try {
      await unarchiveProject(id);
      await load();
    } catch (err) {
      setError("Lỗi: " + err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Xóa vĩnh viễn dự án "${name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await deleteProject(id);
      await load();
    } catch (err) {
      setError("Lỗi: " + err.message);
    }
  };

  const activeProjects = projects.filter((p) => p.status === "active");
  const archivedProjects = projects.filter((p) => p.status === "archived");
  const displayProjects = showArchived ? archivedProjects : activeProjects;

  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        fontFamily: fonts.body,
        color: colors.textPrimary,
      }}
    >
      {/* Header */}
      <header
        style={{
          background: colors.bgHeader,
          borderBottom: `1px solid ${colors.borderLight}`,
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            ⌂
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>GFA Optimizer</h1>
            <p style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
              Quản lý dự án
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: colors.textSecondary }}>{user?.email}</span>
          <button
            onClick={signOut}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.borderLight,
              color: colors.textPrimary,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ padding: "32px", maxWidth: 1000, margin: "0 auto" }}>
        {/* Title + Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Dự án của bạn</h2>
            <p style={{ fontSize: 13, color: colors.textSecondary }}>
              {activeProjects.length} dự án hoạt động
              {archivedProjects.length > 0 && ` · ${archivedProjects.length} đã lưu trữ`}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {archivedProjects.length > 0 && (
              <button
                onClick={() => setShowArchived(!showArchived)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  background: showArchived ? `${colors.amber}22` : colors.borderLight,
                  color: showArchived ? colors.amber : colors.textPrimary,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {showArchived ? "Dự án hoạt động" : "Lưu trữ"}
              </button>
            )}
            <button
              onClick={() => setCreating(true)}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + Tạo dự án mới
            </button>
          </div>
        </div>

        {/* Create project dialog */}
        {creating && (
          <div
            style={{
              background: colors.bgCard,
              border: `1px solid ${colors.blue}44`,
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              display: "flex",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Tên dự án
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="VD: Dự án Đảo Vũ Yên"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                style={{
                  width: "100%",
                  background: colors.bgInput,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  color: colors.textPrimary,
                  padding: "10px 14px",
                  fontSize: 14,
                  marginTop: 6,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={handleCreate}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: colors.green,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Tạo
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.borderLight,
                color: colors.textSecondary,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: `${colors.red}15`,
              border: `1px solid ${colors.red}33`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: colors.red,
              marginBottom: 16,
            }}
          >
            {error}
            <button
              onClick={() => setError("")}
              style={{ marginLeft: 12, background: "none", border: "none", color: colors.red, cursor: "pointer", fontWeight: 700 }}
            >
              x
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: colors.textMuted }}>
            Đang tải...
          </div>
        )}

        {/* Empty state */}
        {!loading && displayProjects.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              background: colors.bgCard,
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>
              {showArchived ? "📦" : "📂"}
            </div>
            <p style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
              {showArchived ? "Không có dự án lưu trữ" : "Chưa có dự án nào"}
            </p>
            {!showArchived && (
              <p style={{ fontSize: 12, color: colors.textMuted }}>
                Nhấn "Tạo dự án mới" để bắt đầu
              </p>
            )}
          </div>
        )}

        {/* Project Grid */}
        {!loading && displayProjects.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {displayProjects.map((p) => (
              <div
                key={p.id}
                style={{
                  background: colors.bgCard,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: 20,
                  cursor: "pointer",
                  transition: "border-color 0.2s",
                }}
                onClick={() => onOpenProject(p.id)}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.blue)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{p.name}</h3>
                    {p.description && (
                      <p style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.4 }}>
                        {p.description.slice(0, 100)}
                      </p>
                    )}
                  </div>
                  {p.status === "archived" && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: `${colors.amber}22`,
                        color: colors.amber,
                        fontWeight: 600,
                      }}
                    >
                      Lưu trữ
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 12 }}>
                  Cập nhật: {formatDate(p.updated_at)}
                  <span style={{ margin: "0 8px" }}>·</span>
                  Tạo: {formatDate(p.created_at)}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProject(p.id);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: `1px solid ${colors.blue}44`,
                      background: `${colors.blue}15`,
                      color: colors.blue,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Mở
                  </button>
                  {p.status === "active" ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(p.id);
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: `1px solid ${colors.border}`,
                        background: colors.borderLight,
                        color: colors.textSecondary,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      Lưu trữ
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnarchive(p.id);
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: `1px solid ${colors.green}44`,
                        background: `${colors.green}15`,
                        color: colors.green,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      Khôi phục
                    </button>
                  )}
                  {p.status === "archived" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id, p.name);
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: `1px solid ${colors.red}44`,
                        background: `${colors.red}15`,
                        color: colors.red,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
