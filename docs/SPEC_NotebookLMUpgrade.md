# SPEC: NotebookLM Synthesis Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this specification. This document outlines the upgrade path to transform `brain-indexer` from a read-only indexer into a staging pipeline for NotebookLM.

**Project Owner:** B1Codes LLC
**Status:** Implementation Ready
**Target Architecture:** Library-Core Extension

---

## 1. Executive Summary
NotebookLM is highly effective for synthesis and study but has strict source limits (50 files) and does not natively resolve Obsidian's wiki-links (`[[Note]]`). To bridge this gap, `brain-indexer` must evolve into a **compiler and staging tool**.

This upgrade introduces a new `stage` command that traverses a specific project, resolves all interlinked notes, strips incompatible syntax, and concatenates the content into a unified "Study Guide" markdown file delivered directly to a Google Drive "Dropzone" folder for immediate NotebookLM ingestion.

---

## 2. Architectural Additions

To adhere to the existing Library-Core architecture, we will introduce a new `compiler` module alongside the existing `scanner` and `core` modules.

### 2.1 The `stage` Command (CLI)
Extend `src/main.rs` with a new subcommand:


```rust
/// Compiles a project and its linked resources for NotebookLM ingestion
Stage {
    /// Absolute path to the Obsidian vault
    #[arg(short, long)]
    vault: String,

    /// The exact name of the project or area to compile (e.g., "Lyrics_Guesser")
    #[arg(short, long)]
    target: String,
    
    /// Absolute path to the output directory (e.g., "~/Google Drive/NotebookLM_Dropzone")
    #[arg(short, long)]
    out_dir: String,
}

```

### 2.2 The Compilation Engine (`src/compiler/mod.rs`)

The compiler will perform the following pipeline:

1. **Target Acquisition:** Locate the initial markdown file corresponding to the `--target` within the `01_Projects` folder.
2. **Link Extraction:** Parse the markdown file for Obsidian wiki-links using regex (e.g., `\\[\\[(.*?)\\]\\]`).
3. **Dependency Resolution:** Search the vault (specifically `03_Resources` and `02_Areas`) to find the `.md` files corresponding to the extracted links.
4. **Sanitization:** - Strip YAML frontmatter (`--- ... ---`) from all notes, as this metadata often degrades NotebookLM's semantic parsing.
* Replace wiki-links with plain text or standard markdown emphasis to maintain readability.


5. **Concatenation:** Merge the target project note and all resolved dependency notes into a single cohesive markdown document string, adding clear section headers.
6. **Egress:** Write the compiled string to `[out_dir]/[target]_StudyGuide.md`.

### 2.3 Dependency Updates

Add the `regex` crate to `Cargo.toml` for reliable wiki-link and frontmatter parsing:

```toml
regex = "1.10"

```

---

## 3. Security & "Zero-Exposure" Compliance

* **No Hardcoded Dropzones:** The Google Drive path MUST be passed via the `--out-dir` CLI argument to prevent leaking local paths into the codebase.
* **Error Masking:** The `stage` command must inherit the same error handling wrapper in `main.rs` that redacts the `vault` and `out_dir` absolute paths from `stderr`.

---

## 4. Implementation Plan (Task List)

* [ ] **Task 1: Add Dependencies**
* Update `Cargo.toml` to include `regex = "1.10"`.


* [ ] **Task 2: Create the Compiler Module**
* Create `src/compiler/mod.rs`.
* Expose the module in `src/lib.rs` (`pub mod compiler;`).
* Implement a `LinkResolver` struct that takes a `&Vault` and can search for files by name.


* [ ] **Task 3: Implement Sanitization & Concatenation**
* Write a function `strip_frontmatter(content: &str) -> String`.
* Write a function `extract_links(content: &str) -> Vec<String>`.
* Implement the main `compile_project(vault: &Vault, target: &str) -> Result<String>` logic.


* [ ] **Task 4: CLI Integration**
* Add the `Stage` variant to the `Commands` enum in `src/main.rs`.
* Wire the CLI arguments to the new `compiler` module.
* Write the resulting string to the specified `out_dir`.


* [ ] **Task 5: Write Tests**
* Add module tests in `src/compiler/mod.rs` using `tempfile::tempdir` to verify link resolution and frontmatter stripping.



---

## 5. Phase 2 Horizon: MCP Tool Exfiltration

Once the local CLI logic is stable, this functionality will be exposed as an MCP (Model Context Protocol) server tool:

```json
{
  "name": "stage_for_synthesis",
  "description": "Compiles a specific project and its related resources into a clean format for NotebookLM ingestion via Google Drive.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "target_project": { "type": "string" }
    },
    "required": ["target_project"]
  }
}

```

*Note: The MCP server will dynamically read `vault_path` and `out_dir` from `config.toml` or environment variables to execute without user path inputs.*