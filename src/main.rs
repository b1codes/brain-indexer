use anyhow::{Context, Result};
use brain_indexer::core::vault::Vault;
use brain_indexer::scanner::Scanner;
use clap::{Parser, Subcommand};
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
}

fn main() {
    let cli = Cli::parse();

    // Capture the vault path for error masking before we move it
    let vault_path = match &cli.command {
        Commands::List { vault, .. } => vault.clone(),
    };

    if let Err(e) = run(cli) {
        let mut error_msg = format!("{:?}", e);
        // Redact absolute vault path from error messages to satisfy "Zero-Exposure" requirement
        if !vault_path.is_empty() {
            error_msg = error_msg.replace(&vault_path, "[REDACTED]");
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
            } else {
                if notes.is_empty() {
                    println!("No projects found.");
                } else {
                    for note in notes {
                        println!("[Project] {} ({})", note.title, note.relative_path);
                    }
                }
            }
        }
    }

    Ok(())
}
