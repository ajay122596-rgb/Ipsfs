'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FolderLock, Loader2, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveCode } from '@/lib/hub-client'

interface GateProps {
  onUnlocked: () => void
}

export function Gate({ onUnlocked }: GateProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || checking) return
    setChecking(true)
    setError(null)
    try {
      const res = await fetch('/api/files', {
        headers: { 'x-hub-code': code.trim() },
      })
      if (res.status === 401) {
        setError('Wrong passcode — ask your group members.')
        return
      }
      if (!res.ok) {
        setError('Something went wrong. Try again.')
        return
      }
      saveCode(code.trim())
      onUnlocked()
    } catch {
      setError("Can't reach the hub. Check your connection.")
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <FolderLock className="h-7 w-7 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">
                Team DNK
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                IP Project Hub
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your group's private locker — enter the passcode to get in.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              inputMode="text"
              placeholder="Group passcode"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setError(null)
              }}
              aria-label="Group passcode"
              autoFocus
              className="h-11 text-center tracking-widest"
            />
            {error && (
              <p className="text-center text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="h-11 w-full gap-2"
              disabled={checking || !code.trim()}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden />
              )}
              {checking ? 'Checking…' : 'Unlock'}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your passcode stays on this device — you only enter it once.
        </p>
      </motion.div>
    </div>
  )
}
