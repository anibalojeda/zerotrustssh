import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import {
  ArrowDownToLine, ArrowLeftRight, ArrowRight, Bell, Check, ChevronDown, ChevronRight,
  Clock3, Command, Fingerprint, KeyRound, LockKeyhole, Monitor, MoreHorizontal,
  Plus, Search, Server, Settings2, ShieldCheck, SlidersHorizontal, SquareTerminal, Tag, TerminalSquare,
  Trash2, X,
} from 'lucide-react'
import '@xterm/xterm/css/xterm.css'
import './App.css'

type Screen = 'hosts' | 'keychain' | 'forwarding' | 'known-hosts' | 'logs' | 'terminal' | 'settings'
type AuthMethod = 'agent' | 'key' | 'password'
type TunnelRule = {
  id: string
  type: 'local' | 'remote' | 'dynamic'
  localPort: string
  host: string
  remotePort: string
}
type HostProfile = {
  id: string
  label: string
  hostname: string
  port: string
  username: string
  group: string
  tags: string
  authMethod: AuthMethod
  keyPath: string
  agentForwarding: boolean
  startupCommand: string
  jumpHost: string
  proxy: string
  environment: string
  utf8: boolean
  hostKeyPolicy: 'yes' | 'accept-new'
  connectTimeout: string
  keepAliveInterval: string
  keepAliveCount: string
  tunnels: TunnelRule[]
}
type Palette = 'midnight' | 'slate' | 'ocean' | 'forest' | 'rose' | 'light'
type PaletteOption = { id: Palette; name: string; accent: string; background: string; terminal: string }

const palettes: PaletteOption[] = [
  { id: 'midnight', name: 'Midnight', accent: '#55d6a5', background: '#10171b', terminal: '#0b1115' },
  { id: 'slate', name: 'Slate', accent: '#aab8ca', background: '#141820', terminal: '#0e1118' },
  { id: 'ocean', name: 'Ocean', accent: '#63c7e6', background: '#101b23', terminal: '#09151e' },
  { id: 'forest', name: 'Forest', accent: '#9acb74', background: '#151b17', terminal: '#0c120e' },
  { id: 'rose', name: 'Rose', accent: '#eb8eaa', background: '#1e171d', terminal: '#130e13' },
  { id: 'light', name: 'Cloud', accent: '#397e9d', background: '#edf2f5', terminal: '#15202a' },
]
const defaultHost = (): HostProfile => ({
  id: crypto.randomUUID(), label: '', hostname: '', port: '22', username: '', group: '', tags: '',
  authMethod: 'agent', keyPath: '', agentForwarding: false, startupCommand: '', jumpHost: '', proxy: '',
  environment: '', utf8: true, hostKeyPolicy: 'yes', connectTimeout: '15', keepAliveInterval: '30',
  keepAliveCount: '3', tunnels: [],
})
const menuItems: { id: Screen; label: string; icon: typeof Server }[] = [
  { id: 'hosts', label: 'Hosts', icon: Server },
  { id: 'keychain', label: 'Keychain', icon: KeyRound },
  { id: 'forwarding', label: 'Port forwarding', icon: ArrowLeftRight },
  { id: 'known-hosts', label: 'Known hosts', icon: Fingerprint },
  { id: 'logs', label: 'Logs', icon: Clock3 },
]
const isValidStoredHost = (value: unknown): value is HostProfile => Boolean(
  value && typeof value === 'object' &&
  'id' in value && typeof value.id === 'string' &&
  'label' in value && typeof value.label === 'string' &&
  'hostname' in value && typeof value.hostname === 'string' &&
  'port' in value && typeof value.port === 'string' &&
  'username' in value && typeof value.username === 'string' &&
  'group' in value && typeof value.group === 'string' &&
  'tags' in value && typeof value.tags === 'string' &&
  'authMethod' in value && (value.authMethod === 'agent' || value.authMethod === 'key' || value.authMethod === 'password') &&
  'keyPath' in value && typeof value.keyPath === 'string' &&
  'agentForwarding' in value && typeof value.agentForwarding === 'boolean' &&
  'startupCommand' in value && typeof value.startupCommand === 'string' &&
  'jumpHost' in value && typeof value.jumpHost === 'string' &&
  'proxy' in value && typeof value.proxy === 'string' &&
  'environment' in value && typeof value.environment === 'string' &&
  'utf8' in value && typeof value.utf8 === 'boolean' &&
  'hostKeyPolicy' in value && (value.hostKeyPolicy === 'yes' || value.hostKeyPolicy === 'accept-new') &&
  'connectTimeout' in value && typeof value.connectTimeout === 'string' &&
  'keepAliveInterval' in value && typeof value.keepAliveInterval === 'string' &&
  'keepAliveCount' in value && typeof value.keepAliveCount === 'string' &&
  'tunnels' in value && Array.isArray(value.tunnels) &&
  value.tunnels.every((tunnel) => Boolean(
    tunnel && typeof tunnel === 'object' &&
    'id' in tunnel && typeof tunnel.id === 'string' &&
    'type' in tunnel && (tunnel.type === 'local' || tunnel.type === 'remote' || tunnel.type === 'dynamic') &&
    'localPort' in tunnel && typeof tunnel.localPort === 'string' &&
    'host' in tunnel && typeof tunnel.host === 'string' &&
    'remotePort' in tunnel && typeof tunnel.remotePort === 'string',
  )),
)

function loadHosts(): HostProfile[] {
  const raw = localStorage.getItem('zero-trust-ssh-hosts')
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(isValidStoredHost)) return parsed
    console.error('Saved SSH host profiles have an unexpected format.')
  } catch (error) {
    console.error('Could not read saved SSH host profiles.', error)
  }
  return []
}

function loadPalette(): Palette {
  const stored = localStorage.getItem('zero-trust-ssh-palette')
  return palettes.some((palette) => palette.id === stored) ? stored as Palette : 'midnight'
}

