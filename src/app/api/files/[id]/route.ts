import { db } from '@/lib/db'
import { checkCode, unauthorized } from '@/lib/hub-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

function contentDisposition(name: string, inline: boolean) {
  const asciiName = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export async function GET(req: Request, { params }: Params) {
  if (!checkCode(req)) return unauthorized()

  const { id } = await params
  const file = await db.storedFile.findUnique({ where: { id } })
  if (!file) {
    return Response.json({ error: 'File not found' }, { status: 404 })
  }

  const inline = new URL(req.url).searchParams.get('inline') === '1'
  const bytes = new Uint8Array(file.data)

  return new Response(bytes, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': contentDisposition(file.name, inline),
      'Content-Length': String(file.size),
      'Cache-Control': 'no-store',
    },
  })
}

export async function DELETE(req: Request, { params }: Params) {
  if (!checkCode(req)) return unauthorized()

  const { id } = await params
  const existing = await db.storedFile.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    return Response.json({ error: 'File not found' }, { status: 404 })
  }

  await db.storedFile.delete({ where: { id } })
  return Response.json({ ok: true })
}
