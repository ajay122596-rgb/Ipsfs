import { db } from '@/lib/db'
import { checkCode, unauthorized } from '@/lib/hub-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!checkCode(req)) return unauthorized()

  const body = await req.json().catch(() => null)
  const name = ((body?.name as string) ?? '').trim().slice(0, 40)
  const senderId = ((body?.senderId as string) ?? '').trim().slice(0, 64)
  const text = ((body?.text as string) ?? '').trim().slice(0, 1000)

  if (!name) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!text) {
    return Response.json({ error: 'Message is empty' }, { status: 400 })
  }

  const saved = await db.chatMessage.create({
    data: { name, senderId, text },
    select: { id: true, name: true, senderId: true, text: true, createdAt: true },
  })

  return Response.json({ message: saved }, { status: 201 })
}
