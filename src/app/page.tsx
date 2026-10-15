'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FolderLock, Loader2, MessageCircle, Users, X } from 'lucide-react'
import { ChatPanel } from '@/components/hub/chat-panel'
import { FileList } from '@/components/hub/file-list'
import { Gate } from '@/components/hub/gate'
import { PreviewDialog } from '@/components/hub/preview-dialog'
import { UploadCard } from '@/components/hub/upload-card'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import { type HubFile, apiFetch, clearCode, getCode } from '@/lib/hub-client'

type GateStatus = 'checking' | 'locked' | 'unlocked'

export default function Home() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [status, setStatus] = useState<GateStatus>('checking')
  const [files, setFiles] = useState<HubFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [previewFile, setPreviewFile] = useState<HubFile | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const chatOpenRef = useRef(false)

  const handleUnauthorized = useCallback(() => {
    clearCode()
    setFiles([])
    setStatus('locked')
    toast({
      title: 'Passcode needed',
      description: 'Enter the group passcode to get back in.',
      variant: 'destructive',
    })
  }, [toast])

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true)
    try {
      const res = await apiFetch('/api/files')
      if (res.status === 401) {
        handleUnauthorized()
        return
      }
      if (!res.ok) throw new Error()
      const json = await res.json()
      setFiles(json.files ?? [])
    } catch {
      toast({
        title: "Couldn't load files",
        description: 'Check your connection and try again.',
        variant: 'destructive',
      })
    } finally {
      setLoadingFiles(false)
    }
  }, [handleUnauthorized, toast])

  useEffect(() => {
    async function init() {
      const saved = getCode()
      if (!saved) {
        setStatus('locked')
        return
      }
      // validate saved code against the server
      const res = await fetch('/api/files', {
        headers: { 'x-hub-code': saved },
      }).catch(() => null)
      if (res && res.ok) {
        setStatus('unlocked')
        await loadFiles()
      } else if (res && res.status === 401) {
        clearCode()
        setStatus('locked')
      } else {
        // server unreachable — still let them in with the saved code
        setStatus('unlocked')
        await loadFiles()
      }
    }
    init()
  }, [loadFiles])

  function handleChatActivity() {
    if (!chatOpenRef.current) setHasUnread(true)
  }

  function openMobileChat() {
    setChatOpen(true)
    chatOpenRef.current = true
    setHasUnread(false)
  }

  function closeMobileChat() {
    setChatOpen(false)
    chatOpenRef.current = false
  }

  async function handleUnlocked() {
    setStatus('unlocked')
    await loadFiles()
  }

  if (status === 'checking') {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  if (status === 'locked') {
    return (
      <main className="container mx-auto flex w-full max-w-6xl flex-1 flex-col px-4">
        <Gate onUnlocked={handleUnlocked} />
      </main>
    )
  }

  return (
    <>
      <main className="container mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FolderLock className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                IP Project Hub
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                  Team DNK
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Keep files here, open them from anywhere — no more pendrive
                chaos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground md:flex">
              <Users className="h-3.5 w-3.5" aria-hidden />
              3 members
            </div>
            <ThemeToggle />
          </div>
        </motion.header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <UploadCard onUploaded={loadFiles} />

            <FileList
              files={files}
              loading={loadingFiles}
              onChanged={loadFiles}
              onPreview={(f) => {
                setPreviewFile(f)
                setPreviewOpen(true)
              }}
              onUnauthorized={handleUnauthorized}
            />
          </div>

          {!isMobile && (
            <aside
              className="sticky top-6 hidden h-[calc(100dvh-8rem)] min-h-96 lg:block"
              aria-label="Group chat"
            >
              <ChatPanel />
            </aside>
          )}
        </div>
      </main>

      <footer className="mt-auto border-t bg-muted/40">
        <div className="container mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1 px-4 py-4 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
          <p>Team DNK's project hub — files and chat in one place.</p>
          <p>Keep the pendrive as backup anyway.</p>
        </div>
      </footer>

      {/* Mobile chat: floating button + slide-in drawer (chat stays connected) */}
      {isMobile && (
        <>
          <Button
            size="icon"
            aria-label="Open group chat"
            onClick={openMobileChat}
            className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-lg"
          >
            <MessageCircle className="h-6 w-6" aria-hidden />
            {hasUnread && (
              <span
                className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-destructive"
                aria-hidden
              />
            )}
          </Button>

          <div
            className={`fixed inset-0 z-50 bg-black/40 transition-opacity ${
              chatOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={closeMobileChat}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label="Group chat"
            className={`fixed inset-y-0 right-0 z-50 flex w-[88vw] max-w-sm flex-col bg-background p-3 shadow-xl transition-transform duration-300 ${
              chatOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <Button
              size="icon"
              variant="ghost"
              aria-label="Close chat"
              onClick={closeMobileChat}
              className="absolute -left-1 top-1 z-10 h-9 w-9 rounded-full bg-background shadow"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
            <ChatPanel onActivity={handleChatActivity} active={chatOpen} />
          </div>
        </>
      )}

      <PreviewDialog
        file={previewFile}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onUnauthorized={handleUnauthorized}
      />
    </>
  )
}