function HostEditor({
  host, onChange, onConnect, onDelete, onClose, password, onPasswordChange, passwordSaved,
  passwordLoading, passwordBusy, onSavePassword, onForgetPassword, onSelectKey, connecting, groups,
}: {
  host: HostProfile
  onChange: (host: HostProfile) => void
  onConnect: () => void
  onDelete: () => void
  onClose: () => void
  password: string
  onPasswordChange: (password: string) => void
  passwordSaved: boolean
  passwordLoading: boolean
  passwordBusy: boolean
  onSavePassword: () => void
  onForgetPassword: () => void
  onSelectKey: () => void
  connecting: boolean
  groups: string[]
}) {
  const set = <K extends keyof HostProfile>(key: K, value: HostProfile[K]) => onChange({ ...host, [key]: value })
  const addTunnel = () => set('tunnels', [...host.tunnels, { id: crypto.randomUUID(), type: 'local', localPort: '', host: '127.0.0.1', remotePort: '' }])
  const updateTunnel = (id: string, patch: Partial<TunnelRule>) => set('tunnels', host.tunnels.map((tunnel) => tunnel.id === id ? { ...tunnel, ...patch } : tunnel))
  const removeTunnel = (id: string) => set('tunnels', host.tunnels.filter((tunnel) => tunnel.id !== id))
  const canConnect = host.hostname.trim().length > 0 && host.username.trim().length > 0 &&
    (host.authMethod !== 'password' || password.length > 0) &&
    (!window.zeroTrust || (!connecting && !passwordLoading && !passwordBusy))

  return <aside className="host-editor">
    <header className="inspector-header">
      <div><small>CONNECTION PROFILE</small><h2>{host.label || 'New host'}</h2></div>
      <div className="inspector-actions">
          <button className="quiet-icon" title="Remove profile" aria-label="Remove profile" onClick={onDelete}><Trash2 size={15} /></button>
          <button className="quiet-icon" title="Close details" aria-label="Close details" onClick={onClose}><X size={16} /></button>
      </div>
    </header>
    <div className="inspector-scroll">
      <section className="form-section">
        <div className="section-title"><span>General</span><MoreHorizontal size={16} /></div>
        <label className="field-label">Label<input value={host.label} onChange={(event) => set('label', event.target.value)} placeholder="Production · Web 01" /></label>
        <label className="field-label">Hostname or IP<input value={host.hostname} onChange={(event) => set('hostname', event.target.value)} placeholder="server.example.com" autoCapitalize="off" spellCheck={false} /></label>
        <div className="form-row">
          <label className="field-label">Group
            <select value={host.group} onChange={(event) => set('group', event.target.value)}>
              <option value="">None / Ungrouped</option>
              {groups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label className="field-label port-field">SSH port<input type="number" min="1" max="65535" value={host.port} onChange={(event) => set('port', event.target.value)} /></label>
        </div>
        <label className="field-label">Tags<input value={host.tags} onChange={(event) => set('tags', event.target.value)} placeholder="prod, linux" /></label>
      </section>

      <section className="form-section">
        <div className="section-title"><span>Credentials</span><LockKeyhole size={15} /></div>
        <label className="field-label">Username<input value={host.username} onChange={(event) => set('username', event.target.value)} placeholder="Your remote username" autoCapitalize="off" spellCheck={false} /></label>
        <label className="field-label">Authentication
          <select value={host.authMethod} onChange={(event) => set('authMethod', event.target.value as AuthMethod)}>
            <option value="agent">SSH agent / default identity</option>
            <option value="key">Private key</option>
            <option value="password">Password</option>
          </select>
        </label>
        {host.authMethod === 'key' && <div className="key-picker">
          <input value={host.keyPath} readOnly placeholder="Choose a private key…" />
          <button className="subtle-button" onClick={onSelectKey}>Browse</button>
        </div>}
        {host.authMethod === 'password' && <>
          <label className="field-label">Password <span className="inline-hint">{passwordLoading ? 'loading…' : passwordSaved ? 'saved securely' : 'not saved'}</span>
            <input type="password" autoComplete="current-password" value={password} disabled={passwordLoading} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Enter password" />
          </label>
          <div className="key-picker">
            <button className="subtle-button" disabled={!password || passwordLoading || passwordBusy || !window.zeroTrust} onClick={onSavePassword}>{passwordBusy ? 'Saving…' : 'Save password securely'}</button>
            {passwordSaved && <button className="subtle-button" disabled={passwordLoading || passwordBusy} onClick={onForgetPassword}>Forget</button>}
          </div>
          <p className="form-note">Saved passwords are encrypted with your operating system’s secure storage.</p>
        </>}
        <label className="toggle-row"><span><b>Agent forwarding</b><small>Forward your local SSH agent to the server</small></span><input type="checkbox" checked={host.agentForwarding} onChange={(event) => set('agentForwarding', event.target.checked)} /></label>
        <label className="field-label">Host key verification
          <select value={host.hostKeyPolicy} onChange={(event) => set('hostKeyPolicy', event.target.value as HostProfile['hostKeyPolicy'])}>
            <option value="yes">Require a known host key</option>
            <option value="accept-new">Trust new keys on first connect</option>
          </select>
        </label>
      </section>

      <section className="form-section">
        <div className="section-title"><span>Connection options</span><SlidersHorizontal size={15} /></div>
        <label className="field-label">Jump host <span className="inline-hint">SSH host or user@host</span>
          <input value={host.jumpHost} onChange={(event) => set('jumpHost', event.target.value)} placeholder="bastion.example.com" autoCapitalize="off" spellCheck={false} />
        </label>
        <label className="field-label">HTTP CONNECT proxy <span className="inline-hint">host[:port], not with jump host</span><input value={host.proxy} onChange={(event) => set('proxy', event.target.value)} placeholder="proxy.example.com:8080" autoCapitalize="off" spellCheck={false} /></label>
        <label className="field-label">Environment variables <span className="inline-hint">KEY=value, one per line</span>
          <textarea rows={2} value={host.environment} onChange={(event) => set('environment', event.target.value)} placeholder={'LANG=en_US.UTF-8'} spellCheck={false} />
        </label>
        <div className="form-row">
          <label className="field-label">Timeout (sec)<input type="number" min="1" max="120" value={host.connectTimeout} onChange={(event) => set('connectTimeout', event.target.value)} /></label>
          <label className="field-label">Keepalive (sec)<input type="number" min="0" max="300" value={host.keepAliveInterval} onChange={(event) => set('keepAliveInterval', event.target.value)} /></label>
        </div>
        <label className="field-label">Keepalive retries<input type="number" min="1" max="10" value={host.keepAliveCount} onChange={(event) => set('keepAliveCount', event.target.value)} /></label>
        <label className="toggle-row"><span><b>UTF-8 terminal</b><small>Request UTF-8 locale support from the server</small></span><input type="checkbox" checked={host.utf8} onChange={(event) => set('utf8', event.target.checked)} /></label>
        <label className="field-label">Startup command <textarea rows={2} value={host.startupCommand} onChange={(event) => set('startupCommand', event.target.value)} placeholder="Optional command to run after login" spellCheck={false} /></label>
      </section>

      <section className="form-section">
        <div className="section-title"><span>Port forwarding</span><button className="add-inline" onClick={addTunnel}><Plus size={13} /> Add rule</button></div>
        {!host.tunnels.length && <p className="form-note">Forward ports through this SSH connection.</p>}
        {host.tunnels.map((tunnel) => <div className="tunnel-row" key={tunnel.id}>
          <select aria-label="Forwarding type" value={tunnel.type} onChange={(event) => updateTunnel(tunnel.id, { type: event.target.value as TunnelRule['type'] })}>
            <option value="local">Local</option><option value="remote">Remote</option><option value="dynamic">Dynamic</option>
          </select>
          <input aria-label="Local or dynamic port" type="number" min="1" max="65535" placeholder="Local port" value={tunnel.localPort} onChange={(event) => updateTunnel(tunnel.id, { localPort: event.target.value })} />
          {tunnel.type !== 'dynamic' && <>
            <input aria-label="Destination host" placeholder="127.0.0.1" value={tunnel.host} onChange={(event) => updateTunnel(tunnel.id, { host: event.target.value })} />
            <input aria-label="Destination port" type="number" min="1" max="65535" placeholder="Port" value={tunnel.remotePort} onChange={(event) => updateTunnel(tunnel.id, { remotePort: event.target.value })} />
          </>}
          <button className="quiet-icon" title="Remove forwarding rule" aria-label="Remove forwarding rule" onClick={() => removeTunnel(tunnel.id)}><X size={14} /></button>
        </div>)}
      </section>
    </div>
    <footer className="inspector-footer">
      <button className="connect-button" disabled={!canConnect} onClick={onConnect}><SquareTerminal size={16} />{connecting ? 'Connecting…' : 'Connect over SSH'}<ArrowRight size={15} /></button>
      <p>Uses your Mac’s OpenSSH client and known_hosts file.</p>
    </footer>
  </aside>
}

function TerminalPane({
  sessionId, output, palette, startupCommand, onInput, onClose, onRunStartup,
}: {
  sessionId: string
  output: string
  palette: PaletteOption
  startupCommand: string
  onInput: (data: string) => void
  onClose: () => void
  onRunStartup: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const lastOutput = useRef('')
  const onInputRef = useRef(onInput)
  useEffect(() => { onInputRef.current = onInput }, [onInput])

  useEffect(() => {
    if (!hostRef.current) return
    const fit = new FitAddon()
    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      fontFamily: '"SF Mono", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.35,
      scrollback: 3000,
      theme: {
        background: palette.terminal,
        foreground: '#dce4e8',
        cursor: palette.accent,
        selectionBackground: `${palette.accent}55`,
        black: '#10151a', red: '#e27678', green: '#79c995', yellow: '#e6c47b',
        blue: '#77aee6', magenta: '#bd9be0', cyan: '#73c7cd', white: '#d3dde2',
        brightBlack: '#66727b', brightRed: '#f18d8f', brightGreen: '#99dcae',
        brightYellow: '#f2d394', brightBlue: '#90c0f1', brightMagenta: '#d0afea',
        brightCyan: '#8bd8dc', brightWhite: '#f5f7f8',
      },
    })
    term.loadAddon(fit)
    term.open(hostRef.current)
    fit.fit()
    term.focus()
    const inputListener = term.onData((data) => onInputRef.current(data))
    const resizeListener = term.onResize(({ cols, rows }) => {
      void window.zeroTrust?.resizeSession(sessionId, cols, rows)
        .catch((error: unknown) => console.error('Could not resize the SSH terminal.', error))
    })
    const resizeObserver = new ResizeObserver(() => fit.fit())
    resizeObserver.observe(hostRef.current)
    termRef.current = term
    return () => {
      inputListener.dispose()
      resizeListener.dispose()
      resizeObserver.disconnect()
      term.dispose()
      termRef.current = null
      lastOutput.current = ''
    }
  }, [sessionId, palette])

  useEffect(() => {
    const term = termRef.current
    if (!term || output === lastOutput.current) return
    if (output.startsWith(lastOutput.current)) term.write(output.slice(lastOutput.current.length))
    else { term.clear(); term.write(output) }
    lastOutput.current = output
  }, [output])

  return <div className="terminal-screen">
    <header className="terminal-toolbar">
      <div className="terminal-title"><span className="connection-pulse" />SSH SESSION <b>LIVE</b></div>
      <div className="terminal-actions"><span>OpenSSH</span>{startupCommand && <button className="text-button" onClick={onRunStartup}>Run startup command</button>}<button className="quiet-icon" title="Disconnect" aria-label="Disconnect" onClick={onClose}><X size={16} /></button></div>
    </header>
    <div className="terminal-canvas" ref={hostRef} />
    <footer className="terminal-status"><span><span className="connection-pulse" /> Encrypted SSH connection</span><span>UTF-8</span><span>SSH-2</span></footer>
  </div>
}

