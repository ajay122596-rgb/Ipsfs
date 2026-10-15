'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format, isSameDay, isToday, isYesterday } from 'date-fns'
import {
  ArrowDown,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Send,
  Trash2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getClientId,
  getCode,
  getUploaderName,
  saveUploaderName,
} from '@/lib/hub-client'

interface ChatMessage {
  id: string
  name: string
  senderId: string
  text: string
  createdAt: string
  /** locally appended, waiting for the server to confirm */
  pending?: boolean
}

interface SyncResponse {
  messages: ChatMessage[]
  online: string[]
  typingNames: string[]
}

interface SystemMessage {
  id: string
  text: string
  createdAt: number
  system: true
}

type AnyMessage = ChatMessage | SystemMessage

interface ChatPanelProps {
  /** Called when a message from someone else arrives (for unread badges). */
  onActivity?: () => void
  /** false = panel hidden (e.g. mobile drawer closed) -> poll slower */
  active?: boolean
}

const FAST_MS = 1000
const SLOW_MS = 4000

function msgTime(m: AnyMessage): Date {
  return new Date(m.createdAt)
}

function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'd MMM')
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.join('\u0000') === b.join('\u0000')
}

function isOwnMessage(m: AnyMessage, myId: string, myName: string): boolean {
  if ('system' in m) return false
  // newer messages carry a device id; old ones fall back to the name
  return m.senderId ? m.senderId === myId : m.name === myName
}

