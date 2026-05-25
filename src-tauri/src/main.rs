#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::path::Path;
use brain_indexer_core::core::vault::{Vault, Note, ParaCategory};
use brain_indexer_core::scanner::Scanner;
use brain_indexer_core::compiler::{LinkResolver, extract_links, strip_frontmatter, replace_wiki_links};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct ProjectTree {
    project: Note,
    dependencies: Vec<DependencyNode>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DependencyNode {
    title: String,
    relative_path: String,
    category: String,
    resolved_path: String,
}

#[tauri::command]
fn scan_projects(vault_path: String) -> Result<Vec<Note>, String> {
    let vault = Vault::new(Path::new(&vault_path)).map_err(|e| e.to_string())?;
    let scanner = Scanner::new(&vault);
    scanner.scan_projects().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_project_tree(vault_path: String, project_title: String) -> Result<ProjectTree, String> {
    let vault = Vault::new(Path::new(&vault_path)).map_err(|e| e.to_string())?;
    
    // Find the project note path
    let project_path = vault.root().join("01_Projects").join(format!("{}.md", project_title));
    if !project_path.is_file() {
        return Err(format!("Project note '{}' not found in vault", project_title));
    }
    
    let relative_path = project_path
        .strip_prefix(vault.root())
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .into_owned();
        
    let project_note = Note {
        title: project_title.clone(),
        relative_path,
        category: ParaCategory::Projects,
    };
    
    // Parse the file for wiki links
    let content = std::fs::read_to_string(&project_path).map_err(|e| e.to_string())?;
    let stripped = strip_frontmatter(&content);
    let links = extract_links(&stripped);
    
    let resolver = LinkResolver::new(&vault).map_err(|e| e.to_string())?;
    
    let mut dependencies = Vec::new();
    let mut seen = std::collections::HashSet::new();
    
    for link in links {
        if seen.contains(&link) {
            continue;
        }
        seen.insert(link.clone());
        
        if let Some(resolved) = resolver.resolve(&link) {
            let relative_resolved = resolved
                .strip_prefix(vault.root())
                .unwrap_or(&resolved)
                .to_string_lossy()
                .into_owned();
                
            let category = if relative_resolved.starts_with("02_Areas") {
                "Areas".to_string()
            } else if relative_resolved.starts_with("03_Resources") {
                "Resources".to_string()
            } else if relative_resolved.starts_with("04_Archives") {
                "Archives".to_string()
            } else {
                "Unknown".to_string()
            };
            
            dependencies.push(DependencyNode {
                title: link,
                relative_path: relative_resolved,
                category,
                resolved_path: resolved.to_string_lossy().into_owned(),
            });
        }
    }
    
    Ok(ProjectTree {
        project: project_note,
        dependencies,
    })
}

#[tauri::command]
fn preview_stage_bundle(vault_path: String, target: String, selected_deps: Vec<String>) -> Result<String, String> {
    let vault = Vault::new(Path::new(&vault_path)).map_err(|e| e.to_string())?;
    compile_project_selective(&vault, &target, selected_deps).map_err(|e| e.to_string())
}

#[tauri::command]
fn stage_project_bundle(
    vault_path: String,
    target: String,
    out_dir: String,
    selected_deps: Vec<String>,
) -> Result<String, String> {
    let vault = Vault::new(Path::new(&vault_path)).map_err(|e| e.to_string())?;
    let compiled = compile_project_selective(&vault, &target, selected_deps).map_err(|e| e.to_string())?;

    let out_dir_path = Path::new(&out_dir);
    std::fs::create_dir_all(out_dir_path)
        .map_err(|e| format!("Failed to create out_dir: {}", e))?;

    let out_file = out_dir_path.join(format!("{}_StudyGuide.md", target));
    std::fs::write(&out_file, compiled)
        .map_err(|e| format!("Failed to write staged study guide: {}", e))?;

    Ok(out_file.to_string_lossy().into_owned())
}

fn compile_project_selective(vault: &Vault, target: &str, selected_deps: Vec<String>) -> anyhow::Result<String> {
    let target_path = vault.root().join("01_Projects").join(format!("{}.md", target));
    if !target_path.is_file() {
        return Err(anyhow::anyhow!("Target project '{}' not found", target));
    }

    let target_raw = std::fs::read_to_string(&target_path)?;
    let target_stripped = strip_frontmatter(&target_raw);

    let resolver = LinkResolver::new(vault)?;
    
    let mut seen = std::collections::HashSet::new();
    let mut deps = Vec::new();
    for link in extract_links(&target_stripped) {
        if !selected_deps.contains(&link) {
            continue;
        }
        if seen.contains(&link) {
            continue;
        }
        seen.insert(link.clone());
        if let Some(path) = resolver.resolve(&link) {
            deps.push((link, path));
        }
    }

    let mut out = String::new();
    out.push_str(&format!("# {}\n\n", target));
    out.push_str(&replace_wiki_links(&target_stripped));
    if !out.ends_with('\n') {
        out.push('\n');
    }

    for (name, path) in deps {
        let raw = std::fs::read_to_string(&path)?;
        let body = replace_wiki_links(&strip_frontmatter(&raw));
        out.push_str(&format!("\n## {}\n\n", name));
        out.push_str(&body);
        if !out.ends_with('\n') {
            out.push('\n');
        }
    }

    Ok(out)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_projects,
            get_project_tree,
            preview_stage_bundle,
            stage_project_bundle
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
