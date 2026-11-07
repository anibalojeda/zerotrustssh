# ZERO Trust SSH Client

A focused, local-first SSH client for macOS and Windows. Inspired by Termius, built for environments where external application accounts are restricted.

**Version:** 1.0.0


https://github.com/user-attachments/assets/de870121-2b99-48c6-b640-502e5329d57a


---

## About

### Why I Built This

I'm a big fan of Termius and the experience it provides. However, at one of our clients, I couldn't use it because it required signing into the application, and that wasn't permitted in that environment. I don't know the exact reason behind that restriction, but it made me think: why not build my own SSH client?

I wanted something more open and portable, suited to environments where an external application account is not permitted, while still respecting the organization's software and security policies.

That idea became ZERO Trust SSH Client. Inspired by the experience of using Termius, I built an application for my own daily work, and the results have been amazing. It already feels remarkably professional. It doesn't have the full feature set of Termius, but it is developing an identity of its own.

This is a starting point. I plan to keep refining it, adding my own ideas, and moving it further toward a distinct client shaped around practical needs from my work.

---

## Features

### Implemented in v1.0.0

- **Local-first SSH connections** — All connection profiles and settings stored locally on your machine. No cloud sync, no external accounts required.
- **Multi-session support** — Connect to multiple hosts simultaneously and switch between terminal sessions in real-time.
- **Host profiles & grouping** — Organize SSH connections into named groups (e.g., "Production", "Client A", "Staging"). Quick dropdown menu for adding hosts to groups.
- **Multiple authentication methods** — SSH agent (default identity), private key files, or password authentication.
- **Secure password storage** — Passwords encrypted and stored via the OS keychain (macOS Keychain, Windows Credential Manager).
- **Port forwarding** — Configure local, remote, and dynamic SSH tunnels directly from the UI.
- **Known hosts management** — View and manage SSH known hosts.
- **Customizable appearance** — Six built-in color palettes (Midnight, Slate, Ocean, Forest, Rose, Cloud) plus custom accent color selection.
- **Real terminal emulation** — Uses system PTY (pseudo-terminal) for full terminal compatibility, terminal type (xterm-256color), and proper window resize handling.
- **Keyboard shortcuts** — Double-click or press Enter/Spacebar to connect to selected host. Standard SSH keyboard shortcuts work in terminal.
- **Connection logging** — Basic connection history and event logging.
- **Jump host (bastion) support** — Configure jump hosts for multi-hop SSH connections.
- **HTTP CONNECT proxy support** — Route connections through HTTP CONNECT proxies.
- **Host key verification** — Choose between requiring known host keys or trusting new keys on first connection.
- **Keep-alive configuration** — Adjust SSH keep-alive interval and retry count.
- **Environment variables** — Pass custom environment variables to SSH sessions.
- **UTF-8 terminal support** — Request UTF-8 locale support from the server.
- **Startup commands** — Run a command automatically after login.

### Not Implemented Yet

- Keychain UI (placeholder visible but non-functional)
- Known hosts UI (placeholder visible but non-functional)
- Logs UI (placeholder visible but non-functional)
- Port forwarding UI (placeholder visible but non-functional)
- SFTP/file transfer
- X11 forwarding
- Full terminal command history UI
- Connection speed optimization or bandwidth management

---

## Architecture & Project Structure

**ZERO Trust SSH Client** is built with:

- **Frontend:** React 19 + TypeScript, xterm.js for terminal emulation
- **Desktop:** Electron 45 for cross-platform app delivery
- **Backend:** Node.js with system PTY via node-pty-prebuilt-multiarch
- **Build:** Vite (bundler), TypeScript (compiler), Electron Builder (packaging)
- **Styling:** Plain CSS with CSS variables for theming
- **Storage:** Browser localStorage for profiles and settings, OS keychain for credentials

### Directory Layout

```
zero-trust-ssh-client-1.0.0/
├── src/
│   ├── App.tsx                 # Main React application, UI, state management
│   ├── App.css                 # Application styles and themes
│   ├── main.tsx                # React entry point
│   ├── index.css               # Global styles
│   ├── desktop.d.ts            # TypeScript types for Electron preload API
│   └── assets/                 # SVG icons and images
├── electron/
│   ├── main.cjs                # Electron main process (window, IPC handlers, SSH spawn)
│   ├── preload.cjs             # Electron preload script (IPC bridge to renderer)
│   └── icon.png                # Application icon for display
├── build/
│   ├── icon.svg                # Source icon (security-themed shield + padlock + nodes)
│   ├── icon.icns               # macOS app icon
│   ├── icon.ico                # Windows app icon
│   ├── icon.png                # PNG export of icon
│   └── icon.iconset/           # macOS icon set files
├── public/
│   ├── favicon.svg             # Browser favicon
│   └── icons.svg               # Icon sprite
├── scripts/
│   └── set-windows-icon.cjs    # Post-build script to embed icon in Windows .exe
├── package.json                # Dependencies, build config, scripts
├── package-lock.json           # Locked dependency versions
├── vite.config.ts              # Vite build configuration
├── tsconfig.json               # TypeScript compiler options
├── index.html                  # HTML entry point
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

---

## Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **npm** 9+ (or equivalent Node.js package manager)
- **macOS 12+** or **Windows 10+**
- A working SSH client in the system PATH (system OpenSSH on macOS/Linux, or WSL/Git Bash on Windows)

---

## Installation & Setup

### 1. Clone or Download

```bash
# Clone from GitHub (when published)
git clone https://github.com/yourusername/zero-trust-ssh-client.git
cd zero-trust-ssh-client

