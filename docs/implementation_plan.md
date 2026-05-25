# Implement Tauri + React Desktop App for Brain Indexer

This implementation plan details the strategy to migrate the `brain-indexer` CLI tool into a native, high-performance desktop application using **Tauri** and **React** (built with Vite and TypeScript). 

The goal is to provide a premium, visual "Knowledge Command Center" that empowers users to scan their Obsidian vaults, audit PARA category relationships, cherry-pick dependencies, and stage project notes into consolidated Markdown study guides for easy NotebookLM ingestion.

---

## User Review Required

> [!IMPORTANT]
> **Workspace Restructuring:**
> To ensure maximum maintainability, we will restructure the project into a **Rust Cargo Workspace** and standard **Tauri double-package structure**. The existing Rust logic will be migrated into a subdirectory `src-tauri/`. The root directory will house the React web assets and build configurations (`package.json`, `vite.config.ts`).
>
> **Coexistence of CLI and Desktop App:**
> By using a Cargo workspace, we can still compile a standalone command-line binary `brain-indexer-cli` AND the desktop GUI `brain-indexer-desktop` from the same codebase. This preserves all CLI utility features for terminal-heavy workflows.

---

## Open Questions

> [!NOTE]
> **1. Config Storage Location:**
> For storing user configurations (e.g. default vault paths, Google Drive dropzone path), do you prefer writing to standard OS config folders (e.g. `~/Library/Application Support/brain-indexer/` via Tauri's path API) or keeping a `.brain-indexer.json` directly inside the target Obsidian vault directory itself? (Writing to the OS standard keeps your vault folder completely pristine, which is recommended).

---

## Proposed Changes

### Component 1: Cargo Workspace & Tauri Rust Backend
We will migrate our existing Rust parser, scanner, and compiler code into a sub-crate `src-tauri/` and configure a Cargo workspace.

#### [NEW] [root Cargo.toml](file:///Users/brandonlamer-connolly/code/brain-indexer/Cargo.toml)
Modify the root `Cargo.toml` to serve as a workspace manager, pointing to `src-tauri/` and the optional `cli/` binary project.

#### [NEW] [src-tauri/Cargo.toml](file:///Users/brandonlamer-connolly/code/brain-indexer/src-tauri/Cargo.toml)
Create the Tauri Rust backend build specification, importing `tauri`, `tauri-build`, `serde`, and `serde_json`.

#### [NEW] [src-tauri/tauri.conf.json](file:///Users/brandonlamer-connolly/code/brain-indexer/src-tauri/tauri.conf.json)
Configure Tauri window options (size, title, dark/light theme options, window dimensions), security permissions (allowing file system dialogs and read/write access), and build targets.

#### [NEW] [src-tauri/src/main.rs](file:///Users/brandonlamer-connolly/code/brain-indexer/src-tauri/src/main.rs)
Migrate the existing main run loop into Tauri-compatible command handlers, exposing the following IPC commands to the React frontend:
1. `scan_projects(vault_path: String)`: Scans the Obsidian vault for `01_Projects` markdown files.
2. `get_project_tree(vault_path: String, project_title: String)`: Parses the project note and returns all resolved wiki-link dependencies (from `02_Areas` and `03_Resources`).
3. `stage_project_bundle(vault_path: String, target: String, out_dir: String, selected_deps: Vec<String>)`: Compiles the selected nodes into a study guide and writes it to the output directory.

#### [NEW] [src-tauri/src/lib.rs](file:///Users/brandonlamer-connolly/code/brain-indexer/src-tauri/src/lib.rs)
Re-expose core library logic for the scanner, vault parser, and compiler.

#### [NEW] [src-tauri/src/core/vault.rs](file:///Users/brandonlamer-connolly/code/brain-indexer/src-tauri/src/core/vault.rs)
Migrate existing core vault models.

#### [NEW] [src-tauri/src/scanner/mod.rs](file:///Users/brandonlamer-connolly/code/brain-indexer/src-tauri/src/scanner/mod.rs)
Migrate existing project and folder scanning functions.

#### [NEW] [src-tauri/src/compiler/mod.rs](file:///Users/brandonlamer-connolly/code/brain-indexer/src-tauri/src/compiler/mod.rs)
Migrate markdown staging, YAML frontmatter stripping, and wiki-link flattening logic.

---

### Component 2: React + Vite + TypeScript Frontend
We will initialize a responsive React SPA in the root folder.

#### [NEW] [package.json](file:///Users/brandonlamer-connolly/code/brain-indexer/package.json)
Specify web dependencies, including `react`, `react-dom`, `@tauri-apps/api`, `vite`, `typescript`, and utility libraries like `lucide-react` (for icons) and `react-markdown` (for staging previews).

#### [NEW] [vite.config.ts](file:///Users/brandonlamer-connolly/code/brain-indexer/vite.config.ts)
Configure the Vite bundler to serve assets compatible with Tauri's webview requirements (disabling inlining and configuring build outDir as `dist`).

#### [NEW] [tsconfig.json](file:///Users/brandonlamer-connolly/code/brain-indexer/tsconfig.json)
Standard TypeScript definitions for modern React development.

#### [NEW] [index.html](file:///Users/brandonlamer-connolly/code/brain-indexer/index.html)
Main HTML entry point for the desktop webview.

#### [NEW] [src/main.tsx](file:///Users/brandonlamer-connolly/code/brain-indexer/src/main.tsx)
Bootstrap the React DOM and load global styles.

#### [NEW] [src/App.tsx](file:///Users/brandonlamer-connolly/code/brain-indexer/src/App.tsx)
Build the primary application workspace, including:
1. **Sidebar Navigation:** Switch between the `Staging Workspace`, `Vault Integrity / Health Checker`, and `App Configuration`.
2. **Setup Panel:** Select Obsidian vault path and staging dropzone folder (with system-native pickers).
3. **Interactive Staging Canvas:** Select a project, review its links, deselect specific links, and click **Stage Study Guide** with real-time process feedback.
4. **Side-by-Side Markdown Viewer:** Review rendered study guide output.

#### [NEW] [src/index.css](file:///Users/brandonlamer-connolly/code/brain-indexer/src/index.css)
A custom modern theme following best-practice CSS variables. Includes premium glassmorphic cards, harmonized dark-mode colors (slate-grey backgrounds, electric purple accents), and smooth active-state micro-animations.

---

## Verification Plan

### Automated Tests
- Run backend unit tests to verify PARA scanning integrity:
  ```bash
  cd src-tauri
  cargo test
  ```
- Run Vite build check to verify TypeScript and build compiles without issues:
  ```bash
  npm run build
  ```

### Manual Verification
- **Setup & Vault Detection:** Validate that starting the desktop application successfully prompts for the Obsidian vault and detects missing/present PARA folders.
- **Link Auditing:** Select a sample project note containing nested wiki-links and verify the UI displays the resolved target notes correctly.
- **Cherry-Picking Staging:** Verify toggling individual checkboxes in the staging dependency list changes the live rendered markdown bundle output.
- **Staging Generation:** Complete a staging operation and verify the target `{Project}_StudyGuide.md` file is compiled and successfully written to the selected outDir.
