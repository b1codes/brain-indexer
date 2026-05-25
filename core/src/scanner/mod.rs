use crate::core::vault::{Note, ParaCategory, Vault};
use anyhow::Result;
use walkdir::WalkDir;

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

        for entry in WalkDir::new(&projects_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_type().is_file()
                    && e.path()
                        .extension()
                        .map_or(false, |ext| ext.eq_ignore_ascii_case("md"))
            })
        {
            let path = entry.path();
            let relative_path = path
                .strip_prefix(self.vault.root())?
                .to_string_lossy()
                .into_owned();

            let title = path
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();

            notes.push(Note {
                title,
                relative_path,
                category: ParaCategory::Projects,
            });
        }

        Ok(notes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::vault::Vault;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_scan_projects() {
        let dir = tempdir().unwrap();
        let path = dir.path();

        fs::create_dir(path.join("01_Projects")).unwrap();
        fs::create_dir(path.join("02_Areas")).unwrap();
        fs::create_dir(path.join("03_Resources")).unwrap();
        fs::create_dir(path.join("04_Archives")).unwrap();

        fs::write(path.join("01_Projects/task1.md"), "# Task 1").unwrap();
        fs::create_dir(path.join("01_Projects/subdir")).unwrap();
        fs::write(path.join("01_Projects/subdir/task2.md"), "# Task 2").unwrap();
        fs::write(path.join("01_Projects/not_a_note.txt"), "blah").unwrap();

        let vault = Vault::new(path).unwrap();
        let scanner = Scanner::new(&vault);
        let notes = scanner.scan_projects().unwrap();

        assert_eq!(notes.len(), 2);

        let titles: Vec<String> = notes.iter().map(|n| n.title.clone()).collect();
        assert!(titles.contains(&"task1".to_string()));
        assert!(titles.contains(&"task2".to_string()));

        for note in notes {
            assert!(note.relative_path.starts_with("01_Projects"));
            assert!(note.relative_path.ends_with(".md"));
            assert_eq!(note.category, ParaCategory::Projects);
        }
    }
}
