import { useState, useCallback, useEffect, useRef } from "react";
import DashboardTab from "./components/DashboardTab";
import ConfigTab from "./components/ConfigTab";
import TypesTab from "./components/TypesTab";
import LegalTab from "./components/LegalTab";
import { calculateGFA, validateProject } from "./engine";
import { runCombinedOptimization } from "./engine/optimizer";
import { DEFAULT_PROJECT } from "./data/defaultProject";
import { exportToExcel } from "./utils/excelExport";
import {
  saveProject,
  loadProject,
  hasSavedProject,
  exportProjectJSON,
  importProjectJSON,
} from "./utils/storage";
import { colors, fonts, globalStyles } from "./styles/theme";

// ============================================================
// GFA OPTIMIZER — Main Application
// Phase 1: Total GFA Optimization
// ============================================================

const TABS = [
  { id: "dashboard", label: "Tổng quan" },
  { id: "config", label: "Cấu hình" },
  { id: "types", label: "Mẫu tòa" },
  { id: "legal", label: "Pháp lý" },
];

export default function App() {
  // Load saved project or use default
  const [project, setProject] = useState(() => {
    if (hasSavedProject()) {
      const saved = loadProject();
      if (saved && saved.lots && saved.buildingTypes && saved.settings) return saved;
    }
    return DEFAULT_PROJECT;
  });

  const [result, setResult] = useState(null);
  const [expandedLots, setExpandedLots] = useState({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationLog, setOptimizationLog] = useState([]);
  const [validationIssues, setValidationIssues] = useState([]);
  const [showSaveNotice, setShowSaveNotice] = useState(false);

  const fileInputRef = useRef(null);

  // Initial calculation
  useEffect(() => {
    const r = calculateGFA(project);
    setResult(r);
    const issues = validateProject(project);
    setValidationIssues(issues);
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      saveProject(project);
    }, 30000);
    return () => clearInterval(interval);
  }, [project]);

  // Recalculate
  const handleRecalculate = useCallback(() => {
    const issues = validateProject(project);
    setValidationIssues(issues);

    const r = calculateGFA(project);
    setResult(r);
    setOptimizationLog((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        action: "Tính toán lại",
        totalGFA: r.projectTotal.totalCountedGFA,
      },
    ]);
    saveProject(project);
  }, [project]);

  // Optimize
  const handleOptimize = useCallback(() => {
    setIsOptimizing(true);
    setTimeout(() => {
      const optimized = runCombinedOptimization(project);
      setResult(optimized.result);
      setProject((p) => ({ ...p, buildingTypes: optimized.types }));
      setIsOptimizing(false);
      setOptimizationLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          action: `Tối ưu (${optimized.stats.method}, +${optimized.stats.improvement.toFixed(2)}%)`,
          totalGFA: optimized.result.projectTotal.totalCountedGFA,
        },
      ]);
      saveProject({ ...project, buildingTypes: optimized.types });
    }, 50);
  }, [project]);

  // Export Excel
  const handleExportExcel = useCallback(() => {
    if (result) {
      exportToExcel(project, result);
    }
  }, [project, result]);

  // Export JSON
  const handleExportJSON = useCallback(() => {
    exportProjectJSON(project);
  }, [project]);

  // Import JSON
  const handleImportJSON = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importProjectJSON(file);
      setProject(imported);
      const r = calculateGFA(imported);
      setResult(r);
      setOptimizationLog((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), action: "Import dự án", totalGFA: r.projectTotal.totalCountedGFA },
      ]);
    } catch (err) {
      alert("Lỗi import: " + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Save manually
  const handleSave = useCallback(() => {
    saveProject(project);
    setShowSaveNotice(true);
    setTimeout(() => setShowSaveNotice(false), 2000);
  }, [project]);

  // Toggle lot expansion
  const toggleLot = (lotId) => setExpandedLots((prev) => ({ ...prev, [lotId]: !prev[lotId] }));

  if (!result) {
    return (
      <div style={{ color: colors.textPrimary, padding: 40, background: colors.bg, minHeight: "100vh" }}>
        Đang tải...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.textPrimary, fontFamily: fonts.body }}>
      <style>{globalStyles}</style>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportJSON}
        style={{ display: "none" }}
      />

      {/* === HEADER === */}
      <header
        style={{
          background: colors.bgHeader,
          borderBottom: `1px solid ${colors.borderLight}`,
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Logo + Title */}
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
              Phase 1 · Tối ưu Tổng Diện Tích Sàn · {project.name}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav style={{ display: "flex", gap: 2, background: colors.bgCard, borderRadius: 10, padding: 3 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: activeTab === tab.id ? colors.blue : "transparent",
                color: activeTab === tab.id ? "#fff" : colors.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {showSaveNotice && (
            <span style={{ fontSize: 11, color: colors.green, marginRight: 8 }}>Đã lưu!</span>
          )}

          <button
            onClick={handleSave}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.borderLight,
              color: colors.textPrimary,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Lưu dự án (localStorage)"
          >
            Lưu
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.borderLight,
              color: colors.textPrimary,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Import dự án từ JSON"
          >
            Import
          </button>

          <button
            onClick={handleExportJSON}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.borderLight,
              color: colors.textPrimary,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Export cấu hình JSON"
          >
            JSON
          </button>

          <button
            onClick={handleExportExcel}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: `1px solid ${colors.green}44`,
              background: `${colors.green}22`,
              color: colors.green,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Export kết quả ra file Excel (.xlsx)"
          >
            Excel
          </button>

          <div style={{ width: 1, height: 24, background: colors.border, margin: "0 4px" }} />

          <button
            onClick={handleRecalculate}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.borderLight,
              color: colors.textPrimary,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tính lại
          </button>

          <button
            onClick={handleOptimize}
            disabled={isOptimizing}
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              border: "none",
              background: isOptimizing
                ? colors.borderLight
                : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: isOptimizing ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isOptimizing ? (
              <span className="pulse">Đang tối ưu...</span>
            ) : (
              "Tối ưu hóa"
            )}
          </button>
        </div>
      </header>

      {/* === VALIDATION WARNINGS === */}
      {validationIssues.length > 0 && (
        <div style={{ padding: "8px 32px", background: "#78350f22" }}>
          {validationIssues.map((issue, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: issue.level === "error" ? colors.red : colors.amber,
                padding: "2px 0",
              }}
            >
              {issue.level === "error" ? "X" : "!"} {issue.message}
            </div>
          ))}
        </div>
      )}

      {/* === MAIN CONTENT === */}
      <main style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
        {activeTab === "dashboard" && (
          <DashboardTab
            result={result}
            expandedLots={expandedLots}
            toggleLot={toggleLot}
            optimizationLog={optimizationLog}
          />
        )}

        {activeTab === "config" && <ConfigTab project={project} setProject={setProject} />}

        {activeTab === "types" && <TypesTab project={project} setProject={setProject} />}

        {activeTab === "legal" && <LegalTab />}
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "24px 32px",
          borderTop: `1px solid ${colors.borderLight}`,
          fontSize: 11,
          color: colors.textDim,
        }}
      >
        GFA Optimizer v1.0 · Phase 1: Tối ưu Tổng Diện Tích Sàn · Built for INNO JSC
      </footer>
    </div>
  );
}
