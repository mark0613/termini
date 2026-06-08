# Termini

Termini is a lightweight Rust alternative to Termius for managing SSH hosts, opening terminal sessions, and moving files through SFTP from one focused desktop app.

## Features

- Manage SSH host profiles in local vaults
- Open interactive terminal sessions
- Browse and transfer files with SFTP
- Split workspaces into multiple terminal or file panes
- Customize terminal themes
- Export and import vault data

## Tech Stack

- Tauri 2
- React 19
- TypeScript
- Vite
- Rust
- xterm.js

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the desktop app:

```bash
pnpm tauri dev
```

Build the desktop app:

```bash
pnpm tauri build
```
