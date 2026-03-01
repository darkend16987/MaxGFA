import { supabase } from "./supabase";

/**
 * Fetch all projects for the current user
 */
export async function fetchProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, status, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Fetch a single project by ID (with full data)
 */
export async function fetchProject(id) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Create a new project
 */
export async function createProject(name, projectData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      description: projectData.description || "",
      data: projectData,
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Save project data (auto-save or manual save)
 */
export async function saveProjectData(id, projectData) {
  const { error } = await supabase
    .from("projects")
    .update({
      name: projectData.name || "Dự án",
      description: projectData.description || "",
      data: projectData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Archive a project
 */
export async function archiveProject(id) {
  const { error } = await supabase
    .from("projects")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Restore an archived project
 */
export async function unarchiveProject(id) {
  const { error } = await supabase
    .from("projects")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Delete a project permanently
 */
export async function deleteProject(id) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
