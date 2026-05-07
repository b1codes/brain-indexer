# brain-indexer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a blazingly fast PARA-structured markdown vault indexer with "Zero-Exposure" security.

**Architecture:** Library-Core approach separating the scanning engine from the CLI interface to support future MCP server integration.

**Tech Stack:** Rust, `clap` (CLI), `walkdir` (Scanner), `serde` (JSON), `tokio` (Async foundation).

---

### Task 1: Project Initialization

**Files:**
- Create: `Cargo.toml`
- Create: `src/lib.rs`
- Create: `src/main.rs`

- [ ] **Step 1: Initialize Cargo project**
Run: `cargo init` (if not already done) or create `Cargo.toml`.

```toml
[package]
name = "brain-indexer"
version = "0.1.0"
edition = "2021"

[dependencies]
clap = { version = "4.4", features = ["derive"] }
walkdir = "2.4"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1.0"
thiserror = "1.0"
tokio = { version = "1.35", features = ["full"] }
```

- [ ] **Step 2: Create entry points**
Create empty `src/lib.rs` and a hello-world `src/main.rs`.

- [ ] **Step 3: Verify build**
Run: `cargo build`
Expected: Success.

- [ ] **Step 4: Commit**
```bash
git add Cargo.toml src/
git commit -m "chore: initialize rust project"
```

---

### Task 2: Core Data Models & Vault Validation

**Files:**
- Create: `src/core/mod.rs`
- Create: `src/core/vault.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Define ParaCategory and Note structs**
In `src/core/vault.rs`:
```rust
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum ParaCategory {
    Projects,
    Areas,
    Resources,
    Archives,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub title: String,
    pub relative_path: String,
    pub category: ParaCategory,
}
```

- [ ] **Step 2: Implement Vault struct and Validation**
In `src/core/vault.rs`:
```rust
use std::path::{Path, PathBuf};
use anyhow::{Result, anyhow};

pub struct Vault {
    root: PathBuf,
}

impl Vault {
    pub fn new(path: impl AsRef<Path>) -> Result<Self> {
        let root = path.as_ref().to_path_buf();
        if !root.is_dir() {
            return Err(anyhow!("Vault path is not a directory"));
        }
        
        // Validate PARA structure
        let required = ["01_Projects", "02_Areas", "03_Resources", "04_Archives"];
        for dir in required {
            if !root.join(dir).is_dir() {
                return Err(anyhow!("Missing required PARA folder: {}", dir));
            }
        }
        
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
}
```

- [ ] **Step 3: Write tests for Vault validation**
In `src/core/vault.rs` (module tests):
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs;

    #[test]
    fn test_vault_validation() {
        let dir = tempdir().unwrap();
        let path = dir.path();
        
        // Should fail on empty dir
        assert!(Vault::new(path).is_err());
        
        // Create PARA structure
        fs::create_dir(path.join("01_Projects")).unwrap();
        fs::create_dir(path.join("02_Areas")).unwrap();
        fs::create_dir(path.join("03_Resources")).unwrap();
        fs::create_dir(path.join("04_Archives")).unwrap();
        
        // Should pass now
        assert!(Vault::new(path).is_ok());
    }
}
```
*Note: Add `tempfile = "3.8"` to `Cargo.toml` dev-dependencies.*

- [ ] **Step 4: Run tests**
Run: `cargo test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/core/ src/lib.rs
git commit -m "feat: add core data models and vault validation"
```

---

### Task 3: The Project Scanner (Zero-Exposure)

**Files:**
- Create: `src/scanner/mod.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Implement the Scanner**
In `src/scanner/mod.rs`:
```rust
use crate::core::vault::{Vault, Note, ParaCategory};
use walkdir::WalkDir;
use anyhow::Result;

pub struct Scanner<'a> {
    vault: &'a Vault,
}

impl<'a> Scanner<'a> {
    pub fn new(vault: &'a Vault) -> Self {
        Self { vault }
    }

    pub fn scan_projects(&self) -> Result<Vec<Note>> {
        let projects_dir = self.vault.root().join("01_Projects");
        let mut notes = Vec::new();

        for entry in WalkDir::new(projects_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file() && e.path().extension().map_or(false, |ext| ext == "md"))
        {
            let full_path = entry.path();
            let relative_path = full_path.strip_prefix(self.vault.root())?
                .to_string_lossy()
                .into_owned();
            
            let title = full_path.file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| "Untitled".to_string());

            notes.push(Note {
                title,
                relative_path,
                category: ParaCategory::Projects,
            });
        }

        Ok(notes)
    }
}
```

- [ ] **Step 2: Verify Relative Pathing**
Ensure that `strip_prefix` is used correctly to fulfill "Zero-Exposure" (never storing absolute paths).

- [ ] **Step 3: Write test for scanner**
In `src/scanner/mod.rs` (module tests):
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::vault::Vault;
    use tempfile::tempdir;
    use std::fs;

    #[test]
    fn test_scan_discovery() {
        let dir = tempdir().unwrap();
        let path = dir.path();
        
        fs::create_dir(path.join("01_Projects")).unwrap();
        fs::create_dir(path.join("02_Areas")).unwrap();
        fs::create_dir(path.join("03_Resources")).unwrap();
        fs::create_dir(path.join("04_Archives")).unwrap();
        
        fs::write(path.join("01_Projects/Idea.md"), "# Idea").unwrap();
        fs::write(path.join("01_Projects/Draft.txt"), "Not a markdown").unwrap();
        
        let vault = Vault::new(path).unwrap();
        let scanner = Scanner::new(&vault);
        let notes = scanner.scan_projects().unwrap();
        
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].title, "Idea");
        assert_eq!(notes[0].relative_path, "01_Projects/Idea.md");
    }
}
```

- [ ] **Step 4: Run tests**
Run: `cargo test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/scanner/
git commit -m "feat: implement project scanner with relative pathing"
```

---

### Task 4: CLI Interface Implementation

**Files:**
- Modify: `src/main.rs`

- [ ] **Step 1: Implement CLI using clap**
In `src/main.rs`:
```rust
use clap::{Parser, Subcommand};
use brain_indexer::core::vault::Vault;
use brain_indexer::scanner::Scanner;
use anyhow::Result;

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
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::List { vault, json } => {
            let vault_obj = Vault::new(vault)?;
            let scanner = Scanner::new(&vault_obj);
            let notes = scanner.scan_projects()?;

            if json {
                println!("{}", serde_json::to_string_pretty(&notes)?);
            } else {
                for note in notes {
                    println!("[Project] {} ({})", note.title, note.relative_path);
                }
            }
        }
    }

    Ok(())
}
```

- [ ] **Step 2: Add Error Masking (Sanitization)**
In `src/main.rs`, wrap the `main` logic to catch `anyhow::Error` and strip absolute paths if they leak into error messages (optional but recommended for Zero-Exposure).

- [ ] **Step 3: Manual Verification**
Create a dummy vault and run:
`cargo run -- list --vault /absolute/path/to/dummy`
`cargo run -- list --vault /absolute/path/to/dummy --json`

- [ ] **Step 4: Commit**
```bash
git add src/main.rs
git commit -m "feat: implement CLI interface for listing projects"
```

---

### Task 5: Final Cleanup & Documentation

**Files:**
- Modify: `README.md`
- Create: `config.toml.example`

- [ ] **Step 1: Update README.md with usage instructions**
- [ ] **Step 2: Create a sample configuration file**
- [ ] **Step 3: Run full test suite one last time**
- [ ] **Step 4: Commit**
```bash
git add README.md
git commit -m "docs: finalize MVP documentation and usage instructions"
```