export function ChatPanel({ onActivity, active = true }: ChatPanelProps) {
  const [myId] = useState(() => getClientId())
  const [myName, setMyName] = useState(() => getUploaderName())
  const [nameInput, setNameInput] = useState(() => getUploaderName())
  const [needsName, setNeedsName] = useState(() => !getUploaderName())
  // if a name was saved before, skip the join screen and go straight to chat
  const [joined, setJoined] = useState(() => !!getUploaderName())
  const [joining, setJoining] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [live, setLive] = useState(false)
  const [messages, setMessages] = useState<AnyMessage[]>([])
  const [online, setOnline] = useState<string[]>([])
  const [typingNames, setTypingNames] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [showJump, setShowJump] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const myNameRef = useRef(myName)
  const typingRef = useRef(false)
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncInFlightRef = useRef(false)
  const sendBusyRef = useRef(false)
  const lastSyncAtRef = useRef(0)
  const activeRef = useRef(active)
  const onActivityRef = useRef(onActivity)

  useEffect(() => {
    onActivityRef.current = onActivity
  }, [onActivity])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  // keep the ref used inside the polling loop in sync
  useEffect(() => {
    myNameRef.current = myName
  }, [myName])

  const sync = useCallback(async () => {
    if (!joined || syncInFlightRef.current) return
    syncInFlightRef.current = true
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-code': getCode(),
        },
        body: JSON.stringify({
          name: myNameRef.current,
          typing: typingRef.current,
        }),
      })
      if (res.status === 401) {
        setLive(false)
        return
      }
      if (!res.ok) throw new Error('sync failed')
      const data: SyncResponse = await res.json()
      setLive(true)
      setOnline((prev) =>
        sameList(prev, data.online ?? []) ? prev : (data.online ?? [])
      )
      const nextTyping = (data.typingNames ?? []).filter(
        (n) => n !== myNameRef.current
      )
      setTypingNames((prev) =>
        sameList(prev, nextTyping) ? prev : nextTyping
      )

      const incoming = data.messages ?? []
      let shouldNotify = false
      setMessages((prev) => {
        const serverIds = new Set(incoming.map((m) => m.id))
        // reconcile: drop local copies the server no longer has (deleted
        // by their sender on another device) — keep system + pending rows
        const kept = prev.filter(
          (m) => 'system' in m || m.pending || serverIds.has(m.id)
        )
        if (incoming.length === 0 && kept.length === prev.length) return prev
        const known = new Set(prev.map((m) => m.id))
        const fresh = incoming.filter((m) => !known.has(m.id))
        if (fresh.length === 0) {
          return kept.length === prev.length ? prev : kept
        }
        // no setState of other components inside this updater — React may
        // run it during render; flag it and notify after it completes
        if (fresh.some((m) => m.senderId !== myId)) shouldNotify = true
        return [...kept, ...fresh].slice(-400)
      })
      if (shouldNotify) onActivityRef.current?.()
    } catch {
      setLive(false)
    } finally {
      syncInFlightRef.current = false
    }
  }, [joined, myId])

  // adaptive polling: ~1s while the tab is visible & panel open, 4s otherwise
  useEffect(() => {
    if (!joined) return
    void sync()
    lastSyncAtRef.current = Date.now()
    const timer = setInterval(() => {
      const slowed = document.hidden || !activeRef.current
      if (slowed && Date.now() - lastSyncAtRef.current < SLOW_MS) return
      lastSyncAtRef.current = Date.now()
      void sync()
    }, FAST_MS)
    return () => clearInterval(timer)
  }, [joined, sync])

  // catch tab switches / refocus instantly instead of waiting a tick
  useEffect(() => {
    if (!joined) return
    const wake = () => {
      if (document.hidden) return
      if (Date.now() - lastSyncAtRef.current < 400) return
      lastSyncAtRef.current = Date.now()
      void sync()
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    return () => {
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
    }
  }, [joined, sync])

  // auto-scroll only while the user is already near the bottom
  useEffect(() => {
    const el = scrollRef.current
    if (el && atBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight })
    }
  }, [messages, typingNames])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    atBottomRef.current = near
    setShowJump(!near)
  }

  function jumpToLatest() {
    const el = scrollRef.current
    if (el) {
      atBottomRef.current = true
      setShowJump(false)
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }

  function handleJoin() {
    const name = nameInput.trim().slice(0, 40)
    if (!name || joining) return
    setJoining(true)
    setChatError(null)
    // verify the name against the server with a presence ping
    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-code': getCode(),
      },
      body: JSON.stringify({ name, typing: false }),
    })
      .then(async (res) => {
        if (res.status === 401) {
          setChatError('Wrong passcode — unlock the hub again.')
          return
        }
        if (!res.ok) throw new Error()
        setMyName(name)
        myNameRef.current = name
        saveUploaderName(name)
        setNeedsName(false)
        setJoined(true)
      })
      .catch(() => setChatError("Can't reach the chat. Try again."))
      .finally(() => setJoining(false))
  }

  function startEditName() {
    setNameDraft(myName)
    setEditingName(true)
  }

  function saveName() {
    const name = nameDraft.trim().slice(0, 40)
    setEditingName(false)
    if (!name || name === myName) return
    saveUploaderName(name)
    setMyName(name)
    myNameRef.current = name
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: `Name changed — you're now "${name}"`,
        createdAt: Date.now(),
        system: true,
      },
    ])
    void sync() // heartbeat with the new name right away
  }

  function markTyping() {
    typingRef.current = true
    if (typingClearRef.current) clearTimeout(typingClearRef.current)
    typingClearRef.current = setTimeout(() => {
      typingRef.current = false
    }, 3500)
  }

  async function handleSend() {
    const text = input.trim().slice(0, 1000)
    if (!text || !joined || sendBusyRef.current) return
    sendBusyRef.current = true
    // optimistic: show it instantly, confirm in the background
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tmp: ChatMessage = {
      id: tmpId,
      name: myNameRef.current,
      senderId: myId,
      text,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    setInput('')
    setMessages((prev) => [...prev, tmp].slice(-400))
    setSending(true)
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-code': getCode(),
        },
        body: JSON.stringify({
          name: myNameRef.current,
          senderId: myId,
          text,
        }),
      })
      if (res.status === 201) {
        const { message } = await res.json()
        setMessages((prev) =>
          prev.map((m) => (m.id === tmpId ? (message as ChatMessage) : m))
        )
        typingRef.current = false
        void sync() // refresh presence/typing state immediately
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tmpId))
        setChatError('Message failed to send. Try again.')
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tmpId))
      setChatError('Message failed to send. Try again.')
    } finally {
      setSending(false)
      sendBusyRef.current = false
    }
  }

  async function handleDelete(id: string) {
    // optimistic removal; if the server refuses, the next sync brings it back
    setMessages((prev) => prev.filter((m) => m.id !== id))
    try {
      const res = await fetch(
        `/api/chat/${id}?sender=${encodeURIComponent(myId)}`,
        { method: 'DELETE', headers: { 'x-hub-code': getCode() } }
      )
      if (!res.ok) throw new Error()
    } catch {
      // silent — reconcile on the next poll keeps everyone consistent
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MessagesSquare className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            DNK Chat
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {editingName ? (
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') setEditingName(false)
              }}
              onBlur={saveName}
              maxLength={40}
              autoFocus
              aria-label="Edit your chat name"
              className="h-7 w-28 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={startEditName}
              aria-label="Change your chat name"
              title="Change your name"
              className="flex max-w-28 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary transition-colors hover:bg-primary/20"
            >
              <span className="truncate text-[11px] font-medium">
                {myName || 'Name?'}
              </span>
              <Pencil className="h-3 w-3 shrink-0" aria-hidden />
            </button>
          )}
          <span className="flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? 'animate-pulse bg-emerald-500' : 'bg-red-400'
              }`}
              aria-hidden
            />
            {live ? 'Live' : 'Off'}
          </span>
          <span className="flex items-center gap-1" title="Online members">
            <Users className="h-3 w-3" aria-hidden />
            {online.length}
          </span>
        </div>
      </div>

      {needsName && !joined ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <MessageCircle className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium">Pick a chat name</p>
            <p className="mt-1 text-xs text-muted-foreground">
              That's what everyone will see in the chat.
            </p>
          </div>
          <div className="flex w-full max-w-60 flex-col gap-2">
            <Input
              placeholder="e.g. Dev"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={40}
              aria-label="Chat display name"
              className="h-10"
            />
            <Button
              onClick={handleJoin}
              disabled={!nameInput.trim() || joining}
              className="h-10"
            >
              {joining && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Start chatting
            </Button>
            {chatError && (
              <p className="text-xs text-destructive" role="alert">
                {chatError}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="relative flex-1 space-y-2.5 overflow-y-auto p-4 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5"
            aria-label="Chat messages"
          >
            {!live && joined && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Reconnecting to chat…
              </p>
            )}
            {joined && live && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <MessagesSquare
                  className="h-8 w-8 text-muted-foreground/50"
                  aria-hidden
                />
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs text-muted-foreground">
                  Say hi — plan who's doing which part.
                </p>
              </div>
            )}
            {messages.map((msg, i) => {
              const showDivider =
                i === 0 ||
                !isSameDay(msgTime(messages[i - 1]), msgTime(msg))
              const own = isOwnMessage(msg, myId, myName)
              return (
                <div key={msg.id} className="space-y-2.5">
                  {showDivider && (
                    <div className="flex items-center gap-2 py-1">
                      <span className="h-px flex-1 bg-border" aria-hidden />
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                        {dayLabel(msgTime(msg))}
                      </span>
                      <span className="h-px flex-1 bg-border" aria-hidden />
                    </div>
                  )}
                  {'system' in msg ? (
                    <p className="py-0.5 text-center text-[11px] italic text-muted-foreground/70">
                      {msg.text}
                    </p>
                  ) : (
                    <div
                      className={`group flex flex-col ${
                        own ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-baseline gap-2 px-1">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {own ? 'You' : msg.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {format(msgTime(msg), 'h:mm a')}
                        </span>
                      </div>
                      <div className="flex min-w-0 max-w-[85%] items-center gap-1">
                        {own && !msg.pending && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(msg.id)}
                            aria-label="Delete this message"
                            title="Delete"
                            className="shrink-0 text-muted-foreground/50 transition hover:text-destructive max-md:opacity-60 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                        <div
                          title={msg.pending ? 'Sending…' : undefined}
                          className={`min-w-0 whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                            own
                              ? 'rounded-br-md bg-primary text-primary-foreground'
                              : 'rounded-bl-md bg-muted text-foreground'
                          } ${msg.pending ? 'opacity-70' : ''}`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {typingNames.length > 0 && (
              <p className="px-1 text-[11px] italic text-muted-foreground">
                {typingNames.join(', ')} typing…
              </p>
            )}
          </div>

          {showJump && (
            <Button
              size="icon"
              variant="outline"
              aria-label="Jump to latest messages"
              onClick={jumpToLatest}
              className="absolute bottom-20 right-6 z-10 h-9 w-9 rounded-full shadow-md"
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </Button>
          )}

          <div className="flex items-center gap-2 border-t p-3">
            <Input
              placeholder={joined ? 'Type a message…' : 'Connecting…'}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                if (joined) markTyping()
              }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              maxLength={1000}
              disabled={!joined}
              aria-label="Chat message input"
              className="h-10"
            />
            <Button
              size="icon"
              aria-label="Send message"
              disabled={!joined || !input.trim()}
              onClick={handleSend}
              className="h-10 w-10 shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