function App() {
  const [hosts, setHosts] = useState<HostProfile[]>(loadHosts)
  const [groups, setGroups] = useState<string[]>(() => {
    const stored = localStorage.getItem('zero-trust-ssh-groups')
    return stored ? JSON.parse(stored) : []
  })
  const [showNewHostMenu, setShowNewHostMenu] = useState(false)
  const [showNewGroupModal, setShowNewGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('hosts')
  const [paletteId, setPaletteId] = useState<Palette>(loadPalette)
  const [customAccent, setCustomAccent] = useState(() => {
    const stored = localStorage.getItem('zero-trust-ssh-custom-accent')
    return stored && /^#[\da-f]{6}$/i.test(stored) ? stored : null
  })
  const [query, setQuery] = useState('')
  const [sessions, setSessions] = useState<{ id: string; hostId: string; title: string }[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<Record<string, string>>({})
  const [connectionStatus, setConnectionStatus] = useState('Ready for a secure connection')
  const [connecting, setConnecting] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [logEntries, setLogEntries] = useState<string[]>([])
  const [knownHost, setKnownHost] = useState('')
  const [knownHostResult, setKnownHostResult] = useState<string | null>(null)
  const [sshKeys, setSshKeys] = useState<{ name: string; path: string }[]>([])
  const basePalette = palettes.find((item) => item.id === paletteId) ?? palettes[0]
  const palette = useMemo(() => customAccent ? { ...basePalette, accent: customAccent } : basePalette, [basePalette, customAccent])
  const selectedHost = hosts.find((host) => host.id === selectedHostId) ?? null
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null
  const terminalHost = activeSession ? hosts.find((host) => host.id === activeSession.hostId) : null
  const filteredHosts = hosts.filter((host) => `${host.label} ${host.hostname} ${host.username} ${host.group} ${host.tags}`.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    try { localStorage.setItem('zero-trust-ssh-hosts', JSON.stringify(hosts)) }
    catch (error) { console.error('Could not save SSH host profiles.', error) }
  }, [hosts])
  useEffect(() => {
    let active = true
    if (screen !== 'hosts' || !selectedHostId || !window.zeroTrust) {
      setPassword('')
      setPasswordSaved(false)
      setPasswordLoading(false)
      return () => { active = false }
    }
    setPassword('')
    setPasswordSaved(false)
    setPasswordLoading(true)
    void window.zeroTrust.getSavedPassword(selectedHostId)
      .then((savedPassword) => {
        if (!active) return
        setPassword(savedPassword ?? '')
        setPasswordSaved(savedPassword !== null)
      })
      .catch((error: unknown) => {
        if (!active) return
        setConnectionStatus(error instanceof Error ? error.message : 'Could not load the saved SSH password')
      })
      .finally(() => {
        if (active) setPasswordLoading(false)
      })
    return () => { active = false }
  }, [screen, selectedHostId])
  useEffect(() => {
    localStorage.setItem('zero-trust-ssh-palette', paletteId)
    document.documentElement.dataset.palette = paletteId
    document.documentElement.style.setProperty('--accent', palette.accent)
    document.documentElement.style.setProperty('--app-bg', palette.background)
    document.documentElement.style.setProperty('--terminal-bg', palette.terminal)
  }, [palette, paletteId])

  useEffect(() => {
    if (!window.zeroTrust) return
    const removeData = window.zeroTrust.onSshData((id, data) => {
      setOutputs((previous) => {
        const next = (previous[id] ?? '') + data
        return { ...previous, [id]: next.length > 500_000 ? next.slice(-400_000) : next }
      })
    })
    const removeExit = window.zeroTrust.onSshExit((id, result) => {
      removeSession(id)
      const message = result.error || (result.code === 0 ? 'SSH session closed' : `SSH disconnected · exit ${result.code ?? result.signal ?? 'unknown'}`)
      setConnectionStatus(message)
      setLogEntries((items) => [`${new Date().toLocaleTimeString()} · ${message}`, ...items].slice(0, 100))
    })
    return () => { removeData(); removeExit() }
  }, [])

  useEffect(() => {
    if (!window.zeroTrust) return
    void window.zeroTrust.listKeys().then(setSshKeys).catch((error: unknown) => console.error('Could not list SSH keys.', error))
  }, [screen])

  function addHost(groupName?: string) {
    const host = defaultHost()
    if (groupName) host.group = groupName
    setHosts((items) => [...items, host])
    setSelectedHostId(host.id)
    setScreen('hosts')
    setPassword('')
    setShowNewHostMenu(false)
  }

  function confirmNewGroup() {
    const groupName = newGroupName.trim()
    if (groupName && !groups.includes(groupName)) {
      const newGroups = [...groups, groupName]
      setGroups(newGroups)
      localStorage.setItem('zero-trust-ssh-groups', JSON.stringify(newGroups))
      addHost(groupName)
      setShowNewGroupModal(false)
      setNewGroupName('')
    }
  }

  useEffect(() => window.zeroTrust?.onMenuAction((action) => {
    if (action === 'new-host') addHost()
    else if (action === 'appearance') setScreen('settings')
  }), [])
  function updateHost(next: HostProfile) {
    setHosts((items) => items.map((host) => host.id === next.id ? next : host))
  }
  function deleteHost() {
    if (!selectedHost) return
    if (!window.confirm(`Remove ${selectedHost.label || selectedHost.hostname || 'this SSH host'}?`)) return
    void (async () => {
      try {
        await window.zeroTrust?.deleteSavedPassword(selectedHost.id)
        setHosts((items) => items.filter((host) => host.id !== selectedHost.id))
        setSelectedHostId(null)
      } catch (error) {
        setConnectionStatus(error instanceof Error ? error.message : 'Could not remove the saved SSH password')
      }
    })()
  }
  async function savePassword() {
    if (!selectedHost || !window.zeroTrust || !password) return
    setPasswordBusy(true)
    try {
      await window.zeroTrust.savePassword(selectedHost.id, password)
      setPasswordSaved(true)
      setConnectionStatus('Password saved securely for this host')
    } catch (error) {
      setConnectionStatus(error instanceof Error ? error.message : 'Could not save the SSH password securely')
    } finally {
      setPasswordBusy(false)
    }
  }
  async function forgetPassword() {
    if (!selectedHost || !window.zeroTrust) return
    setPasswordBusy(true)
    try {
      await window.zeroTrust.deleteSavedPassword(selectedHost.id)
      setPassword('')
      setPasswordSaved(false)
      setConnectionStatus('Saved password removed')
    } catch (error) {
      setConnectionStatus(error instanceof Error ? error.message : 'Could not remove the saved SSH password')
    } finally {
      setPasswordBusy(false)
    }
  }
  async function selectKey() {
    if (!window.zeroTrust || !selectedHost) {
      setConnectionStatus('Open the desktop app to choose a private key')
      return
    }
    try {
      const keyPath = await window.zeroTrust.selectKey()
      if (keyPath) updateHost({ ...selectedHost, keyPath })
    } catch (error) {
      setConnectionStatus(error instanceof Error ? error.message : 'Could not select private key')
    }
  }
  function removeSession(id: string) {
    setOutputs((previous) => {
      const { [id]: _removed, ...rest } = previous
      return rest
    })
    setSessions((items) => {
      const index = items.findIndex((session) => session.id === id)
      if (index < 0) return items
      const remaining = items.filter((session) => session.id !== id)
      setActiveSessionId((current) => current !== id ? current : (remaining[Math.min(index, remaining.length - 1)]?.id ?? null))
      if (!remaining.length) setScreen((current) => current === 'terminal' ? 'hosts' : current)
      return remaining
    })
  }
  async function connect() {
    if (!selectedHost) return
    if (!window.zeroTrust) {
      setConnectionStatus('SSH connections are available in the ZERO Trust desktop app')
      return
    }
    setConnecting(true)
    setConnectionStatus(`Connecting to ${selectedHost.hostname}…`)
    try {
      const id = await window.zeroTrust.connect(selectedHost, selectedHost.authMethod === 'password' ? password : undefined)
      setSessions((items) => [...items, { id, hostId: selectedHost.id, title: selectedHost.label || selectedHost.hostname }])
      setActiveSessionId(id)
      setScreen('terminal')
      setConnectionStatus(`Connected to ${selectedHost.hostname}`)
      setLogEntries((items) => [`${new Date().toLocaleTimeString()} · Connected · ${selectedHost.username}@${selectedHost.hostname}`, ...items].slice(0, 100))
      setPassword('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start SSH'
      setConnectionStatus(message)
      setLogEntries((items) => [`${new Date().toLocaleTimeString()} · ${message}`, ...items].slice(0, 100))
    } finally {
      setConnecting(false)
    }
  }
  async function disconnect(id: string) {
    if (!window.zeroTrust) return
    try { await window.zeroTrust.closeSession(id) }
    catch (error) { setConnectionStatus(error instanceof Error ? error.message : 'Could not close the SSH session') }
    removeSession(id)
  }
  async function inspectKnownHost() {
    if (!window.zeroTrust) return setKnownHostResult('Known-host lookup is available in the desktop app.')
    setKnownHostResult('Checking your local OpenSSH known_hosts…')
    try { setKnownHostResult(await window.zeroTrust.lookupKnownHost(knownHost)) }
    catch (error) { setKnownHostResult(error instanceof Error ? error.message : 'Could not check known hosts') }
  }
  function updatePaletteColor(nextColor: string) {
    setCustomAccent(nextColor)
    document.documentElement.style.setProperty('--accent', nextColor)
    localStorage.setItem('zero-trust-ssh-custom-accent', nextColor)
  }

  return <main className="app-shell" style={{ '--accent': palette.accent, '--app-bg': palette.background, '--terminal-bg': palette.terminal } as CSSProperties}>
    <header className="titlebar">
      <div className="top-tabs">
        <button className={`top-tab ${screen !== 'terminal' ? 'active' : ''}`} onClick={() => setScreen('hosts')}><ShieldCheck size={14} /> <span>ZERO TRUST</span></button>
        {sessions.map((session) => <span key={session.id} className={`top-tab session-tab ${screen === 'terminal' && session.id === activeSessionId ? 'active' : ''}`}>
          <button className="session-tab-label" onClick={() => { setActiveSessionId(session.id); setScreen('terminal') }}><TerminalSquare size={14} />{session.title || 'SSH session'}</button>
          <button className="session-tab-close" title="Disconnect" aria-label={`Disconnect ${session.title}`} onClick={() => void disconnect(session.id)}><X size={12} /></button>
        </span>)}
        <button className="new-tab-button" onClick={() => addHost()} title="Add host" aria-label="Add host"><Plus size={17} /></button>
      </div>
      <div className="titlebar-right"><span className="secure-label"><span className="connection-pulse" /> LOCAL &amp; ENCRYPTED</span><button className="quiet-icon" title="Notifications" aria-label="Notifications"><Bell size={15} /></button></div>
    </header>

    <div className="workspace">
      <nav className="sidebar">
        <div className="sidebar-brand"><div className="logo-mark"><ShieldCheck size={17} /></div><div><b>ZERO</b><span>TRUST SSH CLIENT</span></div></div>
        <div className="nav-caption">CONNECTIONS</div>
        <div className="nav-list">{menuItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${screen === id ? 'selected' : ''}`} onClick={() => setScreen(id)}><Icon size={16} strokeWidth={1.8} /><span>{label}</span>{id === 'hosts' && hosts.length > 0 && <small>{hosts.length}</small>}</button>)}</div>
        <div className="sidebar-bottom">
          <div className="sidebar-secure"><ShieldCheck size={15} /><span>Connections use<br />system OpenSSH</span></div>
          <button className={`nav-item ${screen === 'settings' ? 'selected' : ''}`} onClick={() => setScreen('settings')}><Settings2 size={16} /><span>Appearance</span></button>
          <div className="user-badge"><div className="user-avatar">Z</div><div><b>Local workspace</b><span>Mac · SSH ready</span></div><MoreHorizontal size={16} /></div>
        </div>
      </nav>

      <section className="main-area">
        <header className="main-toolbar">
          <div className="breadcrumb"><span>{screen === 'hosts' ? 'Connections' : screen.replace('-', ' ')}</span><ChevronRight size={14} /><b>{screen === 'hosts' ? 'Hosts' : screen === 'known-hosts' ? 'Known hosts' : screen === 'forwarding' ? 'Port forwarding' : screen === 'keychain' ? 'Keychain' : screen === 'logs' ? 'Connection logs' : screen === 'settings' ? 'Appearance' : 'Terminal'}</b></div>
          <div className="toolbar-actions">
            <button className="quiet-icon" title="Search hosts" onClick={() => document.getElementById('host-search')?.focus()}><Search size={16} /></button>
            <button className="quiet-icon" title="Command palette"><Command size={15} /></button>
            <button className="toolbar-avatar">Z</button>
          </div>
        </header>

        {screen === 'hosts' && <div className="hosts-workspace">
          <div className="hosts-column">
            <div className="quick-connect"><Search size={17} /><input id="host-search" placeholder='Quick connect: ssh user@hostname -p port' value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') {
                const match = query.trim().match(/^(?:ssh\s+)?([A-Za-z0-9._-]+)@([A-Za-z0-9.:[\]-]+)(?:\s+-p\s+(\d{1,5}))?$/)
                if (!match || (match[3] && (Number(match[3]) < 1 || Number(match[3]) > 65535))) {
                  setConnectionStatus('Use ssh user@hostname with an optional -p port')
                  return
                }
                const host = { ...defaultHost(), username: match[1], hostname: match[2], port: match[3] ?? '22', label: match[2] }
                setHosts((items) => [...items, host])
                setSelectedHostId(host.id)
                setQuery('')
              }
            }} /><kbd>↵</kbd></div>
            <div className="hosts-subtoolbar">
              <div style={{ position: 'relative' }}>
                <button className="primary-small" onClick={() => setShowNewHostMenu(!showNewHostMenu)}><Plus size={15} /> New host <ChevronDown size={13} style={{ marginLeft: '4px' }} /></button>
                {showNewHostMenu && <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: 'var(--app-bg)', border: '1px solid var(--accent)', borderRadius: '6px', zIndex: 1000, minWidth: '180px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                  <button type="button" style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'inherit' }} onClick={() => { addHost(); setShowNewHostMenu(false) }}><Plus size={13} /> New host</button>
                  <div style={{ borderTop: '1px solid var(--accent)' }} />
                  <button type="button" style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--accent)' }} onClick={() => { setShowNewGroupModal(true); setShowNewHostMenu(false) }}><Plus size={13} /> New group</button>
                  {groups.length > 0 && <>
                    <div style={{ borderTop: '1px solid var(--accent)' }} />
                    {groups.map((group) => <button type="button" key={group} style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'inherit' }} onClick={() => { addHost(group); setShowNewHostMenu(false) }}><Plus size={13} /> {group}</button>)}
                  </>}
                </div>}
              </div>
              <div className="toolbar-divider" />
              <button className="view-toggle active"><Server size={15} /> Hosts</button>
              <button className="view-toggle" onClick={() => setScreen('terminal')}><SquareTerminal size={15} /> Terminal</button>
              <div className="toolbar-spacer" />
              <button className="quiet-icon" title="Host options"><MoreHorizontal size={17} /></button>
            </div>
            <div className="hosts-list-header"><div><h1>Hosts</h1><p>Your SSH connections, saved on this Mac.</p></div><span className="host-count">{hosts.length} {hosts.length === 1 ? 'HOST' : 'HOSTS'}</span></div>
            <div className="host-list">
              {groups.length > 0 ? <>
                {groups.map((group) => {
                  const groupHosts = filteredHosts.filter((h) => h.group === group)
                  if (!groupHosts.length) return null
                  return <div key={group} style={{ marginBottom: '12px' }}>
                    <div style={{ padding: '0 12px 8px', fontSize: '12px', fontWeight: '600', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{group}</div>
                    {groupHosts.map((host) => <button className={`host-card ${host.id === selectedHostId ? 'active' : ''}`} key={host.id} onClick={() => { if (host.id !== selectedHostId) { setSelectedHostId(host.id); setPassword('') } }} onDoubleClick={() => { if (host.id === selectedHostId) { setSelectedHostId(host.id); setTimeout(() => { void connect() }, 0) } }} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && host.id === selectedHostId) { e.preventDefault(); void connect() } }}>
                      <div className="host-card-icon"><Server size={18} /></div>
                      <div className="host-card-copy"><b>{host.label || host.hostname || 'Untitled host'}</b><span>{host.username || 'user'}@{host.hostname || 'hostname'} <i>·</i> {host.port || 22}</span>
                        {host.tags && <div className="host-tags">{host.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 3).map((tag) => <small key={tag}><Tag size={10} />{tag}</small>)}</div>}
                      </div>
                      <div className="host-card-meta">{host.id === selectedHostId && <span className="selected-indicator" />}<ChevronRight size={15} /></div>
                    </button>)}
                  </div>
                })}
                {filteredHosts.filter((h) => !h.group).length > 0 && <>
                  <div style={{ padding: '0 12px 8px 12px', fontSize: '12px', fontWeight: '600', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Others</div>
                  {filteredHosts.filter((h) => !h.group).map((host) => <button className={`host-card ${host.id === selectedHostId ? 'active' : ''}`} key={host.id} onClick={() => { if (host.id !== selectedHostId) { setSelectedHostId(host.id); setPassword('') } }} onDoubleClick={() => { if (host.id === selectedHostId) { setSelectedHostId(host.id); setTimeout(() => { void connect() }, 0) } }} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && host.id === selectedHostId) { e.preventDefault(); void connect() } }}>
                    <div className="host-card-icon"><Server size={18} /></div>
                    <div className="host-card-copy"><b>{host.label || host.hostname || 'Untitled host'}</b><span>{host.username || 'user'}@{host.hostname || 'hostname'} <i>·</i> {host.port || 22}</span>
                      {host.tags && <div className="host-tags">{host.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 3).map((tag) => <small key={tag}><Tag size={10} />{tag}</small>)}</div>}
                    </div>
                    <div className="host-card-meta">{host.id === selectedHostId && <span className="selected-indicator" />}<ChevronRight size={15} /></div>
                  </button>)}
                </>}
              </> : filteredHosts.map((host) => <button className={`host-card ${host.id === selectedHostId ? 'active' : ''}`} key={host.id} onClick={() => { if (host.id !== selectedHostId) { setSelectedHostId(host.id); setPassword('') } }} onDoubleClick={() => { if (host.id === selectedHostId) { setSelectedHostId(host.id); setTimeout(() => { void connect() }, 0) } }} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && host.id === selectedHostId) { e.preventDefault(); void connect() } }}>
                <div className="host-card-icon"><Server size={18} /></div>
                <div className="host-card-copy"><b>{host.label || host.hostname || 'Untitled host'}</b><span>{host.username || 'user'}@{host.hostname || 'hostname'} <i>·</i> {host.port || 22}</span>
                  {host.tags && <div className="host-tags">{host.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 3).map((tag) => <small key={tag}><Tag size={10} />{tag}</small>)}</div>}
                </div>
                <div className="host-card-meta">{host.id === selectedHostId && <span className="selected-indicator" />}<ChevronRight size={15} /></div>
              </button>)}
              {!filteredHosts.length && <div className="empty-hosts"><div className="empty-icon"><ShieldCheck size={23} /></div><h2>{hosts.length ? 'No matching hosts' : 'Your connections start here'}</h2><p>{hosts.length ? 'Try another search.' : 'Add an SSH host to securely connect to your servers.'}</p>{!hosts.length && <button className="primary-small" onClick={() => addHost()}><Plus size={15} /> Add your first host</button>}</div>}
            </div>
            <footer className="host-status"><span className="connection-pulse" />{connectionStatus}<span className="status-right-label"><ShieldCheck size={12} /> SSH-2</span></footer>
          </div>
          {selectedHost && <HostEditor
            host={selectedHost} onChange={updateHost} onConnect={() => void connect()} onDelete={deleteHost} onClose={() => setSelectedHostId(null)}
            password={password} passwordSaved={passwordSaved} passwordLoading={passwordLoading} passwordBusy={passwordBusy}
            onSavePassword={() => void savePassword()} onForgetPassword={() => void forgetPassword()}
            onPasswordChange={setPassword} onSelectKey={() => void selectKey()} connecting={connecting} groups={groups}
          />}
        </div>}

        {screen === 'terminal' && <div className="content-page terminal-page">
          {activeSession ? <TerminalPane key={activeSession.id} sessionId={activeSession.id} output={outputs[activeSession.id] ?? ''} palette={palette} startupCommand={terminalHost?.startupCommand ?? ''} onInput={(data) => { void window.zeroTrust?.sendInput(activeSession.id, data) }} onClose={() => void disconnect(activeSession.id)} onRunStartup={() => {
            if (terminalHost?.startupCommand.trim() && window.confirm(`Run this command on ${terminalHost.hostname}?\n\n${terminalHost.startupCommand}`)) {
              void window.zeroTrust?.sendInput(activeSession.id, `${terminalHost.startupCommand.trim()}\r`)
            }
          }} /> :
            <div className="page-empty"><div className="empty-icon"><TerminalSquare size={22} /></div><h2>No active SSH session</h2><p>Choose a saved host to open a terminal.</p><button className="primary-small" onClick={() => setScreen('hosts')}>Browse hosts <ArrowRight size={14} /></button></div>}
        </div>}

        {screen === 'keychain' && <div className="content-page">
          <div className="page-heading"><div><span className="eyebrow">SSH IDENTITIES</span><h1>Keychain</h1><p>Choose an identity file stored in your local ~/.ssh directory.</p></div><button className="primary-small" onClick={() => { if (selectedHost) void selectKey(); else setScreen('hosts') }}><Plus size={15} /> Add identity</button></div>
          <div className="resource-list">{sshKeys.map((key) => <div className="resource-row" key={key.path}><div className="resource-icon"><KeyRound size={17} /></div><div><b>{key.name}</b><span>{key.path}</span></div><button className="quiet-icon" title="Select key for current host" aria-label="Select key for current host" onClick={() => { if (selectedHost) updateHost({ ...selectedHost, keyPath: key.path, authMethod: 'key' }); else setScreen('hosts') }}><ArrowRight size={15} /></button></div>)}{!sshKeys.length && <p className="form-note">No identities found yet. Add a private key under ~/.ssh to use key-based authentication.</p>}</div>
          <div className="security-note"><ShieldCheck size={17} /><span><b>Private keys stay on your Mac.</b><br />ZERO Trust uses OpenSSH and never uploads or copies key contents.</span></div>
        </div>}

        {screen === 'forwarding' && <div className="content-page">
          <div className="page-heading"><div><span className="eyebrow">TUNNELS</span><h1>Port forwarding</h1><p>Manage local, remote, and dynamic forwarding rules on your SSH hosts.</p></div><button className="primary-small" onClick={() => { if (!hosts.length) addHost(); else { setSelectedHostId(hosts[0].id); setScreen('hosts') } }}><Plus size={15} /> Add rule</button></div>
          <div className="resource-list">{hosts.flatMap((host) => host.tunnels.map((tunnel) => <div className="resource-row" key={`${host.id}-${tunnel.id}`}><div className="resource-icon"><ArrowLeftRight size={17} /></div><div><b>{tunnel.type.toUpperCase()} · {tunnel.localPort || '—'}{tunnel.type !== 'dynamic' && ` → ${tunnel.host}:${tunnel.remotePort}`}</b><span>{host.label || host.hostname} · {host.username}@{host.hostname}</span></div><button className="text-button" onClick={() => { setSelectedHostId(host.id); setScreen('hosts') }}>Edit host</button></div>))}{!hosts.some((host) => host.tunnels.length) && <div className="page-empty compact"><ArrowDownToLine size={22} /><h2>No forwarding rules</h2><p>Add local, remote, or SOCKS forwarding in a host profile.</p></div>}</div>
        </div>}

        {screen === 'known-hosts' && <div className="content-page">
          <div className="page-heading"><div><span className="eyebrow">HOST VERIFICATION</span><h1>Known hosts</h1><p>Check whether a server fingerprint is already trusted by OpenSSH.</p></div><div className="known-hosts-badge"><ShieldCheck size={14} /> Strict by default</div></div>
          <div className="lookup-card"><label className="field-label">Hostname<input value={knownHost} onChange={(event) => { setKnownHost(event.target.value); setKnownHostResult(null) }} placeholder="server.example.com" autoCapitalize="off" spellCheck={false} /></label><button className="primary-small" disabled={!knownHost.trim()} onClick={() => void inspectKnownHost()}><Search size={14} /> Check fingerprint</button></div>
          {knownHostResult && <div className="lookup-result"><Fingerprint size={16} /><span>{knownHostResult}</span></div>}
          <div className="security-note"><LockKeyhole size={17} /><span><b>Host key checking is enabled.</b><br />Unknown keys are rejected by default. You can choose “Trust new keys on first connect” for a saved host.</span></div>
        </div>}

        {screen === 'logs' && <div className="content-page">
          <div className="page-heading"><div><span className="eyebrow">LOCAL ACTIVITY</span><h1>Connection logs</h1><p>Session status only. Terminal output and credentials are not recorded.</p></div><button className="text-button" onClick={() => setLogEntries([])}>Clear history</button></div>
          <div className="resource-list">{logEntries.map((entry, index) => <div className="resource-row" key={`${entry}-${index}`}><div className="resource-icon"><Clock3 size={16} /></div><div><b>{entry.split(' · ').slice(1).join(' · ')}</b><span>{entry.split(' · ')[0]}</span></div></div>)}{!logEntries.length && <p className="form-note">Your connection events will appear here. No shell data is retained.</p>}</div>
        </div>}

        {screen === 'settings' && <div className="content-page">
          <div className="page-heading"><div><span className="eyebrow">PERSONALIZE YOUR WORKSPACE</span><h1>Appearance</h1><p>Choose the interface and terminal color palette you prefer.</p></div></div>
          <section className="settings-card"><div className="settings-section-head"><div><b>Color themes</b><small>Applies to the app chrome and new terminal sessions.</small></div><Monitor size={17} /></div>
            <div className="palette-grid">{palettes.map((item) => <button key={item.id} className={`palette-option ${paletteId === item.id ? 'chosen' : ''}`} onClick={() => { setCustomAccent(null); localStorage.removeItem('zero-trust-ssh-custom-accent'); setPaletteId(item.id) }}>
              <span className="palette-preview" style={{ background: item.background, borderColor: `${item.accent}55` }}><i style={{ background: item.accent }} /><i /><i /><b style={{ color: item.accent }}>▰ ▰ ▰</b></span><span>{item.name}</span>{paletteId === item.id && <Check size={14} />}
            </button>)}</div>
            <label className="accent-picker"><span><b>Custom accent</b><small>Choose the highlight color used across the app.</small></span><input type="color" value={palette.accent} onChange={(event) => updatePaletteColor(event.target.value)} /></label>
          </section>
          <section className="settings-card"><div className="settings-section-head"><div><b>Secure defaults</b><small>ZERO Trust connects directly through the system OpenSSH client.</small></div><ShieldCheck size={17} /></div>
            <div className="settings-line"><span>Host-key verification</span><b>Required</b></div><div className="settings-line"><span>Password storage</span><b>Never saved</b></div><div className="settings-line"><span>SSH profile storage</span><b>This Mac only</b></div>
          </section>
        </div>}
      </section>

      {showNewGroupModal && <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowNewGroupModal(false)}>
        <div style={{ backgroundColor: 'var(--app-bg)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '24px', maxWidth: '400px', minWidth: '300px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'inherit' }}>Create a new group</h3>
          <p style={{ marginBottom: '16px', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Give your group a name (e.g., Client A, Production, Staging)</p>
          <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmNewGroup() }} placeholder="Group name" style={{ width: '100%', padding: '8px 12px', marginBottom: '16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--accent)', borderRadius: '6px', color: 'inherit', fontSize: '14px', boxSizing: 'border-box' }} autoFocus />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowNewGroupModal(false); setNewGroupName('') }} style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: 'inherit', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            <button onClick={confirmNewGroup} disabled={!newGroupName.trim()} style={{ padding: '8px 16px', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#000', cursor: newGroupName.trim() ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '600', opacity: newGroupName.trim() ? 1 : 0.5 }}>Create group</button>
          </div>
        </div>
      </div>}
    </div>
  </main>
}

export default App
