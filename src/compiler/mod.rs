//! NotebookLM staging compiler.
//!
//! Resolves a target project note in `01_Projects`, follows its wiki-links
//! into `02_Areas` and `03_Resources`, strips YAML frontmatter, flattens
//! wiki-links, and concatenates the result into a single markdown string.

use crate::core::vault::Vault;
use anyhow::{anyhow, Context, Result};
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

/// Strip a leading YAML frontmatter block (`---\n...\n---\n`) if present.
/// Only matches at the very start of the input. Mid-document `---` lines are preserved.
pub fn strip_frontmatter(content: &str) -> String {
    let re = Regex::new(r"(?s)\A---\r?\n.*?\r?\n---\r?\n?").unwrap();
    re.replace(content, "").into_owned()
}

/// Extract wiki-link targets from the content, in document order. For
/// aliased links (`[[Target|Alias]]`), only `Target` is returned.
pub fn extract_links(content: &str) -> Vec<String> {
    let re = Regex::new(r"\[\[([^\[\]\|]+?)(?:\|[^\[\]]*)?\]\]").unwrap();
    re.captures_iter(content)
        .map(|cap| cap[1].trim().to_string())
        .collect()
}

/// Flatten `[[wiki-links]]` to plain text. Aliased links keep the alias
/// (display text); plain links keep the target name. Preserves surrounding
/// punctuation.
pub fn replace_wiki_links(content: &str) -> String {
    let re = Regex::new(r"\[\[([^\[\]\|]+?)(?:\|([^\[\]]*))?\]\]").unwrap();
    re.replace_all(content, |caps: &regex::Captures| {
        match caps.get(2) {
            Some(alias) => alias.as_str().trim().to_string(),
            None => caps[1].trim().to_string(),
        }
    })
    .into_owned()
}

/// Index of resolvable note names → absolute path. Built once per `stage` run.
pub struct LinkResolver {
    index: HashMap<String, PathBuf>,
}

impl LinkResolver {
    /// Walks `02_Areas` and `03_Resources` and indexes every `.md` file by
    /// its file stem. On stem collision, the first-scanned path wins and a
    /// warning is emitted to stderr.
    pub fn new(vault: &Vault) -> Result<Self> {
        let mut index: HashMap<String, PathBuf> = HashMap::new();
        for folder in ["02_Areas", "03_Resources"] {
            let root = vault.root().join(folder);
            for entry in WalkDir::new(&root)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.file_type().is_file()
                        && e.path()
                            .extension()
                            .map_or(false, |ext| ext.eq_ignore_ascii_case("md"))
                })
            {
                let path = entry.path().to_path_buf();
                let stem = match path.file_stem().and_then(|s| s.to_str()) {
                    Some(s) => s.to_string(),
                    None => continue,
                };
                if let Some(existing) = index.get(&stem) {
                    eprintln!(
                        "warning: duplicate note name '{}'; keeping {} and ignoring {}",
                        stem,
                        existing.display(),
                        path.display()
                    );
                    continue;
                }
                index.insert(stem, path);
            }
        }
        Ok(Self { index })
    }

    /// Look up a wiki-link target. Returns `None` if no matching `.md` file
    /// was found in `02_Areas` or `03_Resources`.
    pub fn resolve(&self, name: &str) -> Option<PathBuf> {
        self.index.get(name).cloned()
    }
}

