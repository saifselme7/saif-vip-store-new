import { ACCEPTED_SCREENSHOT_TYPES, MAX_SCREENSHOT_SIZE_MB } from './constants'

export interface FieldErrors {
  [key: string]: string | undefined
}

export function validateFullName(name: string): string | undefined {
  const v = name.trim()
  if (!v) return 'Full name is required'
  if (v.length < 2) return 'Name is too short'
  if (v.length > 80) return 'Name is too long'
  return undefined
}

export function validateEmail(email: string): string | undefined {
  const v = email.trim()
  if (!v) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email address'
  return undefined
}

/** Egyptian mobile: 11 digits starting with 01 (accepts +20 / 0020 prefixes). */
export function validatePhone(phone: string): string | undefined {
  const v = phone.replace(/[\s-]/g, '')
  if (!v) return 'Phone number is required'
  const normalized = normalizePhone(v)
  if (!/^01[0-9]{9}$/.test(normalized)) return 'Enter a valid Egyptian phone number (e.g. 01012345678)'
  return undefined
}

export function normalizePhone(phone: string): string {
  let v = phone.replace(/[\s-]/g, '')
  v = v.replace(/^(\+20|0020)/, '')
  if (!v.startsWith('0')) v = `0${v}`
  return v
}

/** Payer identifier: Vodafone requires an Egyptian mobile, InstaPay accepts phone or handle. */
export function validatePayerIdentifier(identifier: string, method: 'instapay' | 'vodafone_cash'): string | undefined {
  const v = identifier.trim()
  if (!v) return 'This field is required'
  if (method === 'vodafone_cash') {
    return validatePhone(v)
  }
  if (!/^[0-9A-Za-z@._\-]{6,40}$/.test(v)) {
    return 'Enter the phone number or account identifier you paid from'
  }
  return undefined
}

export function validateAmount(amount: string | number, expected?: number): string | undefined {
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (amount === '' || Number.isNaN(n)) return 'Enter the transferred amount'
  if (n <= 0) return 'Amount must be greater than zero'
  if (n > 1_000_000) return 'Amount looks too large'
  if (expected !== undefined && n < expected * 0.5) return 'This looks much lower than the order total — please double-check'
  return undefined
}

export function validateScreenshotFile(file: File): string | undefined {
  if (!ACCEPTED_SCREENSHOT_TYPES.includes(file.type)) {
    return 'Screenshot must be a PNG, JPG or WEBP image'
  }
  if (file.size > MAX_SCREENSHOT_SIZE_MB * 1024 * 1024) {
    return `Image must be smaller than ${MAX_SCREENSHOT_SIZE_MB}MB`
  }
  return undefined
}

export function validateAddress(address: string): string | undefined {
  const v = address.trim()
  if (!v) return 'Address is required'
  if (v.length < 6) return 'Address is too short'
  return undefined
}

export function validateCity(city: string): string | undefined {
  const v = city.trim()
  if (!v) return 'City / area is required'
  return undefined
}

export function validateGovernorate(governorate: string): string | undefined {
  if (!governorate) return 'Select a governorate'
  return undefined
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required'
  if (password.length < 6) return 'Password must be at least 6 characters'
  return undefined
}
