export interface HubFile {
  id: string
  name: string
  note: string
  uploader: string
  mimeType: string
  size: number
  createdAt: string
}

export const MAX_FILE_MB = 150
export const MAX_SIZE = MAX_FILE_MB * 1024 * 1024 // 150 MB upload cap

export function getCode(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('hubCode') ?? ''
}

export function saveCode(code: string) {
  localStorage.setItem('hubCode', code)
}

export function clearCode() {
  localStorage.removeItem('hubCode')
}

export function getUploaderName(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('hubUploader') ?? ''
}

export function saveUploaderName(name: string) {
  localStorage.setItem('hubUploader', name)
}

/**
 * Persistent per-device id so chat knows which messages are yours
 * (survives name changes — used for own-bubble styling + delete rights).
 */
export function getClientId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('hubClientId')
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `d-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem('hubClientId', id)
  }
  return id
}

/** Fetch wrapper that attaches the group passcode header. */
export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers)
  headers.set('x-hub-code', getCode())
  return fetch(path, { ...init, headers })
}

export async function downloadFile(file: HubFile) {
  const res = await apiFetch(`/api/files/${file.id}`)
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getExtension(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

const TEXT_EXTENSIONS = new Set([
  'py', 'txt', 'csv', 'md', 'json', 'sql', 'js', 'ts', 'tsx', 'jsx',
  'html', 'htm', 'css', 'xml', 'yml', 'yaml', 'sh', 'log', 'ini',
  'env', 'java', 'c', 'cpp', 'h', 'r', 'toml', 'ipynb',
])

export function isPreviewable(file: HubFile): boolean {
  return (
    TEXT_EXTENSIONS.has(getExtension(file.name)) &&
    file.size < 512 * 1024 &&
    file.size > 0
  )
}

const LANGUAGE_MAP: Record<string, string> = {
  py: 'python',
  sql: 'sql',
  json: 'json',
  ipynb: 'json',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  css: 'css',
  md: 'markdown',
  sh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  r: 'r',
}

export function getLanguage(name: string): string | undefined {
  return LANGUAGE_MAP[getExtension(name)]
}
