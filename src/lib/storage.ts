import { supabase } from './supabase'

export const PAYMENT_BUCKET = 'payment-screenshots'
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export interface UploadResult {
  ok: boolean
  path?: string
  error?: string
}

/** Validate + upload a payment screenshot. Path layout:
 * `{userId}/{orderId}.{ext}` — the storage policies restrict every
 * operation on this bucket to the owning user's folder (admins can read). */
export async function uploadPaymentScreenshot(
  userId: string,
  orderId: string,
  file: File,
): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: 'Only PNG, JPG or WEBP images are accepted.' }
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    return { ok: false, error: 'The screenshot is too large (max 5 MB).' }
  }
  if (file.size === 0) {
    return { ok: false, error: 'The selected file is empty.' }
  }

  const path = `${userId}/${orderId}.${EXT_BY_TYPE[file.type]}`
  const { error } = await supabase.storage
    .from(PAYMENT_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) {
    return { ok: false, error: `Upload failed: ${error.message}` }
  }
  return { ok: true, path }
}

/** Short-lived signed URL so only owner/admin eyes ever see the image. */
export async function getScreenshotUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(PAYMENT_BUCKET)
    .createSignedUrl(path, 300)
  if (error || !data) return null
  return data.signedUrl
}
