import { db } from '@/lib/db'
import { checkCode, unauthorized } from '@/lib/hub-auth'
import { BLOB_ENABLED, fileSelect } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 150 * 1024 * 1024 // 150MB (database path)
const MAX_BLOB_SIZE = 10 * 1024 * 1024 * 1024 // sanity cap for metadata

export async function GET(req: Request) {
  if (!checkCode(req)) return unauthorized()

  const files = await db.storedFile.findMany({
    orderBy: { createdAt: 'desc' },
    select: fileSelect(),
  })

  return Response.json({ files })
}

export async function POST(req: Request) {
  if (!checkCode(req)) return unauthorized()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid upload request' }, { status: 400 })
  }

  const blobUrl = ((form.get('blobUrl') as string) ?? '').trim()
  const usingBlob = BLOB_ENABLED && blobUrl.startsWith('https://')

  let size = 0
  let data = new Uint8Array(0)

  if (usingBlob) {
    // Bytes already live in Vercel Blob; only metadata is stored here.
    const claimed = Number.parseInt((form.get('size') as string) ?? '', 10)
    size = Number.isFinite(claimed) ? Math.max(0, claimed) : 0
    if (size > MAX_BLOB_SIZE) {
      return Response.json({ error: 'File too large' }, { status: 400 })
    }
  } else {
    const file = form.get('file')
    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size === 0) {
      return Response.json({ error: 'File is empty' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return Response.json(
        { error: 'File too large (max 150 MB)' },
        { status: 400 }
      )
    }
    size = file.size
    data = new Uint8Array(await file.arrayBuffer())
  }

  const note = ((form.get('note') as string) ?? '').trim().slice(0, 500)
  const uploader =
    ((form.get('uploader') as string) ?? '').trim().slice(0, 60) || 'Anonymous'
  const name = usingBlob
    ? ((form.get('name') as string) ?? 'file').trim().slice(0, 200) || 'file'
    : (form.get('file') as File).name.slice(0, 200)

  const saved = await db.storedFile.create({
    data: {
      name,
      note,
      uploader,
      mimeType: usingBlob
        ? ((form.get('mimeType') as string) ?? '').trim() ||
          'application/octet-stream'
        : (form.get('file') as File).type || 'application/octet-stream',
      size,
      data,
      ...(usingBlob ? { blobUrl } : {}),
    },
    select: fileSelect(),
  })

  return Response.json({ file: saved }, { status: 201 })
}
