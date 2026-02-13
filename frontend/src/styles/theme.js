// ============================================================
// DESIGN TOKENS / THEME
// Centralized styling constants
// ============================================================

export const colors = {
  // Base
  bg: "#020617",
  bgCard: "#0f172a",
  bgCardGradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
  bgInput: "#0f172a",
  bgHeader: "linear-gradient(90deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
  bgExpanded: "#0c1222",

  // Borders
  border: "#334155",
  borderLight: "#1e293b",

  // Text
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  textDim: "#475569",

  // Accents
  blue: "#3b82f6",
  purple: "#8b5cf6",
  green: "#10b981",
  greenLight: "#34d399",
  greenDark: "#065f46",
  amber: "#f59e0b",
  red: "#ef4444",
  redDark: "#991b1b",
  cyan: "#67e8f9",
  indigo: "#a5b4fc",

  // Status
  statusOptimal: { bg: "#065f46", text: "#a7f3d0" },
  statusGood: { bg: "#92400e", text: "#fde68a" },
  statusLow: { bg: "#991b1b", text: "#fecaca" },
  statusUnassigned: { bg: "#374151", text: "#9ca3af" },
};

export const fonts = {
  body: "'DM Sans', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export const fontImport =
  "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;600;700&display=swap');";

export const globalStyles = `
  ${fontImport}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  input:focus, select:focus { border-color: ${colors.blue} !important; outline: none; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: ${colors.bgCard}; }
  ::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 3px; }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .animate-in { animation: fadeIn 0.4s ease-out both; }
  .pulse { animation: pulse 1.5s ease-in-out infinite; }
`;
