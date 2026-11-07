export {}

type ZeroTrustTunnelRule = {
  id: string
  type: 'local' | 'remote' | 'dynamic'
  localPort: string
  host: string
  remotePort: string
}

type ZeroTrustHostProfile = {
  id: string
  label: string
  hostname: string
  port: string
  username: string
  group: string
  tags: string
  authMethod: 'agent' | 'key' | 'password'
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
  tunnels: ZeroTrustTunnelRule[]
}

declare global {
  interface Window {
    zeroTrust?: {
      onMenuAction(callback: (action: 'new-host' | 'appearance') => void): () => void
      connect(profile: ZeroTrustHostProfile, password?: string): Promise<string>
      sendInput(sessionId: string, data: string): Promise<void>
      resizeSession(sessionId: string, columns: number, rows: number): Promise<void>
      closeSession(sessionId: string): Promise<void>
      getSavedPassword(profileId: string): Promise<string | null>
      savePassword(profileId: string, password: string): Promise<boolean>
      deleteSavedPassword(profileId: string): Promise<boolean>
      selectKey(): Promise<string | null>
      listKeys(): Promise<{ name: string; path: string }[]>
      lookupKnownHost(hostname: string): Promise<string>
      onSshData(callback: (sessionId: string, data: string) => void): () => void
      onSshExit(callback: (sessionId: string, result: { code: number | null; signal: string | null; error: string | null }) => void): () => void
    }
  }
}