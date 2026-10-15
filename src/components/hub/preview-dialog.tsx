'use client'

import { useEffect, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Loader2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  type HubFile,
  apiFetch,
  getExtension,
  getLanguage,
} from '@/lib/hub-client'

interface PreviewDialogProps {
  file: HubFile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnauthorized: () => void
}

export function PreviewDialog({
  file,
  open,
  onOpenChange,
  onUnauthorized,
}: PreviewDialogProps) {
  if (!file) return null

  const language = getLanguage(file.name)
  const ext = getExtension(file.name) || 'file'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="truncate pr-6 text-base">
            {file.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {file.note || `Preview of the .${ext} file — download it to save a copy.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto bg-zinc-50 p-0 dark:bg-zinc-950">
          {open && (
            <PreviewContent
              key={file.id}
              fileId={file.id}
              language={language}
              onUnauthorized={onUnauthorized}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface PreviewContentProps {
  fileId: string
  language: string | undefined
  onUnauthorized: () => void
}

function PreviewContent({
  fileId,
  language,
  onUnauthorized,
}: PreviewContentProps) {
  // null = still loading
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    let cancelled = false
    apiFetch(`/api/files/${fileId}?inline=1`)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 401) {
          onUnauthorized()
          return
        }
        if (!res.ok) throw new Error('fetch failed')
        const text = await res.text()
        if (!cancelled) setContent(text)
      })
      .catch(() => {
        if (!cancelled)
          setError('Could not load preview. Try downloading instead.')
      })
    return () => {
      cancelled = true
    }
  }, [fileId, onUnauthorized])

  if (error) {
    return <p className="p-6 text-sm text-destructive">{error}</p>
  }
  if (content === null) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">Loading preview…</span>
      </div>
    )
  }
  if (language) {
    return (
      <SyntaxHighlighter
        language={language}
        style={resolvedTheme === 'dark' ? oneDark : oneLight}
        showLineNumbers
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'transparent',
          fontSize: '0.8rem',
        }}
      >
        {content}
      </SyntaxHighlighter>
    )
  }
  return (
    <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed">
      {content}
    </pre>
  )
}
