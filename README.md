# brain-indexer

A blazingly fast CLI utility built in Rust for indexing and querying PARA-structured markdown vaults, designed for AI-augmented knowledge retrieval.

## Overview

`brain-indexer` bridges the gap between static markdown notes (like those in Obsidian) and agentic AI workflows. It provides a high-performance indexing layer that allows AI agents and developers to navigate a local "Second Brain" with structured precision.

## Key Features

- **PARA Support**: Optimized for vaults following the PARA (Projects, Areas, Resources, Archives) method.
- **Zero-Exposure Security**: Engineered to keep your private data safe. It redacts absolute system paths from error messages and uses configuration files to avoid hardcoding paths.
- **High Performance**: Built in Rust for speed and safety.
- **JSON Output**: Supports `--json` output for easy integration with other tools and AI agents.

## Installation

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)

### Build from source

```bash
git clone https://github.com/your-username/brain-indexer.git
cd brain-indexer
cargo build --release
```

The binary will be available at `./target/release/brain-indexer`.

## Usage

### List Projects

To list all markdown files in the `01_Projects` directory of your vault:

```bash
brain-indexer list --vault /path/to/your/vault
```

### JSON Output

For machine-readable output, use the `--json` flag:

```bash
brain-indexer list --vault /path/to/your/vault --json
```

## Configuration

You can define a default vault path in a `config.toml` file in the root directory to avoid passing the `--vault` flag every time (coming soon).

See `config.toml.example` for a sample configuration.

## Security & Privacy

This project follows the **"Zero-Exposure"** principle:
1. **Path Redaction**: Absolute system paths are redacted from runtime error messages to prevent accidental leakage in logs or shared snippets.
2. **Environment Abstraction**: Sensitive paths and configurations are kept in local files (`.env`, `config.toml`) that are excluded from version control.

## License

[MIT](LICENSE)
