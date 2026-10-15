import type { Prisma } from '@prisma/client'

/**
 * Vercel Blob is an optional big-file storage layer:
 *  - enabled  -> file bytes go straight browser -> Blob (bypasses the ~4.5 MB
 *                serverless request cap); Postgres keeps only the metadata.
 *  - disabled -> bytes live in Postgres like before (fine up to ~4.5 MB on
 *                Vercel, 150 MB locally).
 * To enable: connect a Blob store to this project in the Vercel dashboard
 * (Storage -> Create Store -> Blob). It adds BLOB_READ_WRITE_TOKEN.
 */
export const BLOB_ENABLED = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

/** Hard cap accepted by the blob token (500 MB is plenty for the trio). */
export const BLOB_MAX_FILE_MB = 500

/**
 * Select clause for file metadata. blobUrl is only requested when blob storage
 * is enabled so the Prisma client never receives fields it doesn't know.
 */
export function fileSelect(): Prisma.StoredFileSelect {
  return {
    id: true,
    name: true,
    note: true,
    uploader: true,
    mimeType: true,
    size: true,
    createdAt: true,
    ...(BLOB_ENABLED ? { blobUrl: true } : {}),
  }
}

/** Safe read of blobUrl that works on any Prisma client build. */
export function blobUrlOf(row: unknown): string {
  const url = (row as { blobUrl?: unknown }).blobUrl
  return typeof url === 'string' ? url : ''
}
