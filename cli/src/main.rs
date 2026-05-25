use anyhow::{Context, Result};
use brain_indexer_core::compiler;
use brain_indexer_core::core::vault::Vault;
use brain_indexer_core::scanner::Scanner;
use clap::{Parser, Subcommand};
use std::fs;
use std::path::Path;

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

    /// Compile a project and its linked resources for NotebookLM ingestion
    Stage {
        /// Absolute path to the Obsidian vault
        #[arg(short, long)]
        vault: String,

        /// The exact name of the project to compile (e.g. "Lyrics_Guesser")
        #[arg(short, long)]
        target: String,

        /// Absolute path to the output directory (e.g. a Google Drive Dropzone)
        #[arg(short, long)]
        out_dir: String,
    },
}

fn main() {
    let cli = Cli::parse();

    // Capture sensitive paths for stderr redaction before moving `cli` into `run`.
    let (vault_path, out_dir_path) = match &cli.command {
        Commands::List { vault, .. } => (vault.clone(), String::new()),
        Commands::Stage { vault, out_dir, .. } => (vault.clone(), out_dir.clone()),
    };

    if let Err(e) = run(cli) {
        let mut error_msg = format!("{:?}", e);
        if !vault_path.is_empty() {
            error_msg = error_msg.replace(&vault_path, "[REDACTED]");
        }
        if !out_dir_path.is_empty() {
            error_msg = error_msg.replace(&out_dir_path, "[REDACTED]");
        }
        eprintln!("Error: {}", error_msg);
        std::process::exit(1);
    }
}

fn run(cli: Cli) -> Result<()> {
    match cli.command {
        Commands::List { vault, json } => {
            let vault_path = Path::new(&vault);
            let vault_obj = Vault::new(vault_path)
                .with_context(|| format!("Failed to initialize vault at {}", vault))?;

            let scanner = Scanner::new(&vault_obj);
            let notes = scanner.scan_projects().context("Failed to scan projects")?;

            if json {
                let json_output = serde_json::to_string_pretty(&notes)
                    .context("Failed to serialize notes to JSON")?;
                println!("{}", json_output);
            } else if notes.is_empty() {
                println!("No projects found.");
            } else {
                for note in notes {
                    println!("[Project] {} ({})", note.title, note.relative_path);
                }
            }
        }
        Commands::Stage {
            vault,
            target,
            out_dir,
        } => {
            let vault_obj = Vault::new(Path::new(&vault))
                .with_context(|| format!("Failed to initialize vault at {}", vault))?;

            let compiled = compiler::compile_project(&vault_obj, &target)
                .with_context(|| format!("Failed to compile target '{}'", target))?;

            let out_dir_path = Path::new(&out_dir);
            fs::create_dir_all(out_dir_path)
                .with_context(|| format!("Failed to create out_dir {}", out_dir))?;

            let out_file = out_dir_path.join(format!("{target}_StudyGuide.md"));
            fs::write(&out_file, compiled)
                .with_context(|| format!("Failed to write {}", out_file.display()))?;

            println!("Wrote study guide to {}", out_file.display());
        }
    }

    Ok(())
}
