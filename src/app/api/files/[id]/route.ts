import { del } from '@vercel/blob'
import { db } from '@/lib/db'
import { checkCode, unauthorized } from '@/lib/hub-auth'
import { BLOB_ENABLED, blobUrlOf } from '@/lib/storage'

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

  // Big files: bytes live in Vercel Blob — bounce the browser straight there.
  const url = blobUrlOf(file)
  if (url && BLOB_ENABLED) {
    const inline = new URL(req.url).searchParams.get('inline') === '1'
    const target = inline ? url : `${url}${url.includes('?') ? '&' : '?'}download=1`
    return Response.redirect(target, 302)
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
    select: { id: true, ...(BLOB_ENABLED ? { blobUrl: true } : {}) },
  })
  if (!existing) {
    return Response.json({ error: 'File not found' }, { status: 404 })
  }

  await db.storedFile.delete({ where: { id } })

  // Best-effort cleanup of the blob copy — the hub stays correct either way.
  const url = blobUrlOf(existing)
  if (url) {
    await del(url).catch(() => {})
  }

  return Response.json({ ok: true })
}
