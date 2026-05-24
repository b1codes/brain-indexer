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
