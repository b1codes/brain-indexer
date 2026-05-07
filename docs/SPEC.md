# SPEC.md: brain-indexer

**Project Owner:** B1Codes LLC

**Version:** 1.0.0 (Proposed)

**Target Architecture:** macOS (Apple Silicon / aarch64)

**Primary Goal:** High-performance indexing and querying of PARA-structured markdown vaults for AI-augmented knowledge retrieval.

---

## 1. Executive Summary

The `brain-indexer` is a specialized CLI utility built in Rust designed to bridge the gap between static markdown notes (Obsidian) and agentic AI workflows. By providing a blazingly fast indexing layer, it allows AI agents to navigate a local "Second Brain" with the same speed and precision as a structured database.

---

## 2. Technical Stack

* **Language:** Rust (Latest Stable)
* **CLI Framework:** `clap` (Command Line Argument Parser)
* **File Traversal:** `walkdir` (Optimized recursive directory walking)
* **Data Serialization:** `serde` & `serde_json` (For MCP compatibility)
* **Pattern Matching:** `regex` (High-performance text scanning)
* **Async Runtime:** `tokio` (For future-proofing watcher and server modes)

---

## 3. Core Requirements & Logic

### 3.1 Directory Scoping

The tool must operate outside of the target vault. It will accept a `--vault` or `-v` flag representing the absolute path to the Obsidian vault.

* **Validation:** The tool must verify the presence of the **PARA** core folders:
* `01_Projects`
* `02_Areas`
* `03_Resources`
* `04_Archives`



### 3.2 Indexing Engine

The indexer will generate a lightweight JSON manifest of the vault.

* **Metadata Extraction:** Capture file names, tags (`#tag`), frontmatter (YAML), and internal wiki-links (`[[link]]`).
* **Performance Target:** Index a 10,000-file vault in under 200ms on Apple Silicon hardware.

### 3.3 Search & Query

* **Fuzzy Search:** Implementation of a basic fuzzy-matching algorithm for finding notes by title.
* **Contextual Search:** Ability to search for "Projects" that haven't been modified in $X$ days.

### 3.4 MCP Integration (Phase 2)

The tool will eventually act as a **Model Context Protocol (MCP)** server, allowing AI agents (Claude, Gemini CLI) to call `search_notes` or `get_note_content` as native tools.

---

## 4. Security & Privacy Architecture

To maintain a **public code repository** while ensuring **private data** remains secure, the following "Zero-Exposure" protocols are required:

### 4.1 Environment Abstraction

No local file paths shall be hardcoded. The application will look for a `config.toml` or a `.env` file for default paths, which are explicitly ignored by version control.

### 4.2 Error Masking

Compiler and runtime errors must be sanitized to ensure that absolute local system paths (e.g., `/Users/brandon/...`) are not leaked in public logs or shared snippets.

---

## 5. Portfolio "Wildcard" Feature

**Feature Idea: "The PARA-Graph Health Check"**
A command (`brain-indexer health`) that analyzes the vault and identifies "orphaned" notes (notes with no links) or "stagnant" projects (notes in `01_Projects` that should be moved to `04_Archives`). This demonstrates high-level organizational logic, not just file reading.

---

## 6. The `.gitignore` Requirements

To keep your public repo professional and secure, your `.gitignore` must filter out three categories of data:

### A. Rust/Build Artifacts

Standard Rust noise that doesn't belong in Git.

```text
/target
Cargo.lock (Note: Optional for binaries, but keep for now)
**/*.rs.bk

```

### B. User-Specific Configuration

This is the most critical section for your privacy.

```text
# Local Configuration
.env
config.toml
*.local.toml

# Operating System specific
.DS_Store
.AppleDouble
.LSOverride

```

### C. Test Data (The "Safety Valve")

If you create a "dummy" vault for testing your code, keep it in a specific folder and ignore it so you don't accidentally push a folder containing actual notes.

```text
# Test Vaults
/tests/fixtures/my_real_notes/
/debug_vault/

```

---

## 7. Roadmap

1. **MVP:** CLI that accepts a path and prints a list of all `.md` files in `01_Projects`.
2. **v1.1:** Implementation of JSON export for the entire index.
3. **v1.2:** Search functionality using `regex`.
4. **v2.0:** Full MCP Server implementation for AI Agent integration.