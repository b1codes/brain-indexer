//! NotebookLM staging compiler.
//!
//! Resolves a target project note in `01_Projects`, follows its wiki-links
//! into `02_Areas` and `03_Resources`, strips YAML frontmatter, flattens
//! wiki-links, and concatenates the result into a single markdown string.

use crate::core::vault::Vault;
use anyhow::Result;
use regex::Regex;

/// Strip a leading YAML frontmatter block (`---\n...\n---\n`) if present.
/// Only matches at the very start of the input. Mid-document `---` lines are preserved.
pub fn strip_frontmatter(content: &str) -> String {
    let re = Regex::new(r"(?s)\A---\r?\n.*?\r?\n---\r?\n?").unwrap();
    re.replace(content, "").into_owned()
}

pub fn compile_project(_vault: &Vault, _target: &str) -> Result<String> {
    unimplemented!("compile_project will be implemented in later tasks")
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
}
