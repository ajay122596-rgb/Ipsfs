import { db } from '@/lib/db'
import { checkCode, unauthorized } from '@/lib/hub-auth'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 150 * 1024 * 1024 // 150MB

export async function GET(req: Request) {
  if (!checkCode(req)) return unauthorized()

  const files = await db.storedFile.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      note: true,
      uploader: true,
      mimeType: true,
      size: true,
      createdAt: true,
    },
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

  const note = ((form.get('note') as string) ?? '').trim().slice(0, 500)
  const uploader =
    ((form.get('uploader') as string) ?? '').trim().slice(0, 60) || 'Anonymous'
  const name = file.name.slice(0, 200)

  const data = new Uint8Array(await file.arrayBuffer())

  const saved = await db.storedFile.create({
    data: {
      name,
      note,
      uploader,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      data,
    },
    select: {
      id: true,
      name: true,
      note: true,
      uploader: true,
      mimeType: true,
      size: true,
      createdAt: true,
    },
  })

  return Response.json({ file: saved }, { status: 201 })
}
