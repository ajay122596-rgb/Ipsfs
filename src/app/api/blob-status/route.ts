export const dynamic = 'force-dynamic'

/**
 * Tells the upload card whether Vercel Blob is connected, so it can pick the
 * direct-to-blob path (big files) or the database path (small files).
 */
export async function GET() {
  return Response.json({ enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN) })
}
