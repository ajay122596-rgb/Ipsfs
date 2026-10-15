'use client'

import { format, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  Download,
  Eye,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Inbox,
  Loader2,
  NotebookPen,
  Trash2,
  User,
} from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  type HubFile,
  apiFetch,
  downloadFile,
  formatBytes,
  getExtension,
  isPreviewable,
} from '@/lib/hub-client'

interface FileListProps {
  files: HubFile[]
  loading: boolean
  onChanged: () => void
  onPreview: (file: HubFile) => void
  onUnauthorized: () => void
}

function iconFor(name: string) {
  const ext = getExtension(name)
  if (['py', 'js', 'ts', 'tsx', 'jsx', 'sql', 'json', 'html', 'css', 'c', 'cpp', 'java', 'sh'].includes(ext))
    return FileCode2
  if (['csv', 'xlsx', 'xls'].includes(ext)) return FileSpreadsheet
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return FileImage
  if (['txt', 'md', 'pdf', 'doc', 'docx'].includes(ext)) return FileText
  return FileIcon
}

export function FileList({
  files,
  loading,
  onChanged,
  onPreview,
  onUnauthorized,
}: FileListProps) {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState<HubFile | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = files.filter((f) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      f.name.toLowerCase().includes(q) ||
      f.note.toLowerCase().includes(q) ||
      f.uploader.toLowerCase().includes(q)
    )
  })

  async function handleDownload(file: HubFile) {
    setBusyId(file.id)
    try {
      await downloadFile(file)
    } catch {
      toast({
        title: 'Download failed',
        description: "Couldn't fetch the file. Try again.",
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setBusyId(deleting.id)
    try {
      const res = await apiFetch(`/api/files/${deleting.id}`, {
        method: 'DELETE',
      })
      if (res.status === 401) {
        onUnauthorized()
        return
      }
      if (!res.ok) throw new Error()
      toast({ title: 'Deleted', description: `${deleting.name} was removed.` })
      onChanged()
    } catch {
      toast({
        title: 'Delete failed',
        description: "Couldn't delete the file. Try again.",
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
      setDeleting(null)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      aria-label="Shared files"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Shared files
            <span className="ml-2 font-mono text-xs normal-case">
              ({files.length})
            </span>
          </h2>
        </div>
        <Input
          placeholder="Search name, note, file…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search files"
          className="h-9 sm:max-w-64"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span className="text-sm">Loading files…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm font-medium">
            {files.length === 0
              ? 'Nothing here yet — add the first file.'
              : 'Nothing found.'}
          </p>
          <p className="text-xs text-muted-foreground">
            {files.length === 0
              ? 'Python files, CSVs, notes — use the box above.'
              : 'Try a different keyword.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((file) => {
            const Icon = iconFor(file.name)
            return (
              <li
                key={file.id}
                className="flex flex-col gap-3 rounded-xl border bg-background/50 p-3 transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" aria-hidden />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p
                      className="max-w-full truncate text-sm font-medium"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    <Badge variant="secondary" className="text-[10px]">
                      {formatBytes(file.size)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      .{getExtension(file.name) || 'file'}
                    </Badge>
                  </div>
                  {file.note ? (
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <NotebookPen
                        className="mt-0.5 h-3 w-3 shrink-0"
                        aria-hidden
                      />
                      <span className="min-w-0 break-words">{file.note}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-muted-foreground/60">
                      No note
                    </p>
                  )}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" aria-hidden />
                      {file.uploader}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" aria-hidden />
                      {format(parseISO(file.createdAt), 'd MMM yyyy, h:mm a')}
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                  {isPreviewable(file) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Preview ${file.name}`}
                      onClick={() => onPreview(file)}
                    >
                      <Eye className="h-4 w-4" aria-hidden />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Download ${file.name}`}
                    disabled={busyId === file.id}
                    onClick={() => handleDownload(file)}
                  >
                    {busyId === file.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${file.name}`}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busyId === file.id}
                    onClick={() => setDeleting(file)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  <span className="font-medium text-foreground">
                    {deleting.name}
                  </span>{' '}
                  will be removed for everyone. This can't be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.section>
  )
}