/// Compile a target project note plus its first-level wiki-linked
/// dependencies (from `02_Areas` and `03_Resources`) into a single
/// sanitized markdown string suitable for NotebookLM ingestion.
pub fn compile_project(vault: &Vault, target: &str) -> Result<String> {
    let target_path = vault.root().join("01_Projects").join(format!("{target}.md"));
    if !target_path.is_file() {
        return Err(anyhow!(
            "Target project '{}' not found at {}",
            target,
            target_path.display()
        ));
    }

    let target_raw = fs::read_to_string(&target_path)
        .with_context(|| format!("Failed to read target {}", target_path.display()))?;
    let target_stripped = strip_frontmatter(&target_raw);

    let resolver = LinkResolver::new(vault)?;

    // Collect dependencies in first-seen order, deduped.
    let mut seen: HashMap<String, ()> = HashMap::new();
    let mut deps: Vec<(String, PathBuf)> = Vec::new();
    for link in extract_links(&target_stripped) {
        if seen.contains_key(&link) {
            continue;
        }
        seen.insert(link.clone(), ());
        if let Some(path) = resolver.resolve(&link) {
            deps.push((link, path));
        }
    }

    let mut out = String::new();
    out.push_str(&format!("# {target}\n\n"));
    out.push_str(&replace_wiki_links(&target_stripped));
    if !out.ends_with('\n') {
        out.push('\n');
    }

    for (name, path) in deps {
        let raw = fs::read_to_string(&path)
            .with_context(|| format!("Failed to read dependency {}", path.display()))?;
        let body = replace_wiki_links(&strip_frontmatter(&raw));
        out.push_str(&format!("\n## {name}\n\n"));
        out.push_str(&body);
        if !out.ends_with('\n') {
            out.push('\n');
        }
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_frontmatter_removes_leading_block() {
        let input = "---\ntitle: Foo\ntags: [a, b]\n---\n# Body\nText.";
        assert_eq!(strip_frontmatter(input), "# Body\nText.");
    }

    #[test]
    fn strip_frontmatter_leaves_body_alone_when_no_frontmatter() {
        let input = "# Body\nText with --- inside it.";
        assert_eq!(strip_frontmatter(input), input);
    }

    #[test]
    fn strip_frontmatter_ignores_horizontal_rule_mid_document() {
        let input = "# Body\n\n---\n\nMore text.";
        assert_eq!(strip_frontmatter(input), input);
    }

    #[test]
    fn extract_links_finds_plain_links() {
        let input = "See [[Note One]] and also [[Note_Two]].";
        assert_eq!(extract_links(input), vec!["Note One", "Note_Two"]);
    }

    #[test]
    fn extract_links_strips_alias() {
        let input = "Refer to [[Real Target|Display Text]].";
        assert_eq!(extract_links(input), vec!["Real Target"]);
    }

    #[test]
    fn extract_links_returns_empty_when_none() {
        assert!(extract_links("Just prose, no links.").is_empty());
    }

    #[test]
    fn extract_links_preserves_order_and_duplicates() {
        let input = "[[A]] [[B]] [[A]]";
        assert_eq!(extract_links(input), vec!["A", "B", "A"]);
    }

    #[test]
    fn replace_wiki_links_plain() {
        assert_eq!(replace_wiki_links("See [[Foo]] now."), "See Foo now.");
    }

    #[test]
    fn replace_wiki_links_uses_alias() {
        assert_eq!(
            replace_wiki_links("Refer to [[Real Target|the doc]]."),
            "Refer to the doc."
        );
    }

    #[test]
    fn replace_wiki_links_handles_multiple() {
        assert_eq!(
            replace_wiki_links("[[A]] and [[B|bee]] and [[C]]"),
            "A and bee and C"
        );
    }

    use std::fs;
    use tempfile::tempdir;

    fn make_para_vault() -> (tempfile::TempDir, std::path::PathBuf) {
        let dir = tempdir().unwrap();
        let path = dir.path().to_path_buf();
        for sub in ["01_Projects", "02_Areas", "03_Resources", "04_Archives"] {
            fs::create_dir(path.join(sub)).unwrap();
        }
        (dir, path)
    }

    #[test]
    fn link_resolver_finds_files_in_areas_and_resources() {
        let (_tmp, path) = make_para_vault();
        fs::write(path.join("02_Areas/Habits.md"), "x").unwrap();
        fs::write(path.join("03_Resources/Rust Book.md"), "y").unwrap();

        let vault = Vault::new(&path).unwrap();
        let resolver = LinkResolver::new(&vault).unwrap();

        assert_eq!(
            resolver.resolve("Habits"),
            Some(path.join("02_Areas/Habits.md"))
        );
        assert_eq!(
            resolver.resolve("Rust Book"),
            Some(path.join("03_Resources/Rust Book.md"))
        );
        assert_eq!(resolver.resolve("Nonexistent"), None);
    }

    #[test]
    fn link_resolver_ignores_projects_and_archives() {
        let (_tmp, path) = make_para_vault();
        fs::write(path.join("01_Projects/SelfRef.md"), "x").unwrap();
        fs::write(path.join("04_Archives/Old.md"), "y").unwrap();

        let vault = Vault::new(&path).unwrap();
        let resolver = LinkResolver::new(&vault).unwrap();

        assert_eq!(resolver.resolve("SelfRef"), None);
        assert_eq!(resolver.resolve("Old"), None);
    }

    #[test]
    fn link_resolver_walks_nested_subdirectories() {
        let (_tmp, path) = make_para_vault();
        fs::create_dir(path.join("03_Resources/programming")).unwrap();
        fs::write(path.join("03_Resources/programming/Nested.md"), "x").unwrap();

        let vault = Vault::new(&path).unwrap();
        let resolver = LinkResolver::new(&vault).unwrap();

        assert_eq!(
            resolver.resolve("Nested"),
            Some(path.join("03_Resources/programming/Nested.md"))
        );
    }

    #[test]
    fn compile_project_assembles_target_and_dependencies() {
        let (_tmp, path) = make_para_vault();

        fs::write(
            path.join("01_Projects/Lyrics_Guesser.md"),
            "---\ntitle: LG\n---\n\
             # Overview\n\
             Uses [[Rust Patterns]] and [[Habits|the habits doc]].\n",
        )
        .unwrap();
        fs::write(
            path.join("03_Resources/Rust Patterns.md"),
            "---\ntags: [rust]\n---\nBody about rust patterns.",
        )
        .unwrap();
        fs::write(
            path.join("02_Areas/Habits.md"),
            "Body about habits.",
        )
        .unwrap();

        let vault = Vault::new(&path).unwrap();
        let out = compile_project(&vault, "Lyrics_Guesser").unwrap();

        assert!(!out.contains("title: LG"));
        assert!(out.contains("Uses Rust Patterns and the habits doc."));
        assert!(out.contains("# Lyrics_Guesser"));
        assert!(out.contains("## Rust Patterns"));
        assert!(out.contains("## Habits"));
        assert!(out.contains("Body about rust patterns."));
        assert!(out.contains("Body about habits."));
        assert!(!out.contains("tags: [rust]"));
        let rust_idx = out.find("## Rust Patterns").unwrap();
        let habits_idx = out.find("## Habits").unwrap();
        assert!(rust_idx < habits_idx);
    }

    #[test]
    fn compile_project_errors_when_target_missing() {
        let (_tmp, path) = make_para_vault();
        let vault = Vault::new(&path).unwrap();
        let err = compile_project(&vault, "NotThere").unwrap_err();
        let msg = format!("{}", err);
        assert!(
            msg.contains("NotThere"),
            "expected error message to name the target, got: {msg}"
        );
    }

    #[test]
    fn compile_project_skips_unresolved_links_silently() {
        let (_tmp, path) = make_para_vault();
        fs::write(
            path.join("01_Projects/Solo.md"),
            "# Solo\nMentions [[NeverDefined]].",
        )
        .unwrap();

        let vault = Vault::new(&path).unwrap();
        let out = compile_project(&vault, "Solo").unwrap();

        assert!(out.contains("Mentions NeverDefined."));
        assert!(!out.contains("## NeverDefined"));
    }

    #[test]
    fn compile_project_deduplicates_repeated_links() {
        let (_tmp, path) = make_para_vault();
        fs::write(
            path.join("01_Projects/Repeat.md"),
            "[[Dep]] and again [[Dep]] and [[Dep|alias]].",
        )
        .unwrap();
        fs::write(path.join("03_Resources/Dep.md"), "Dep body.").unwrap();

        let vault = Vault::new(&path).unwrap();
        let out = compile_project(&vault, "Repeat").unwrap();

        assert_eq!(out.matches("## Dep").count(), 1);
        assert_eq!(out.matches("Dep body.").count(), 1);
    }
}
