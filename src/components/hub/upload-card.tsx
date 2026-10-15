'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CloudUpload,
  File as FileIcon,
  Loader2,
  NotebookPen,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  MAX_FILE_MB,
  MAX_SIZE,
  formatBytes,
  getUploaderName,
  saveUploaderName,
} from '@/lib/hub-client'

interface UploadCardProps {
  onUploaded: () => void
}

export function UploadCard({ onUploaded }: UploadCardProps) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [uploader, setUploader] = useState<string>(() => '')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setUploader(getUploaderName())
  }, [])

  function pickFile(f: File | null) {
    if (!f) return
    if (f.size > MAX_SIZE) {
      toast({
        title: 'File too large',
        description: `${f.name} is ${formatBytes(f.size)} — the limit is ${MAX_FILE_MB} MB.`,
        variant: 'destructive',
      })
      return
    }
    setFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  async function handleUpload() {
    if (!file || uploading) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('note', note)
      body.append('uploader', uploader)
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'x-hub-code': localStorage.getItem('hubCode') ?? '' },
        body,
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 401) {
        toast({
          title: 'Session expired',
          description: 'Enter the passcode again.',
          variant: 'destructive',
        })
        clearSession()
        return
      }
      if (!res.ok) {
        toast({
          title: 'Upload failed',
          description: json.error ?? 'Something went wrong.',
          variant: 'destructive',
        })
        return
      }
      saveUploaderName(uploader.trim())
      toast({
        title: 'Uploaded',
        description: `${file.name} is in the hub — everyone can grab it.`,
      })
      setFile(null)
      setNote('')
      if (inputRef.current) inputRef.current.value = ''
      onUploaded()
    } catch {
      toast({
        title: 'Upload failed',
        description: "Can't reach the hub. Check your connection.",
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  function clearSession() {
    localStorage.removeItem('hubCode')
    window.location.reload()
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-label="Upload files"
      className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <Upload className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Upload
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose a file to upload"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/40 hover:bg-muted/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            aria-label="File input"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex w-full items-center gap-3 rounded-lg bg-muted/60 p-3 text-left">
              <FileIcon className="h-8 w-8 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove selected file"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <>
              <CloudUpload className="h-8 w-8 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-sm font-medium">
                  Drop a file here or click to browse
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Code, CSVs, notes — anything up to {MAX_FILE_MB} MB
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="uploader" className="text-xs text-muted-foreground">
              Your name
            </Label>
            <Input
              id="uploader"
              placeholder="e.g. Dev"
              value={uploader}
              onChange={(e) => setUploader(e.target.value)}
              maxLength={60}
              className="h-10"
            />
          </div>
          <div className="grid flex-1 gap-1.5">
            <Label
              htmlFor="note"
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <NotebookPen className="h-3.5 w-3.5" aria-hidden />
              Note — what's this file?
            </Label>
            <Textarea
              id="note"
              placeholder="e.g. Final pandas part — filters by section and plots averages"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="min-h-20 resize-none"
            />
          </div>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="h-11 w-full gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>
    </motion.section>
  )
}
