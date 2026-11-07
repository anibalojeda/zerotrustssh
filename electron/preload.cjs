const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('zeroTrust', {
  onMenuAction: (callback) => {
    const handler = (_event, action) => callback(action)
    ipcRenderer.on('menu:action', handler)
    return () => ipcRenderer.removeListener('menu:action', handler)
  },
  connect: (profile, password) => ipcRenderer.invoke('ssh:connect', profile, password),
  sendInput: (sessionId, data) => ipcRenderer.invoke('ssh:input', sessionId, data),
  resizeSession: (sessionId, columns, rows) => ipcRenderer.invoke('ssh:resize', sessionId, columns, rows),
  closeSession: (sessionId) => ipcRenderer.invoke('ssh:close', sessionId),
  getSavedPassword: (profileId) => ipcRenderer.invoke('ssh:password:get', profileId),
  savePassword: (profileId, password) => ipcRenderer.invoke('ssh:password:save', profileId, password),
  deleteSavedPassword: (profileId) => ipcRenderer.invoke('ssh:password:delete', profileId),
  selectKey: () => ipcRenderer.invoke('ssh:select-key'),
  listKeys: () => ipcRenderer.invoke('ssh:list-keys'),
  lookupKnownHost: (hostname) => ipcRenderer.invoke('ssh:known-host', hostname),
  onSshData: (callback) => {
    const handler = (_event, sessionId, data) => callback(sessionId, data)
    ipcRenderer.on('ssh:data', handler)
    return () => ipcRenderer.removeListener('ssh:data', handler)
  },
  onSshExit: (callback) => {
    const handler = (_event, sessionId, result) => callback(sessionId, result)
    ipcRenderer.on('ssh:exit', handler)
    return () => ipcRenderer.removeListener('ssh:exit', handler)
  },
})