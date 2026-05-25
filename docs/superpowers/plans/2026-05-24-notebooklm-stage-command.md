# NotebookLM Stage Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `stage` subcommand to `brain-indexer` that compiles a target project note plus its wiki-linked dependencies from an Obsidian PARA vault into a single sanitized markdown file suitable for NotebookLM ingestion.

**Architecture:** Introduce a new `compiler` module alongside `scanner` and `core`. The compiler exposes `compile_project(vault, target) -> Result<String>`, which orchestrates target lookup (`01_Projects`), wiki-link extraction (regex), dependency resolution against `02_Areas` + `03_Resources` via a `LinkResolver`, sanitization (strip YAML frontmatter, flatten `[[wiki-links]]`), and concatenation with section headers. `main.rs` gains a `Stage` variant that writes the resulting string to `<out_dir>/<target>_StudyGuide.md` and extends the existing stderr-redaction wrapper to cover `out_dir` as well as `vault`.

**Tech Stack:** Rust 2021, `clap` (derive), `anyhow`, `walkdir`, `regex` (new), `tempfile` (dev).

---

## File Structure

**New files:**
- `src/compiler/mod.rs` — Public surface (`compile_project`), `LinkResolver` struct, helpers (`strip_frontmatter`, `extract_links`, `replace_wiki_links`), unit tests.

**Modified files:**
- `Cargo.toml` — Add `regex = "1.10"` to `[dependencies]`.
- `src/lib.rs` — Add `pub mod compiler;`.
- `src/main.rs` — Add `Stage` to `Commands` enum, capture both `vault` and `out_dir` for redaction, dispatch to `compiler::compile_project`, write output.

**Touched but not edited:** `src/core/vault.rs` (read-only — `Vault::root()` and existing PARA validation are reused).

---

## Task 1: Add the `regex` dependency

**Files:**
- Modify: `Cargo.toml`

- [ ] **Step 1: Add the crate**

Edit `Cargo.toml`. After the existing `tokio` line in `[dependencies]`, insert:

```toml
regex = "1.10"
```

The final `[dependencies]` block should read:

```toml
[dependencies]
clap = { version = "4.4", features = ["derive"] }
walkdir = "2.4"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1.0"
thiserror = "1.0"
tokio = { version = "1.35", features = ["full"] }
regex = "1.10"
```

- [ ] **Step 2: Verify the crate resolves**

Run: `cargo build`
Expected: Build succeeds; `Cargo.lock` is updated with a `regex` entry. No source changes yet.

- [ ] **Step 3: Commit**

```bash
git add Cargo.toml Cargo.lock
git commit -m "chore: add regex dependency for compiler module"
```

---

## Task 2: Create the empty `compiler` module and expose it

**Files:**
- Create: `src/compiler/mod.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Create the module with a placeholder**

Create `src/compiler/mod.rs` with this exact content:

```rust
//! NotebookLM staging compiler.
//!
//! Resolves a target project note in `01_Projects`, follows its wiki-links
//! into `02_Areas` and `03_Resources`, strips YAML frontmatter, flattens
//! wiki-links, and concatenates the result into a single markdown string.

use crate::core::vault::Vault;
use anyhow::Result;

pub fn compile_project(_vault: &Vault, _target: &str) -> Result<String> {
    unimplemented!("compile_project will be implemented in later tasks")
}
```

- [ ] **Step 2: Expose the module**

Replace the contents of `src/lib.rs` with:

```rust
pub mod compiler;
pub mod core;
pub mod scanner;
```

- [ ] **Step 3: Verify it compiles**

Run: `cargo build`
Expected: Build succeeds with no warnings beyond the existing baseline.

- [ ] **Step 4: Commit**

```bash
git add src/compiler/mod.rs src/lib.rs
git commit -m "feat(compiler): scaffold compiler module"
```

---

## Task 3: Implement `strip_frontmatter` (TDD)

**Files:**
- Modify: `src/compiler/mod.rs`
- Test: `src/compiler/mod.rs` (inline `#[cfg(test)] mod tests`)

