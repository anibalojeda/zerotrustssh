const { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage } = require('electron')
const { execFile } = require('node:child_process')
const pty = require('@homebridge/node-pty-prebuilt-multiarch')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { promisify } = require('node:util')

let mainWindow
const sshSessions = new Map()
const secretFiles = new Set()
const execFileAsync = promisify(execFile)

app.setName('ZERO Trust SSH Client')
app.setAboutPanelOptions({
  applicationName: 'ZERO Trust SSH Client',
  applicationVersion: app.getVersion(),
  version: app.getVersion(),
  copyright: '© 2026 Anibal Ojeda',
  credits: 'ZERO Trust SSH Client',
})

function assertTrustedRenderer(event) {
  const url = event.senderFrame?.url ?? ''
  if (!url.startsWith('file://') && !/^http:\/\/127\.0\.0\.1:5173(?:\/|$)/.test(url)) {
    throw new Error('This action is only available to the ZERO Trust app window.')
  }
}

function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args)
}

function installApplicationMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New SSH Host', accelerator: 'CmdOrCtrl+N', click: () => sendToRenderer('menu:action', 'new-host') },
        { label: 'Appearance', click: () => sendToRenderer('menu:action', 'appearance') },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(process.platform === 'darwin' ? [{ type: 'separator' }, { role: 'front' }] : [])] },
    ...(process.platform === 'darwin' ? [] : [{
      label: 'Help',
      submenu: [{
        label: 'About ZERO Trust SSH Client',
        click: () => {
          void dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About ZERO Trust SSH Client',
            message: 'ZERO Trust SSH Client',
            detail: `Version ${app.getVersion()}`,
          })
        },
      }],
    }]),
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function validPort(value, label) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${label} must be a port between 1 and 65535.`)
  return String(port)
}

function validHost(value, label) {
  if (typeof value !== 'string' || value.length > 255 || !/^[A-Za-z0-9._:[\]-]+$/.test(value) || value.startsWith('-')) {
    throw new Error(`${label} must be a valid hostname or IP address.`)
  }
  return value
}

function getPasswordPath(profileId) {
  if (typeof profileId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    throw new Error('Invalid SSH host profile.')
  }
  return path.join(app.getPath('userData'), `ssh-password-${profileId}.enc`)
}

function assertPasswordEncryptionAvailable() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure password storage is unavailable on this system.')
  }
}

function buildSshArguments(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('Choose an SSH host profile.')
  const hostname = validHost(profile.hostname, 'Hostname')
  if (typeof profile.username !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(profile.username)) throw new Error('Enter a valid SSH username.')
  const port = validPort(profile.port, 'SSH port')
  const args = ['-tt', '-p', port, '-l', profile.username]
  args.push('-o', `StrictHostKeyChecking=${profile.hostKeyPolicy === 'accept-new' ? 'accept-new' : 'yes'}`)
  const timeout = Number(profile.connectTimeout)
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120) throw new Error('Connection timeout must be between 1 and 120 seconds.')
  const keepAliveInterval = Number(profile.keepAliveInterval)
  if (!Number.isInteger(keepAliveInterval) || keepAliveInterval < 0 || keepAliveInterval > 300) throw new Error('Keepalive interval must be between 0 and 300 seconds.')
  const keepAliveCount = Number(profile.keepAliveCount)
  if (!Number.isInteger(keepAliveCount) || keepAliveCount < 1 || keepAliveCount > 10) throw new Error('Keepalive retries must be between 1 and 10.')
  args.push('-o', `ConnectTimeout=${timeout}`, '-o', `ServerAliveInterval=${keepAliveInterval}`, '-o', `ServerAliveCountMax=${keepAliveCount}`)

  if (profile.authMethod === 'key') {
    if (typeof profile.keyPath !== 'string' || !path.isAbsolute(profile.keyPath)) throw new Error('Choose a private key file.')
    args.push('-i', profile.keyPath, '-o', 'IdentitiesOnly=yes')
  } else if (profile.authMethod === 'password') {
    args.push('-o', 'PreferredAuthentications=password,keyboard-interactive', '-o', 'PubkeyAuthentication=no')
  } else if (profile.authMethod !== 'agent') {
    throw new Error('Choose a supported SSH authentication method.')
  }
  if (profile.agentForwarding === true) args.push('-A')
  if (typeof profile.jumpHost === 'string' && profile.jumpHost.trim() && typeof profile.proxy === 'string' && profile.proxy.trim()) {
    throw new Error('Choose either a jump host or an HTTP CONNECT proxy, not both.')
  }
  if (typeof profile.jumpHost === 'string' && profile.jumpHost.trim()) {
    const jump = profile.jumpHost.trim()
    if (jump.startsWith('-') || !/^[A-Za-z0-9._@:[\],-]+$/.test(jump)) throw new Error('Jump host may contain only hostnames, usernames, ports, and commas.')
    args.push('-J', jump)
  }
  if (typeof profile.proxy === 'string' && profile.proxy.trim()) {
    const proxy = profile.proxy.trim()
    if (proxy.startsWith('-') || !/^[A-Za-z0-9._:[\]-]+$/.test(proxy)) throw new Error('Proxy must be a hostname or IP, optionally followed by a port.')
    args.push('-o', `ProxyCommand=/usr/bin/nc -X connect -x ${proxy} %h %p`)
  }
  if (profile.utf8 === true) args.push('-o', 'SendEnv=LANG,LC_*')

  if (typeof profile.environment === 'string') {
    const rows = profile.environment.split(/\r?\n/).filter((row) => row.trim())
    if (rows.length > 32) throw new Error('Use no more than 32 SSH environment variables.')
    for (const row of rows) {
      const separator = row.indexOf('=')
      const name = row.slice(0, separator)
      const value = row.slice(separator + 1)
      if (separator <= 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || /[\0\r\n\s]/.test(value) || value.length > 256) {
        throw new Error(`Invalid SSH environment variable: ${row.slice(0, 40)}`)
      }
      args.push('-o', `SetEnv=${name}=${value}`)
    }
  }

  if (!Array.isArray(profile.tunnels) || profile.tunnels.length > 24) throw new Error('A host can have up to 24 port-forwarding rules.')
  for (const tunnel of profile.tunnels) {
    if (!tunnel || typeof tunnel !== 'object') throw new Error('Invalid port-forwarding rule.')
    const localPort = validPort(tunnel.localPort, 'Forwarding port')
    if (tunnel.type === 'dynamic') args.push('-D', localPort)
    else {
      const destinationHost = validHost(tunnel.host, 'Forwarding destination')
      const destinationPort = validPort(tunnel.remotePort, 'Destination port')
      args.push(tunnel.type === 'remote' ? '-R' : '-L', `${localPort}:${destinationHost}:${destinationPort}`)
    }
  }
  args.push(hostname)
  return args
}

async function createAskpassScript() {
  const scriptPath = path.join(app.getPath('userData'), 'ssh-askpass.sh')
  await fs.mkdir(path.dirname(scriptPath), { recursive: true, mode: 0o700 })
  await fs.writeFile(scriptPath, '#!/bin/sh\nif [ -n "${ZERO_TRUST_SSH_SECRET_FILE:-}" ] && [ -f "$ZERO_TRUST_SSH_SECRET_FILE" ]; then\n  /bin/cat "$ZERO_TRUST_SSH_SECRET_FILE"\n  exit $?\nfi\nexit 1\n', { mode: 0o700 })
  await fs.chmod(scriptPath, 0o700)
  return scriptPath
}

function cleanSecret(secretPath) {
  if (!secretPath) return
  secretFiles.delete(secretPath)
  void fs.rm(secretPath, { force: true }).catch((error) => console.error('Could not remove temporary SSH credential file.', error))
}

ipcMain.handle('ssh:connect', async (event, profile, password) => {
  assertTrustedRenderer(event)
  const args = buildSshArguments(profile)
  let secretPath = null
  const environment = { ...process.env }
  environment.TERM = 'xterm-256color'
  if (profile.authMethod === 'password') {
    if (typeof password !== 'string' || password.length === 0 || password.length > 4096 || password.includes('\0')) {
      throw new Error('Enter a password to start this SSH session.')
    }
    secretPath = path.join(app.getPath('temp'), `zero-trust-ssh-${randomUUID()}.secret`)
    try {
      await fs.writeFile(secretPath, password, { flag: 'wx', mode: 0o600 })
      await fs.chmod(secretPath, 0o600)
      secretFiles.add(secretPath)
      environment.SSH_ASKPASS = await createAskpassScript()
    } catch (error) {
      cleanSecret(secretPath)
      throw error
    }
    environment.SSH_ASKPASS_REQUIRE = 'force'
    environment.ZERO_TRUST_SSH_SECRET_FILE = secretPath
    environment.DISPLAY = environment.DISPLAY || 'ZERO-TRUST'
  }
  const id = randomUUID()
  let child
  try {
    child = pty.spawn(process.platform === 'win32' ? 'ssh.exe' : '/usr/bin/ssh', args, {
      name: environment.TERM,
      cols: 120,
      rows: 36,
      cwd: os.homedir(),
      env: environment,
    })
  } catch (error) {
    cleanSecret(secretPath)
    throw error
  }
  sshSessions.set(id, { child, secretPath })
  let finalized = false
  const finalize = (result) => {
    if (finalized) return
    finalized = true
    cleanSecret(secretPath)
    sshSessions.delete(id)
    sendToRenderer('ssh:exit', id, result)
  }
  child.onData((data) => sendToRenderer('ssh:data', id, data))
  child.onExit(({ exitCode, signal }) => {
    finalize({ code: exitCode, signal: signal ? String(signal) : null, error: null })
  })
  return id
})

ipcMain.handle('ssh:input', (event, id, data) => {
  assertTrustedRenderer(event)
  const session = sshSessions.get(id)
  if (!session) throw new Error('The SSH session is no longer active.')
  if (typeof data !== 'string' || Buffer.byteLength(data, 'utf8') > 65536) throw new Error('SSH input exceeds the 64 KB limit.')
  session.child.write(data)
  return true
})

ipcMain.handle('ssh:resize', (event, id, columns, rows) => {
  assertTrustedRenderer(event)
  const session = sshSessions.get(id)
  if (!session) throw new Error('The SSH session is no longer active.')
  if (!Number.isInteger(columns) || columns < 2 || columns > 500 || !Number.isInteger(rows) || rows < 2 || rows > 200) {
    throw new Error('Terminal dimensions are outside the supported range.')
  }
  session.child.resize(columns, rows)
})

ipcMain.handle('ssh:close', (event, id) => {
  assertTrustedRenderer(event)
  const session = sshSessions.get(id)
  if (session) session.child.kill()
})

ipcMain.handle('ssh:select-key', async (event) => {
  assertTrustedRenderer(event)
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose an SSH private key',
    defaultPath: path.join(os.homedir(), '.ssh'),
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('ssh:password:get', async (event, profileId) => {
  assertTrustedRenderer(event)
  const passwordPath = getPasswordPath(profileId)
  let encrypted
  try { encrypted = await fs.readFile(passwordPath) }
  catch (error) {
    if (error.code === 'ENOENT') return null
    throw new Error(`Could not read the saved SSH password: ${error.message}`)
  }
  assertPasswordEncryptionAvailable()
  try { return safeStorage.decryptString(encrypted) }
  catch (error) { throw new Error(`Could not decrypt the saved SSH password: ${error.message}`) }
})

ipcMain.handle('ssh:password:save', async (event, profileId, password) => {
  assertTrustedRenderer(event)
  const passwordPath = getPasswordPath(profileId)
  if (typeof password !== 'string' || password.length === 0 || password.length > 4096 || password.includes('\0')) {
    throw new Error('Enter a valid password before saving it.')
  }
  assertPasswordEncryptionAvailable()
  const encrypted = safeStorage.encryptString(password)
  const temporaryPath = `${passwordPath}.${randomUUID()}.tmp`
  try {
    await fs.mkdir(path.dirname(passwordPath), { recursive: true, mode: 0o700 })
    await fs.writeFile(temporaryPath, encrypted, { flag: 'wx', mode: 0o600 })
    await fs.chmod(temporaryPath, 0o600)
    await fs.rename(temporaryPath, passwordPath)
  } catch (error) {
    try { await fs.rm(temporaryPath, { force: true }) }
    catch (cleanupError) { console.error('Could not remove temporary saved-password file.', cleanupError) }
    throw new Error(`Could not save the SSH password securely: ${error.message}`)
  }
  return true
})

ipcMain.handle('ssh:password:delete', async (event, profileId) => {
  assertTrustedRenderer(event)
  const passwordPath = getPasswordPath(profileId)
  try { await fs.rm(passwordPath, { force: true }) }
  catch (error) { throw new Error(`Could not remove the saved SSH password: ${error.message}`) }
  return true
})

ipcMain.handle('ssh:list-keys', async (event) => {
  assertTrustedRenderer(event)
  const sshDirectory = path.join(os.homedir(), '.ssh')
  let entries
  try { entries = await fs.readdir(sshDirectory, { withFileTypes: true }) }
  catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  return entries
    .filter((entry) => entry.isFile() && /^(id_(rsa|ed25519|ecdsa)|.*\.pem|.*_key)$/.test(entry.name))
    .map((entry) => ({ name: entry.name, path: path.join(sshDirectory, entry.name) }))
})

ipcMain.handle('ssh:known-host', async (event, hostname) => {
  assertTrustedRenderer(event)
  const safeHost = validHost(hostname, 'Hostname')
  try {
    const { stdout } = await execFileAsync('ssh-keygen', ['-F', safeHost], { timeout: 5000, maxBuffer: 1024 * 1024 })
    const details = stdout.split(/\r?\n/).filter((line) => line.startsWith('#')).join('\n')
    return `A matching host key is recorded in ~/.ssh/known_hosts.${details ? `\n${details}` : ''}`
  } catch (error) {
    if (error.code === 1) return 'No matching key was found in ~/.ssh/known_hosts. The host is not trusted yet.'
    throw new Error(`Could not check the local known_hosts file: ${error.message}`)
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 760, minHeight: 560, show: false, title: 'ZERO Trust SSH Client',
    icon: path.join(__dirname, 'icon.png'), backgroundColor: '#10171b', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 15, y: 16 },
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.once('ready-to-show', () => mainWindow.show())
  if (app.isPackaged) mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  else mainWindow.loadURL('http://127.0.0.1:5173')
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.setIcon(path.join(__dirname, 'icon.png'))
  installApplicationMenu()
  createWindow()
})
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => {
  for (const { child } of sshSessions.values()) child.kill()
  for (const secretPath of secretFiles) {
    try { fsSync.rmSync(secretPath, { force: true }) }
    catch (error) { console.error('Could not remove temporary SSH credential file.', error) }
  }
})