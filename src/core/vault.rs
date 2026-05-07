use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use anyhow::{Result, anyhow};

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

pub struct Vault {
    root: PathBuf,
}

impl Vault {
    pub fn new(path: impl AsRef<Path>) -> Result<Self> {
        let root = path.as_ref().to_path_buf();
        if !root.is_dir() {
            return Err(anyhow!("Vault path is not a directory"));
        }
        
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs;

    #[test]
    fn test_vault_validation() {
        let dir = tempdir().unwrap();
        let path = dir.path();
        
        assert!(Vault::new(path).is_err());
        
        fs::create_dir(path.join("01_Projects")).unwrap();
        fs::create_dir(path.join("02_Areas")).unwrap();
        fs::create_dir(path.join("03_Resources")).unwrap();
        fs::create_dir(path.join("04_Archives")).unwrap();
        
        assert!(Vault::new(path).is_ok());
    }
}
