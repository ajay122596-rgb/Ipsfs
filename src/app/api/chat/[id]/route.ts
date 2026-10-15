import { db } from '@/lib/db'
import { checkCode, unauthorized } from '@/lib/hub-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** Delete a chat message — only the device that sent it may delete it. */
export async function DELETE(req: Request, { params }: Params) {
  if (!checkCode(req)) return unauthorized()

  const { id } = await params
  const senderId = new URL(req.url).searchParams.get('sender') ?? ''
  if (!senderId) {
    return Response.json({ error: 'Missing sender id' }, { status: 400 })
  }

  const existing = await db.chatMessage.findUnique({
    where: { id },
    select: { senderId: true },
  })
  if (!existing) {
    // already gone — treat as success so the UI stays consistent
    return Response.json({ ok: true })
  }
  if (existing.senderId !== senderId) {
    return Response.json(
      { error: 'You can only delete your own messages' },
      { status: 403 }
    )
  }

  await db.chatMessage.delete({ where: { id } })
  return Response.json({ ok: true })
}