# Or extract the ZIP archive
unzip zero-trust-ssh-client-1.0.0.zip
cd zero-trust-ssh-client-1.0.0
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required npm packages including Electron, Vite, xterm, React, and SSH PTY support.

### 3. Run in Development Mode

```bash
npm run dev
```

This starts:
- Vite dev server on `http://127.0.0.1:5173`
- Electron app window connected to the dev server
- Hot module reloading (HMR) for live code updates

Press Ctrl+C to stop.

### 4. Build for Production

```bash
npm run build
```

This compiles TypeScript and bundles the app into `dist/` for packaging.

### 5. Package the Application

**macOS (arm64/Apple Silicon):**
```bash
npm run package:mac
```

Outputs:
- `release/ZERO Trust SSH Client-1.0.0-arm64.dmg` — installer
- `release/ZERO Trust SSH Client-1.0.0-arm64-mac.zip` — portable

**Windows (x64):**
```bash
npm run package:win
```

Outputs:
- `release/ZERO Trust SSH Client-1.0.0-win.zip` — portable executable

After packaging, installers/zips appear in the `release/` directory.

---

## Usage

### Creating a Connection

1. Open the app and click **"New host"** in the Hosts view
2. Fill in the connection details:
   - **Label** — Friendly name (e.g., "Production Web 01")
   - **Hostname or IP** — Server address
   - **SSH Port** — Usually 22
   - **Username** — Remote user account
   - **Authentication** — Choose SSH agent, private key file, or password
   - (Optional) **Group** — Organize into groups

3. Click **"Connect"** or double-click the host card to start an SSH session

### Starting a Terminal Session

- Select a host from the list and press **Enter**, **Spacebar**, or **double-click** to connect
- A new terminal tab opens with a live SSH session
- Type SSH commands normally; terminal resizing, color output, and interactive programs are supported

### Managing Groups

1. Click the **"New host"** dropdown
2. Select **"New group"** and enter a group name
3. A modal dialog appears; type the name and press Enter
4. A new host is created and assigned to that group
5. Hosts automatically organize under their group headers
6. Edit a host and use the **Group** dropdown in the editor to move it between groups

### Organizing Connections

- Hosts are stored in **Hosts** view
- Toggle to **Terminal** to see active SSH sessions
- Access other settings via left sidebar menu

### Customizing Appearance

1. Go to **Settings** (gear icon)
2. Choose a color palette or set a custom accent color
3. Changes apply immediately and persist to localStorage

### Storing Passwords Securely

1. Open a host in the editor
2. Choose **"Password"** as the authentication method
3. Enter the password
4. Click **"Save password securely"** — password is encrypted via OS keychain
5. Next time you connect, the password loads automatically
6. Click **"Forget"** to remove the saved password

### SSH Agent Usage

If you use SSH agent (default), ensure your key is added:

```bash
ssh-add ~/.ssh/id_rsa
```

The app uses the system SSH agent automatically.

### Known Hosts & Host Key Verification

- **"Require a known host key"** — SSH connection fails if the server's host key is not in `~/.ssh/known_hosts`
- **"Trust new keys on first connect"** — Automatically accept new host keys on first connection (less secure)

---

## Configuration & Data Storage

### Connection Profiles

