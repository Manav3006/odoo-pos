import { spawn } from 'node:child_process'

const argv = process.argv.slice(2)
const forwardArgs = []

let port = null
let appMode = null

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]

  if (arg === '--port') {
    const next = argv[i + 1]
    if (next && /^\d+$/.test(next)) {
      port = next
      i += 1
      continue
    }
  }

  if (arg.startsWith('--port=')) {
    const value = arg.slice('--port='.length)
    if (/^\d+$/.test(value)) {
      port = value
      continue
    }
  }

  if (arg === '--app-mode') {
    const next = argv[i + 1]
    if (next && /^(manager|kitchen)$/.test(next)) {
      appMode = next
      i += 1
      continue
    }
  }

  if (arg.startsWith('--app-mode=')) {
    const value = arg.slice('--app-mode='.length)
    if (/^(manager|kitchen)$/.test(value)) {
      appMode = value
      continue
    }
  }

  if (/^\d+$/.test(arg) && port === null) {
    port = arg
    continue
  }

  forwardArgs.push(arg)
}

if (port === null) {
  const npmConfigPort = process.env.npm_config_port || ''
  if (/^\d+$/.test(npmConfigPort)) {
    port = npmConfigPort
  }
}

if (port === null) {
  port = '5173'
}

if (appMode === null) {
  const envMode = process.env.VITE_APP_MODE || ''
  if (/^(manager|kitchen)$/.test(envMode)) {
    appMode = envMode
  }
}

const viteArgs = ['--port', port, ...forwardArgs]
const viteBin = process.platform === 'win32' ? 'vite.cmd' : 'vite'
const childEnv = {
  ...process.env,
  ...(appMode ? { VITE_APP_MODE: appMode } : {}),
}

const child = spawn(viteBin, viteArgs, {
  stdio: 'inherit',
  shell: false,
  env: childEnv,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
