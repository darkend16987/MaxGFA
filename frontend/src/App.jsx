import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import ProjectListPage from "./pages/ProjectListPage";
import ProjectEditor from "./ProjectEditor";
import { fetchProject, saveProjectData } from "./lib/database";
import { colors, fonts, globalStyles } from "./styles/theme";

// ============================================================
// GFA OPTIMIZER — App Shell
// Routes: Login → Project List → Project Editor
// Falls back to local-only mode when Supabase is not configured
// ============================================================

export default function App() {
  const { user, loading, isConfigured, signOut } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [loadingProject, setLoadingProject] = useState(false);

  // Load project data when a project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectData(null);
      return;
    }
    let cancelled = false;
    setLoadingProject(true);
    fetchProject(selectedProjectId)
      .then((row) => {
        if (!cancelled) {
          setProjectData(row.data);
          setLoadingProject(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load project:", err);
          alert("Không thể tải dự án: " + err.message);
          setSelectedProjectId(null);
          setLoadingProject(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  // Cloud save handler (passed to ProjectEditor)
  const handleCloudSave = useCallback(
    async (data) => {
      if (selectedProjectId) {
        await saveProjectData(selectedProjectId, data);
      }
    },
    [selectedProjectId]
  );

  // Navigate back to project list
  const handleBack = useCallback(() => {
    setSelectedProjectId(null);
    setProjectData(null);
  }, []);

  // === NOT CONFIGURED: Local-only mode (backward compatible) ===
  if (!isConfigured) {
    return <ProjectEditor />;
  }

  // === AUTH LOADING ===
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.body,
          color: colors.textMuted,
        }}
      >
        <style>{globalStyles}</style>
        <div className="pulse" style={{ fontSize: 14 }}>
          Đang khởi tạo...
        </div>
      </div>
    );
  }

  // === NOT LOGGED IN ===
  if (!user) {
    return (
      <>
        <style>{globalStyles}</style>
        <LoginPage />
      </>
    );
  }

  // === LOADING SELECTED PROJECT ===
  if (selectedProjectId && loadingProject) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.body,
          color: colors.textMuted,
        }}
      >
        <style>{globalStyles}</style>
        <div className="pulse" style={{ fontSize: 14 }}>
          Đang tải dự án...
        </div>
      </div>
    );
  }

  // === PROJECT EDITOR (cloud mode) ===
  if (selectedProjectId && projectData) {
    return (
      <ProjectEditor
        cloudMode
        initialData={projectData}
        onCloudSave={handleCloudSave}
        onBack={handleBack}
        userEmail={user.email}
        onSignOut={signOut}
      />
    );
  }

  // === PROJECT LIST ===
  return (
    <>
      <style>{globalStyles}</style>
      <ProjectListPage onOpenProject={setSelectedProjectId} />
    </>
  );
}
