// ============================================================
// LOCAL STORAGE UTILITIES
// Save/Load project configurations
// ============================================================

const STORAGE_KEY = "gfa_optimizer_project";
const STORAGE_HISTORY_KEY = "gfa_optimizer_history";
const STORAGE_SETTINGS_KEY = "gfa_optimizer_settings";

/**
 * Save project to localStorage
 */
export function saveProject(project) {
  try {
    const data = {
      ...project,
      _savedAt: new Date().toISOString(),
      _version: "1.0",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Failed to save project:", e);
    return false;
  }
}

/**
 * Load project from localStorage
 * @returns {Object|null} Project data or null if not found
 */
export function loadProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Strip metadata
    const { _savedAt, _version, ...project } = data;
    return project;
  } catch (e) {
    console.error("Failed to load project:", e);
    return null;
  }
}

/**
 * Check if there's a saved project
 */
export function hasSavedProject() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Get save metadata (timestamp, version)
 */
export function getSaveInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      savedAt: data._savedAt ? new Date(data._savedAt) : null,
      version: data._version || "unknown",
      name: data.name || "Unknown",
    };
  } catch {
    return null;
  }
}

/**
 * Clear saved project
 */
export function clearSavedProject() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Save optimization history entry
 */
export function saveHistoryEntry(entry) {
  try {
    const history = loadHistory();
    history.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
    // Keep last 50 entries
    const trimmed = history.slice(-50);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error("Failed to save history:", e);
  }
}

/**
 * Load optimization history
 */
export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Export project as downloadable JSON file
 */
export function exportProjectJSON(project) {
  const data = {
    ...project,
    _exportedAt: new Date().toISOString(),
    _version: "1.0",
    _tool: "GFA Optimizer",
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name || "gfa-project"}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import project from JSON file
 * @param {File} file
 * @returns {Promise<Object>} Parsed project
 */
export function importProjectJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const { _exportedAt, _version, _tool, _savedAt, ...project } = data;
        resolve(project);
      } catch (err) {
        reject(new Error("File JSON không hợp lệ"));
      }
    };
    reader.onerror = () => reject(new Error("Không thể đọc file"));
    reader.readAsText(file);
  });
}
