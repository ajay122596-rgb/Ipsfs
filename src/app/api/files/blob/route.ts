import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { HUB_CODE } from '@/lib/hub-auth'
import { BLOB_MAX_FILE_MB } from '@/lib/storage'

export const dynamic = 'force-dynamic'

/**
 * Client-upload gateway for Vercel Blob. The browser asks this route for a
 * one-time upload token, then streams the file DIRECTLY to Blob storage —
 * the bytes never pass through a serverless function, so the ~4.5 MB
 * platform body limit does not apply.
 * The group passcode travels in clientPayload and is checked here.
 */
export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return Response.json(
      { error: 'Blob storage is not connected yet' },
      { status: 503 }
    )
  }

  try {
    const jsonResponse = await handleUpload({
      token,
      request,
      body: request.body as HandleUploadBody,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (clientPayload !== HUB_CODE) {
          throw new Error('Unauthorized')
        }
        return {
          maximumSizeInBytes: BLOB_MAX_FILE_MB * 1024 * 1024,
          addRandomSuffix: true,
        }
      },
    })
    return Response.json(jsonResponse)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload rejected'
    return Response.json(
      { error: message },
      { status: message === 'Unauthorized' ? 403 : 400 }
    )
  }
}
