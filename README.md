# brain-indexer

A high-performance, local-first "Second Brain" workspace built in Rust for indexing, querying, and staging PARA-structured markdown vaults, designed for AI-augmented knowledge retrieval.

`brain-indexer` bridges the gap between static markdown notes (such as Obsidian) and agentic AI workflows. It parses your project wiki-links, resolves nested references, and flattens them into consolidated Markdown study guides tailored specifically for **Google NotebookLM** ingestion.

---

## 🚀 Two Powerful Interfaces

`brain-indexer` is structured as a **Cargo Workspace** offering two distinct ways to manage your knowledge base:

1. **Visual Desktop Command Center (Tauri + React):** A native, lightweight desktop app featuring:
   * **Interactive Staging Workspace:** Load project notes, inspect resolved wiki-links, and cherry-pick which dependencies (from Areas or Resources) to include or exclude.
   * **Side-by-Side Live Preview:** Real-time rendered preview of your compiled study guide before staging it to your dropzone.
   * **Vault Health Auditor:** Audit vault integrity to instantly locate dead wiki-links and trace PARA hygiene issues.
   * **Directory Browser Pickers:** Configure Obsidian vault paths and output dropzones using native OS selectors.
2. **High-Performance CLI Utility:** A standalone, compilation-friendly executable designed for terminal automation, cron staging, and scripting.

---

## 📁 Repository Architecture

The project is segmented into isolated, focused crates to maximize portability and maintainability:

```
brain-indexer/
├── core/                 # Shared Core Library (Vault models, PARA scanners, compilers)
├── cli/                  # Command-Line Interface (brain-indexer-cli executable)
├── src-tauri/            # Native Desktop backend app (Tauri window binds & IPC Commands)
└── src/                  # Desktop frontend SPA (React + TypeScript + Vite)
```

---

## 🛠️ Getting Started

### Prerequisites

* [Rust](https://www.rust-lang.org/tools/install) (latest stable)
* [pnpm](https://pnpm.io/installation) (version 10+)

### 🖥️ Native Desktop Application

1. **Install Frontend Dependencies:**
   ```bash
   pnpm install
   ```
2. **Run in Development Mode (Hot Reload):**
   ```bash
   pnpm tauri dev
   ```
3. **Compile Production Desktop Bundle:**
   ```bash
   pnpm tauri build
   ```
   *The compiled standalone installer (`.dmg` / `.app` on macOS, `.msi` on Windows) will be generated inside `src-tauri/target/release/bundle/`.*

### 🐚 Command-Line Utility

Since the CLI is separated from Webview dependencies, you can compile and install it globally without requiring node or system-level GUI libraries:

1. **Build the CLI:**
   ```bash
   cargo build --release --bin brain-indexer-cli
   ```
2. **List Projects:**
   ```bash
   cargo run --bin brain-indexer-cli -- list --vault /path/to/your/vault
   ```
3. **JSON Output for AI Agents:**
   ```bash
   cargo run --bin brain-indexer-cli -- list --vault /path/to/your/vault --json
   ```
4. **Compile and Stage Study Guide:**
   ```bash
   cargo run --bin brain-indexer-cli -- stage --vault /path/to/your/vault --target Lyrics_Guesser --out-dir /path/to/dropzone
   ```

---

## 🔒 Zero-Exposure Security & Privacy

`brain-indexer` follows the strict **"Zero-Exposure"** principle to guarantee your private notes never leak:
1. **Redaction Engine:** Absolute system paths are dynamically redacted from runtime error logs to prevent accidental leakages in shared snippets.
2. **Offline-First Execution:** 100% of directory parsing, wiki-link resolution, and flat compilation runs locally on your machine. No note content ever touches external cloud servers.

---

## 📄 License

This project is licensed under the [MIT](LICENSE) License.
