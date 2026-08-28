import { supabase } from './supabase'
import { ACCEPTED_SCREENSHOT_TYPES, MAX_SCREENSHOT_SIZE_MB, PAYMENT_METHOD_LABELS } from './constants'
import { validateScreenshotFile } from './validation'
import type { PaymentMethod, PaymentStatus } from '@/types'

export const PAYMENT_BUCKET = 'payment-screenshots'
export const PRODUCT_IMAGES_BUCKET = 'product-images'

export function getPaymentInstructions(method: PaymentMethod, receivingNumber: string) {
  if (method === 'instapay') {
    return [
      `Open your bank app or InstaPay app and send the exact total to ${receivingNumber}.`,
      'Take a screenshot of the successful transfer confirmation.',
      'Upload the screenshot below and enter the number / account you paid from.',
    ]
  }
  return [
    `Open the Vodafone Cash app or visit any Vodafone Cash agent and send the exact total to ${receivingNumber}.`,
    'Take a screenshot of the confirmation SMS or the app receipt.',
    'Upload the screenshot below and enter the Vodafone number you paid from.',
  ]
}

export interface UploadResult {
  path: string
  error?: string
}

/**
 * Uploads a payment screenshot to the customer's private folder in
 * Supabase Storage. Returns the storage path to store on the payment row.
 */
export async function uploadPaymentScreenshot(
  userId: string,
  file: File,
  orderId: string,
  onProgress?: (progress: number) => void,
): Promise<UploadResult> {
  const fileError = validateScreenshotFile(file)
  if (fileError) return { path: '', error: fileError }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png'
  const path = `${userId}/${orderId}-${Date.now()}.${safeExt}`

  onProgress?.(10)

  const { error } = await supabase.storage
    .from(PAYMENT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (error) {
    return { path: '', error: friendlyUploadError(error) }
  }

  onProgress?.(100)
  return { path }
}

function friendlyUploadError(error: { message?: string }): string {
  const msg = error.message || ''
  if (msg.includes('exceeded the maximum allowed size') || msg.includes('size')) {
    return `Image is too large (max ${MAX_SCREENSHOT_SIZE_MB}MB)`
  }
  if (msg.includes('mime') || msg.includes('type')) {
    return 'This file type is not accepted. Use PNG, JPG or WEBP.'
  }
  if (msg.includes('row-level security') || msg.includes('Unauthorized')) {
    return 'Upload permission denied. Please sign in again and retry.'
  }
  return 'Upload failed — please check your connection and try again.'
}

export function validateScreenshotType(file: File): boolean {
  return ACCEPTED_SCREENSHOT_TYPES.includes(file.type)
}

/** Signed URL for viewing a private payment screenshot. */
export async function createScreenshotSignedUrl(path: string, expiresIn = 300): Promise<string | null> {
  const { data } = await supabase.storage.from(PAYMENT_BUCKET).createSignedUrl(path, expiresIn)
  return data?.signedUrl ?? null
}

export function paymentMethodLabel(method: PaymentMethod | null | undefined) {
  if (!method) return '—'
  return PAYMENT_METHOD_LABELS[method]
}

/** UI-level transitions (server enforces the real rules). */
export const CUSTOMER_CAN_RESUBMIT: PaymentStatus[] = ['awaiting_payment', 'rejected']

export function isPaymentPendingStatus(status: PaymentStatus | null | undefined): boolean {
  return status === 'awaiting_payment' || status === 'under_review' || status === 'payment_submitted'
}
