const fs = require('node:fs')
const path = require('node:path')
const ResEdit = require('resedit')

// electron-builder cannot edit exe resources when cross-packaging from macOS without Wine.
module.exports = async function setWindowsIcon(context) {
  if (context.electronPlatformName !== 'win32') return
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, '../build/icon.ico')))
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath))
  const resources = ResEdit.NtExecutableResource.from(exe)
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries)
  const groupId = groups[0]?.id ?? 1
  const language = groups[0]?.lang ?? 1033
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    resources.entries, groupId, language, iconFile.icons.map((item) => item.data),
  )
  resources.outputResource(exe)
  fs.writeFileSync(exePath, Buffer.from(exe.generate()))
}
