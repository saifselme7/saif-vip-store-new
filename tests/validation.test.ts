import { describe, it, expect } from 'vitest'
import {
  validateFullName,
  validateEmail,
  validatePhone,
  normalizePhone,
  validatePayerIdentifier,
  validateAmount,
  validateScreenshotFile,
  validateGovernorate,
  validateCity,
  validateAddress,
} from '../src/lib/validation'

describe('validateFullName', () => {
  it('accepts normal names', () => {
    expect(validateFullName('Saif Elme')).toBeUndefined()
    expect(validateFullName('Al')).toBeUndefined()
  })
  it('rejects single-character names', () => {
    expect(validateFullName('A')).toBeDefined()
  })
  it('rejects empty or short names', () => {
    expect(validateFullName('')).toBe('Full name is required')
    expect(validateFullName('   ')).toBe('Full name is required')
  })
})

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBeUndefined()
    expect(validateEmail('first.last+tag@domain.co')).toBeUndefined()
  })
  it('rejects invalid emails', () => {
    expect(validateEmail('')).toBe('Email is required')
    expect(validateEmail('not-an-email')).toBeDefined()
    expect(validateEmail('a@b')).toBeDefined()
    expect(validateEmail('a b@c.com')).toBeDefined()
  })
})

describe('validatePhone (Egyptian)', () => {
  it('accepts valid Egyptian mobile numbers', () => {
    expect(validatePhone('01012345678')).toBeUndefined()
    expect(validatePhone('01112345678')).toBeUndefined()
    expect(validatePhone('01212345678')).toBeUndefined()
    expect(validatePhone('01512345678')).toBeUndefined()
  })
  it('accepts numbers with spaces, dashes and prefixes', () => {
    expect(validatePhone('010 1234 5678')).toBeUndefined()
    expect(validatePhone('010-1234-5678')).toBeUndefined()
    expect(validatePhone('+201012345678')).toBeUndefined()
    expect(validatePhone('00201012345678')).toBeUndefined()
  })
  it('rejects invalid numbers', () => {
    expect(validatePhone('')).toBe('Phone number is required')
    expect(validatePhone('0101234567')).toBeDefined() // too short
    expect(validatePhone('010123456789')).toBeDefined() // too long
    expect(validatePhone('02112345678')).toBeDefined() // wrong prefix
    expect(validatePhone('abc')).toBeDefined()
  })
  it('normalizes phone numbers', () => {
    expect(normalizePhone('+20 010 1234 5678')).toBe('01012345678')
    expect(normalizePhone('00201012345678')).toBe('01012345678')
  })
})

describe('validatePayerIdentifier', () => {
  it('requires Egyptian mobile for Vodafone Cash', () => {
    expect(validatePayerIdentifier('01012345678', 'vodafone_cash')).toBeUndefined()
    expect(validatePayerIdentifier('user@insta', 'vodafone_cash')).toBeDefined()
    expect(validatePayerIdentifier('', 'vodafone_cash')).toBe('This field is required')
  })
  it('accepts phone or handle for InstaPay', () => {
    expect(validatePayerIdentifier('01012345678', 'instapay')).toBeUndefined()
    expect(validatePayerIdentifier('name@instapay', 'instapay')).toBeUndefined()
    expect(validatePayerIdentifier('acc.123-xyz', 'instapay')).toBeUndefined()
    expect(validatePayerIdentifier('no', 'instapay')).toBeDefined() // too short
    expect(validatePayerIdentifier('has spaces', 'instapay')).toBeDefined()
    expect(validatePayerIdentifier('bad!chars#', 'instapay')).toBeDefined()
  })
})

describe('validateAmount', () => {
  it('accepts valid amounts', () => {
    expect(validateAmount('100', 100)).toBeUndefined()
    expect(validateAmount(250.5, 300)).toBeUndefined()
  })
  it('rejects empty, zero, negative and NaN', () => {
    expect(validateAmount('', 100)).toBeDefined()
    expect(validateAmount('0', 100)).toBeDefined()
    expect(validateAmount('-5', 100)).toBeDefined()
    expect(validateAmount('abc', 100)).toBeDefined()
  })
  it('warns when far below the expected total', () => {
    expect(validateAmount('40', 100)).toBeDefined()
    expect(validateAmount('60', 100)).toBeUndefined() // >= 50% of expected
  })
})

describe('validateScreenshotFile', () => {
  const png = new File(['x'], 'shot.png', { type: 'image/png' })
  const big = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.png', { type: 'image/png' })
  const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' })

  it('accepts valid images', () => {
    expect(validateScreenshotFile(png)).toBeUndefined()
  })
  it('rejects oversized files', () => {
    expect(validateScreenshotFile(big)).toContain('smaller than')
  })
  it('rejects non-image types', () => {
    expect(validateScreenshotFile(pdf)).toContain('PNG, JPG')
  })
})

describe('delivery validation', () => {
  it('validates governorate, city and address', () => {
    expect(validateGovernorate('')).toBe('Select a governorate')
    expect(validateGovernorate('Cairo')).toBeUndefined()
    expect(validateCity('')).toBe('City / area is required')
    expect(validateCity('Nasr City')).toBeUndefined()
    expect(validateAddress('')).toBe('Address is required')
    expect(validateAddress('12 Abbas El Akkad')).toBeUndefined()
    expect(validateAddress('short')).toBe('Address is too short')
  })
})
