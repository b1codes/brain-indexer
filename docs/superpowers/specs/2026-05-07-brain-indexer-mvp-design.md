# Design Specification: brain-indexer MVP

**Date:** 2026-05-07
**Status:** Draft
**Topic:** MVP Implementation of PARA-structured markdown vault indexing.

---

## 1. Executive Summary
The `brain-indexer` is a high-performance CLI tool for indexing PARA-structured Obsidian vaults. The MVP focuses on identifying and listing markdown files within the `01_Projects` folder while establishing a "Zero-Exposure" architecture to prevent sensitive path leakage in public logs.

## 2. Architecture: Library-Core
To support Phase 2 (MCP Server) without refactoring, the project is structured as a library with a thin CLI wrapper.

### 2.1 Component Breakdown
- **Library (`lib.rs`)**: Contains all domain logic.
- **Vault Manager (`core/vault.rs`)**: Handles vault validation (PARA structure check) and path normalization.
- **Project Scanner (`scanner/mod.rs`)**: Implements optimized directory walking using `walkdir`.
- **CLI (`main.rs`)**: Uses `clap` to provide the user interface.

## 3. Data Models

### 3.1 `Note` Structure
```rust
pub struct Note {
    pub title: String,
    pub path: String, // Relative to vault root
    pub category: ParaCategory,
}

pub enum ParaCategory {
    Projects,
    Areas,
    Resources,
    Archives,
}
```

### 3.2 Index Engine
- **Storage**: In-memory `Vec<Note>` for MVP.
- **Persistence**: Phase 1.1 will add JSON manifest generation.

## 4. Security & Privacy: "Zero-Exposure" Protocols
- **Relative Pathing**: All internal logic and external outputs (logs, JSON, stdout) must use paths relative to the vault root.
- **Path Masking**: Absolute system paths (e.g., `/Users/username/...`) are only resolved at the edge (CLI input) and never stored in the `Note` struct or printed in error messages.
- **Environment Abstraction**: Default vault paths can be provided via `.env` or `config.toml`, both of which are ignored by Git.

## 5. CLI Interface
- **Command**: `brain-indexer list`
- **Arguments**:
  - `--vault <PATH>` (alias `-v`): Absolute path to the vault.
  - `--json`: (Optional) Output as JSON array.
- **Error Handling**: Custom error types that sanitize filesystem paths before printing to `stderr`.

## 6. Verification Plan

### 6.1 Testing Strategy
- **Fixtures**: A `tests/fixtures/mock_vault` will be created with standard PARA folders.
- **Unit Tests**:
  - `test_vault_validation`: Ensures tool fails if PARA folders are missing.
  - `test_relative_path_conversion`: Verifies that absolute paths are correctly stripped.
  - `test_scanner_discovery`: Verifies that only `.md` files in `01_Projects` are found by the MVP scanner.

### 6.2 Success Criteria
- [ ] Tool correctly identifies 100% of `.md` files in a mock `01_Projects` folder.
- [ ] Tool errors out when pointed at a non-PARA directory.
- [ ] No absolute system paths appear in `stdout` or `stderr`.