The function removes a leading YAML frontmatter block (`---\n...\n---\n`) if and only if the file starts with `---`. Trailing or mid-file `---` dividers must NOT be stripped.

- [ ] **Step 1: Write the failing test**

Append this `#[cfg(test)] mod tests { ... }` block to `src/compiler/mod.rs`:

```rust
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
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cargo test --lib compiler::tests::strip_frontmatter`
Expected: FAIL — compile error: `cannot find function 'strip_frontmatter' in this scope`.

- [ ] **Step 3: Implement `strip_frontmatter`**

In `src/compiler/mod.rs`, above the `compile_project` function, add:

```rust
use regex::Regex;

/// Strip a leading YAML frontmatter block (`---\n...\n---\n`) if present.
/// Only matches at the very start of the input. Mid-document `---` lines are preserved.
pub fn strip_frontmatter(content: &str) -> String {
    let re = Regex::new(r"(?s)\A---\r?\n.*?\r?\n---\r?\n?").unwrap();
    re.replace(content, "").into_owned()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cargo test --lib compiler::tests::strip_frontmatter`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/compiler/mod.rs
git commit -m "feat(compiler): strip leading YAML frontmatter"
```

---

## Task 4: Implement `extract_links` (TDD)

**Files:**
- Modify: `src/compiler/mod.rs`

The function returns the *target* name from each `[[wiki-link]]`. For aliased links (`[[Target|Display]]`), return `Target`. Order should match document order; duplicates are preserved (deduplication happens at resolution time).

- [ ] **Step 1: Write the failing test**

Append to the `tests` module in `src/compiler/mod.rs`:

```rust
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cargo test --lib compiler::tests::extract_links`
Expected: FAIL — compile error: `cannot find function 'extract_links' in this scope`.

- [ ] **Step 3: Implement `extract_links`**

In `src/compiler/mod.rs`, below `strip_frontmatter`, add:

```rust
/// Extract wiki-link targets from the content, in document order. For
/// aliased links (`[[Target|Alias]]`), only `Target` is returned.
pub fn extract_links(content: &str) -> Vec<String> {
    let re = Regex::new(r"\[\[([^\[\]\|]+?)(?:\|[^\[\]]*)?\]\]").unwrap();
    re.captures_iter(content)
        .map(|cap| cap[1].trim().to_string())
        .collect()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cargo test --lib compiler::tests::extract_links`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/compiler/mod.rs
git commit -m "feat(compiler): extract wiki-link targets"
```

---

## Task 5: Implement `replace_wiki_links` (TDD)

**Files:**
- Modify: `src/compiler/mod.rs`

After links are resolved we still want the *concatenated body* of every note to be NotebookLM-friendly. `[[Note]]` → `Note`; `[[Note|Alias]]` → `Alias` (display text is what readers see).

- [ ] **Step 1: Write the failing test**

Append to the `tests` module in `src/compiler/mod.rs`:

```rust
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cargo test --lib compiler::tests::replace_wiki_links`
Expected: FAIL — compile error: `cannot find function 'replace_wiki_links' in this scope`.

- [ ] **Step 3: Implement `replace_wiki_links`**

In `src/compiler/mod.rs`, below `extract_links`, add:

```rust
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cargo test --lib compiler::tests::replace_wiki_links`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/compiler/mod.rs
git commit -m "feat(compiler): flatten wiki-links to plain text"
```

---

## Task 6: Implement `LinkResolver` (TDD)

**Files:**
- Modify: `src/compiler/mod.rs`

The resolver pre-indexes every `.md` file under `02_Areas` and `03_Resources` keyed by **file stem** (case-sensitive — Obsidian wiki-links are case-sensitive by default). Lookups are O(1). On stem collisions across folders, the first scanned wins (warning to stderr) — collisions are rare in PARA vaults and a stable tiebreak is sufficient.

- [ ] **Step 1: Write the failing test**

Append to the `tests` module in `src/compiler/mod.rs`:

```rust
    use crate::core::vault::Vault;
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --lib compiler::tests::link_resolver`
Expected: FAIL — compile error: `cannot find type 'LinkResolver'`.

- [ ] **Step 3: Implement `LinkResolver`**

In `src/compiler/mod.rs`, add the necessary imports at the top (replace the existing `use` lines so the file imports are):

```rust
use crate::core::vault::Vault;
use anyhow::Result;
use regex::Regex;
use std::collections::HashMap;
use std::path::PathBuf;
use walkdir::WalkDir;
```

Then, **above** the `compile_project` function (and below the helper functions), add:

```rust
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
```

Remove the original `use crate::core::vault::Vault;` and `use anyhow::Result;` at the top of the file — they are now part of the consolidated import block above.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cargo test --lib compiler::tests::link_resolver`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/compiler/mod.rs
git commit -m "feat(compiler): add LinkResolver for areas and resources"
```

---

## Task 7: Implement `compile_project` orchestration (TDD)

**Files:**
- Modify: `src/compiler/mod.rs`

Behaviour:
1. Find the target file at `01_Projects/<target>.md` (top-level only — nested projects can be added later if needed; YAGNI).
2. Read its content; sanitize (strip frontmatter, flatten wiki-links).
3. Extract wiki-links from the **raw** content (before flattening).
4. For each link (deduped, preserving first-seen order): resolve via `LinkResolver`; if resolved, read, sanitize, append. Unresolved links are skipped silently (they were already flattened to plain text in the target body, which is the desired NotebookLM behaviour).
5. Concatenate into one string with section headers: a top-level `# <target>` header for the project body, then `## <linked-note-stem>` for each appended dependency, separated by blank lines.

- [ ] **Step 1: Write the failing test**

Append to the `tests` module in `src/compiler/mod.rs`:

```rust
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

        // Frontmatter stripped from target.
        assert!(!out.contains("title: LG"));
        // Wiki-links flattened (alias used where present).
        assert!(out.contains("Uses Rust Patterns and the habits doc."));
        // Section headers for project and dependencies.
        assert!(out.contains("# Lyrics_Guesser"));
        assert!(out.contains("## Rust Patterns"));
        assert!(out.contains("## Habits"));
        // Dependency bodies are present and frontmatter-stripped.
        assert!(out.contains("Body about rust patterns."));
        assert!(out.contains("Body about habits."));
        assert!(!out.contains("tags: [rust]"));
        // Order of dependencies matches order in target.
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --lib compiler::tests::compile_project`
Expected: FAIL — `compile_project` currently returns `unimplemented!()` (panics).

- [ ] **Step 3: Implement `compile_project`**

In `src/compiler/mod.rs`, add `use anyhow::{anyhow, Context};` near the top (alongside the existing `use anyhow::Result;` — combine into `use anyhow::{anyhow, Context, Result};`). Then add a `use std::fs;` import too.

The full import block at the top of the file should now read:

```rust
use crate::core::vault::Vault;
use anyhow::{anyhow, Context, Result};
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;
```

Replace the placeholder `compile_project` (the `unimplemented!()` version) with:

```rust
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cargo test --lib compiler::tests::compile_project`
Expected: 4 tests pass.

- [ ] **Step 5: Run the full compiler test module**

Run: `cargo test --lib compiler`
Expected: All compiler tests pass (frontmatter + extract + replace + resolver + compile = ~14 tests).

- [ ] **Step 6: Commit**

```bash
git add src/compiler/mod.rs
git commit -m "feat(compiler): assemble study guide from target and dependencies"
```

---

## Task 8: Wire the `Stage` subcommand into the CLI

**Files:**
- Modify: `src/main.rs`

The `Stage` variant needs to:
1. Parse `--vault`, `--target`, `--out-dir` flags.
2. Capture **both** `vault` and `out_dir` strings *before* the command is moved, so the error-redaction wrapper can scrub them from stderr.
3. Call `compiler::compile_project`.
4. Write the result to `<out_dir>/<target>_StudyGuide.md` (creating `out_dir` if missing).

- [ ] **Step 1: Replace `src/main.rs` with the wired-up version**

Replace the entire contents of `src/main.rs` with:

```rust
use anyhow::{Context, Result};
use brain_indexer::compiler;
use brain_indexer::core::vault::Vault;
use brain_indexer::scanner::Scanner;
use clap::{Parser, Subcommand};
use std::fs;
use std::path::Path;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// List all notes in the 01_Projects folder
    List {
        /// Absolute path to the Obsidian vault
        #[arg(short, long)]
        vault: String,

        /// Output results as JSON
        #[arg(long)]
        json: bool,
    },

    /// Compile a project and its linked resources for NotebookLM ingestion
    Stage {
        /// Absolute path to the Obsidian vault
        #[arg(short, long)]
        vault: String,

        /// The exact name of the project to compile (e.g. "Lyrics_Guesser")
        #[arg(short, long)]
        target: String,

        /// Absolute path to the output directory (e.g. a Google Drive Dropzone)
        #[arg(short, long)]
        out_dir: String,
    },
}

fn main() {
    let cli = Cli::parse();

    // Capture sensitive paths for stderr redaction before moving `cli` into `run`.
    let (vault_path, out_dir_path) = match &cli.command {
        Commands::List { vault, .. } => (vault.clone(), String::new()),
        Commands::Stage { vault, out_dir, .. } => (vault.clone(), out_dir.clone()),
    };

    if let Err(e) = run(cli) {
        let mut error_msg = format!("{:?}", e);
        if !vault_path.is_empty() {
            error_msg = error_msg.replace(&vault_path, "[REDACTED]");
        }
        if !out_dir_path.is_empty() {
            error_msg = error_msg.replace(&out_dir_path, "[REDACTED]");
        }
        eprintln!("Error: {}", error_msg);
        std::process::exit(1);
    }
}

fn run(cli: Cli) -> Result<()> {
    match cli.command {
        Commands::List { vault, json } => {
            let vault_path = Path::new(&vault);
            let vault_obj = Vault::new(vault_path)
                .with_context(|| format!("Failed to initialize vault at {}", vault))?;

            let scanner = Scanner::new(&vault_obj);
            let notes = scanner.scan_projects().context("Failed to scan projects")?;

            if json {
                let json_output = serde_json::to_string_pretty(&notes)
                    .context("Failed to serialize notes to JSON")?;
                println!("{}", json_output);
            } else if notes.is_empty() {
                println!("No projects found.");
            } else {
                for note in notes {
                    println!("[Project] {} ({})", note.title, note.relative_path);
                }
            }
        }
        Commands::Stage {
            vault,
            target,
            out_dir,
        } => {
            let vault_obj = Vault::new(Path::new(&vault))
                .with_context(|| format!("Failed to initialize vault at {}", vault))?;

            let compiled = compiler::compile_project(&vault_obj, &target)
                .with_context(|| format!("Failed to compile target '{}'", target))?;

            let out_dir_path = Path::new(&out_dir);
            fs::create_dir_all(out_dir_path)
                .with_context(|| format!("Failed to create out_dir {}", out_dir))?;

            let out_file = out_dir_path.join(format!("{target}_StudyGuide.md"));
            fs::write(&out_file, compiled)
                .with_context(|| format!("Failed to write {}", out_file.display()))?;

            println!("Wrote study guide to {}", out_file.display());
        }
    }

    Ok(())
}
```

- [ ] **Step 2: Build and verify the binary compiles**

Run: `cargo build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run the full test suite**

Run: `cargo test`
Expected: All tests pass (vault, scanner, compiler).

- [ ] **Step 4: Smoke-test the `stage` command end-to-end**

Run:

```bash
mkdir -p /tmp/bi_out
cargo run -- stage --vault "$(pwd)/test_vault" --target Lyrics_Guesser --out-dir /tmp/bi_out 2>&1 || true
ls /tmp/bi_out
```

Expected: Either (a) the command succeeds and `Lyrics_Guesser_StudyGuide.md` exists in `/tmp/bi_out`, or (b) the command errors with `Target project 'Lyrics_Guesser' not found ...` because the test vault doesn't contain that project — both outcomes confirm CLI wiring works. If you get a different error, debug it before continuing.

- [ ] **Step 5: Smoke-test the redaction wrapper**

Run:

```bash
cargo run -- stage --vault /nonexistent/vault --target Foo --out-dir /tmp/secret_dropzone 2>&1 || true
```

Expected: stderr contains `[REDACTED]` in place of both `/nonexistent/vault` and `/tmp/secret_dropzone`. If either path leaks, fix the redaction logic before committing.

- [ ] **Step 6: Commit**

```bash
git add src/main.rs
git commit -m "feat(cli): add stage command for NotebookLM staging"
```

---

## Task 9: Integration test — full `stage` round-trip on a temp vault

**Files:**
- Modify: `src/compiler/mod.rs` (add one more test to the existing `tests` module)

This locks in the contract that the *output file* is written correctly, not just the string returned by `compile_project`. Because `main.rs` does the file I/O and is hard to unit-test, we cover the file-writing path with a focused test that mirrors what `main.rs` does.

- [ ] **Step 1: Add the integration-style test**

Append to the `tests` module in `src/compiler/mod.rs`:

```rust
    #[test]
    fn compile_project_output_is_writable_to_disk() {
        let (_tmp, path) = make_para_vault();
        fs::write(
            path.join("01_Projects/Demo.md"),
            "# Demo\nLinks to [[Helper]].",
        )
        .unwrap();
        fs::write(path.join("03_Resources/Helper.md"), "Helper body.").unwrap();

        let vault = Vault::new(&path).unwrap();
        let compiled = compile_project(&vault, "Demo").unwrap();

        let out_dir = path.join("out");
        fs::create_dir(&out_dir).unwrap();
        let out_file = out_dir.join("Demo_StudyGuide.md");
        fs::write(&out_file, &compiled).unwrap();

        let on_disk = fs::read_to_string(&out_file).unwrap();
        assert_eq!(on_disk, compiled);
        assert!(on_disk.contains("# Demo"));
        assert!(on_disk.contains("## Helper"));
        assert!(on_disk.contains("Helper body."));
    }
```

- [ ] **Step 2: Run the test**

Run: `cargo test --lib compiler::tests::compile_project_output_is_writable_to_disk`
Expected: 1 test passes.

- [ ] **Step 3: Run the full test suite one final time**

Run: `cargo test`
Expected: All tests pass across all modules.

- [ ] **Step 4: Commit**

```bash
git add src/compiler/mod.rs
git commit -m "test(compiler): verify compiled output round-trips through disk"
```

---

## Spec Coverage Checklist

| Spec section | Covered by |
|---|---|
| §2.1 `Stage` CLI variant with `vault` / `target` / `out_dir` | Task 8 |
| §2.2 step 1 Target Acquisition (`01_Projects`) | Task 7 |
| §2.2 step 2 Link Extraction via regex | Task 4 |
| §2.2 step 3 Dependency Resolution in `02_Areas` + `03_Resources` | Task 6 |
| §2.2 step 4a Strip YAML frontmatter | Task 3 |
| §2.2 step 4b Replace wiki-links with plain text | Task 5 |
| §2.2 step 5 Concatenation with section headers | Task 7 |
| §2.2 step 6 Egress to `<out_dir>/<target>_StudyGuide.md` | Task 8 |
| §2.3 Add `regex = "1.10"` | Task 1 |
| §3 No hardcoded dropzones (CLI arg only) | Task 8 |
| §3 Error masking for `vault` AND `out_dir` | Task 8 |
| §4 Task 5 (module tests with `tempfile::tempdir`) | Tasks 3–7, 9 |
| §5 Phase 2 MCP horizon | Out of scope (explicitly Phase 2) |

---

## Done When

- `cargo test` passes.
- `cargo run -- stage --vault <path> --target <name> --out-dir <dir>` produces `<dir>/<name>_StudyGuide.md` with frontmatter stripped, wiki-links flattened, and resolved dependencies appended under `##` headers.
- Errors containing `<vault>` or `<out_dir>` print as `[REDACTED]` on stderr.
