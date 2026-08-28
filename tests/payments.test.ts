import { describe, it, expect } from 'vitest'
import { CUSTOMER_CAN_RESUBMIT, isPaymentPendingStatus, getPaymentInstructions } from '../src/lib/payments'
import { PAYMENT_METHOD_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../src/lib/constants'
import type { OrderStatus, PaymentStatus } from '../src/types'

describe('payment state transitions (client-side guards)', () => {
  it('allows customer resubmission only before approval', () => {
    expect(CUSTOMER_CAN_RESUBMIT).toContain('awaiting_payment')
    expect(CUSTOMER_CAN_RESUBMIT).toContain('rejected')
    expect(CUSTOMER_CAN_RESUBMIT).not.toContain('approved')
    expect(CUSTOMER_CAN_RESUBMIT).not.toContain('under_review')
    expect(CUSTOMER_CAN_RESUBMIT).not.toContain('cancelled')
  })

  it('treats awaiting/submitted/under_review as pending states', () => {
    expect(isPaymentPendingStatus('awaiting_payment')).toBe(true)
    expect(isPaymentPendingStatus('payment_submitted')).toBe(true)
    expect(isPaymentPendingStatus('under_review')).toBe(true)
    expect(isPaymentPendingStatus('approved')).toBe(false)
    expect(isPaymentPendingStatus('rejected')).toBe(false)
    expect(isPaymentPendingStatus('cancelled')).toBe(false)
    expect(isPaymentPendingStatus(null)).toBe(false)
    expect(isPaymentPendingStatus(undefined)).toBe(false)
  })
})

describe('payment instructions', () => {
  it('shows the receiving number for both methods', () => {
    const insta = getPaymentInstructions('instapay', '01040324811')
    const vf = getPaymentInstructions('vodafone_cash', '01040324811')
    expect(insta.join(' ')).toContain('01040324811')
    expect(vf.join(' ')).toContain('01040324811')
  })

  it('mentions the screenshot step for both methods', () => {
    expect(getPaymentInstructions('instapay', '01040324811').join(' ')).toContain('creenshot')
    expect(getPaymentInstructions('vodafone_cash', '01040324811').join(' ')).toContain('creenshot')
  })

  it('gives method-specific guidance', () => {
    expect(getPaymentInstructions('instapay', '01040324811').join(' ')).toContain('InstaPay')
    expect(getPaymentInstructions('vodafone_cash', '01040324811').join(' ')).toContain('Vodafone Cash')
  })
})

describe('status label maps', () => {
  it('covers every order status', () => {
    const statuses: OrderStatus[] = [
      'pending',
      'payment_review',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'completed',
      'cancelled',
      'refunded',
    ]
    for (const s of statuses) {
      expect(ORDER_STATUS_LABELS[s]).toBeTruthy()
    }
  })

  it('covers every payment status', () => {
    const statuses: PaymentStatus[] = [
      'awaiting_payment',
      'payment_submitted',
      'under_review',
      'approved',
      'rejected',
      'cancelled',
    ]
    for (const s of statuses) {
      expect(PAYMENT_STATUS_LABELS[s]).toBeTruthy()
    }
  })

  it('labels payment methods', () => {
    expect(PAYMENT_METHOD_LABELS.instapay).toBe('InstaPay')
    expect(PAYMENT_METHOD_LABELS.vodafone_cash).toBe('Vodafone Cash')
  })
})
