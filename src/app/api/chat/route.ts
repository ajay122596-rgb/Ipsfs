import { db } from '@/lib/db'
import { checkCode, unauthorized } from '@/lib/hub-auth'

export const dynamic = 'force-dynamic'

const ONLINE_WINDOW_MS = 15_000 // seen within 15s = online
const TYPING_WINDOW_MS = 5_000 // typing flag valid for 5s
const HISTORY_LIMIT = 200

export async function POST(req: Request) {
  if (!checkCode(req)) return unauthorized()

  const body = await req.json().catch(() => null)
  const name = ((body?.name as string) ?? '').trim().slice(0, 40)
  const typing = !!body?.typing

  if (!name) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }

  const now = new Date()

  // heartbeat: upsert presence
  await db.chatPresence.upsert({
    where: { name },
    create: {
      name,
      lastSeen: now,
      typingUntil: typing ? new Date(now.getTime() + TYPING_WINDOW_MS) : null,
    },
    update: {
      lastSeen: now,
      typingUntil: typing ? new Date(now.getTime() + TYPING_WINDOW_MS) : null,
    },
  })

  const cutoff = new Date(now.getTime() - ONLINE_WINDOW_MS)

  const [messages, presences] = await Promise.all([
    db.chatMessage.findMany({
      orderBy: { createdAt: 'asc' },
      take: -HISTORY_LIMIT,
      select: { id: true, name: true, senderId: true, text: true, createdAt: true },
    }),
    db.chatPresence.findMany({
      where: { lastSeen: { gt: cutoff } },
      select: { name: true, typingUntil: true },
    }),
  ])

  const online = presences.map((p) => p.name)
  const nowMs = now.getTime()
  const typingNames = presences
    .filter(
      (p) => p.typingUntil !== null && p.typingUntil.getTime() > nowMs
    )
    .map((p) => p.name)

  return Response.json({ messages, online, typingNames })
}

export async function DELETE(req: Request) {
  // clear chat history (handy if they want a fresh start)
  if (!checkCode(req)) return unauthorized()
  await db.chatMessage.deleteMany({})
  await db.chatPresence.deleteMany({})
  return Response.json({ ok: true })
}