- **Storage:** Browser localStorage under key `zero-trust-ssh-hosts`
- **Format:** JSON array of host objects
- **Location:** 
  - macOS: `~/Library/Application Support/ZERO Trust SSH Client/`
  - Windows: `%APPDATA%\ZERO Trust SSH Client\`

### Groups

- **Storage:** Browser localStorage under key `zero-trust-ssh-groups`
- **Format:** JSON array of group name strings

### Passwords

- **Storage:** OS keychain via Electron `safeStorage` API
- **Encryption:** OS-level encryption (Keychain on macOS, Credential Manager on Windows)
- **Access:** Only the app can retrieve (cannot be read by scripts or other apps)

### Appearance Settings

- **Palette:** localStorage key `zero-trust-ssh-palette` (stores selected palette ID)
- **Custom accent color:** localStorage key `zero-trust-ssh-custom-accent` (hex color value)

### Clearing Data

To reset all profiles and settings:

1. **macOS:** Remove `~/Library/Application Support/ZERO Trust SSH Client/`
2. **Windows:** Remove `%APPDATA%\ZERO Trust SSH Client\`
3. Clear browser localStorage in app dev tools (Ctrl+Shift+I / Cmd+Opt+I → Application → Local Storage)

---

## Security Behavior

### What This App Does

- **Local-only storage** — All profiles, groups, and settings stay on your machine
- **OS-level credential encryption** — Saved passwords are encrypted via system keychain
- **Direct SSH connection** — Uses system OpenSSH client, no proxy or intermediary
- **No cloud sync** — No external servers, accounts, or tracking
- **Host key verification** — Enforces SSH host key checking by default

### What This App Does NOT Guarantee

- **Zero Trust Architecture** — Despite the name, this is a focused SSH client inspired by the "zero trust" principle of not requiring external sign-in. It does not implement a full zero-trust security architecture.
- **Perfect Security** — Like any SSH client, security depends on system configuration, key management, and SSH server configuration
- **Audit Trail** — Connection logs are basic; no detailed audit or forensic logging

### Credential Safety

- **Never** stores plaintext passwords in files or logs
- **Never** sends credentials to external servers
- **Passwords saved to keychain** are encrypted by the operating system
- **SSH keys remain in your `~/.ssh/` directory** and are never copied or transmitted

---

## Troubleshooting

### "Terminal type not set" or "unknown terminal type" errors

- Ensure xterm-256color support on your SSH server: `ssh user@host 'echo $TERM'`
- Try updating your server's terminfo database

### Terminal appears frozen or unresponsive

- The app uses a real PTY; interactive programs (vim, top, htop) should work normally
- If stuck, close the tab to disconnect
- Report reproducible cases as issues

### Password not saving or loading

- Check that OS keychain/credential manager is working on your system
- Restart the app and try again
- On macOS, verify `Keychain Access` has no locks on the ZERO Trust SSH Client entry

### Cannot connect to a host

- Verify hostname and port are correct: `ssh -v user@hostname -p port`
- Check network connectivity: `ping hostname`
- Confirm SSH key is added to agent: `ssh-add -l`
- Review host key policy: try "Trust new keys on first connect" if first-time connection

### Group appears empty or hosts disappear after adding to group

- Refresh the app (Cmd+R / Ctrl+R)
- Check browser localStorage for `zero-trust-ssh-groups` key
- Verify host's group field is set correctly in the editor

### Build or packaging fails

- Ensure Node.js 18+ is installed: `node --version`
- Clear build cache: `rm -rf node_modules dist release .vite` then `npm install`
- On Windows, ensure you have proper build tools (VS Build Tools or Python 3 + Visual Studio)

---

## Known Limitations

### v1.0.0

- **macOS only for now** — Windows packaging exists but is untested on actual Windows machines
- **No connection history UI** — Logs menu is a placeholder; no actual connection logging yet
- **No SFTP support** — File transfer not implemented
- **No X11 forwarding** — X11 connections not supported
- **No terminal recording** — Sessions are not recorded or exported
- **Single-window mode** — Only one app window per process; multiple app instances can run but don't share state
- **Terminal resize lag** — Very large terminal resizes may be slightly delayed
- **Limited keyboard mapping** — Some special keys may not map perfectly across platforms

---

## Future Direction

Planned for upcoming versions:

- Full Windows testing and support with ConPTY
- SFTP/file transfer support
- Connection history and search
- SSH key generation and management UI
- Session recording (TSCast format)
- Mobile companion app
- Team workspace/shared profile sync (opt-in, encrypted)
- Jump host UI improvements
- Port forwarding rules visualization
- Custom themes and export settings

---

## Contributing

This is a personal project actively being refined. If you have ideas, bug reports, or improvements:

1. Open an issue describing the problem or feature request
2. Include reproduction steps or examples
3. Pull requests are welcome; please keep changes focused

---

## Acknowledgments

- **Termius** — Inspiration for the user experience and feature set
- **xterm.js** — Terminal emulation library
- **Electron** — Cross-platform desktop app framework
- **React** — UI library
- **Lucide React** — Icon set
- **node-pty** — System PTY binding for Node.js

---

## License

**PENDING OWNER DECISION** — This project currently has no license file. Before publishing to GitHub, please choose and add a LICENSE file. Common choices:

- **MIT** — Permissive, commercial-friendly
- **Apache 2.0** — Permissive with patent protection
- **GPL v3** — Copyleft, requires derivatives to be open-source
- **Proprietary/Unlicensed** — No public distribution rights

Please add your chosen license to the root directory before sharing publicly.

---

## Contact

**Author:** Anibal Ojeda (ICTual)

For questions or feedback, open an issue on GitHub or contact directly.

---

**Built with care for focused, local-first SSH connectivity.**
