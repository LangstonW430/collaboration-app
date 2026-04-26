import { describe, it, expect } from 'vitest'
import { formatAuthError } from '@/lib/services/authService'

describe('formatAuthError', () => {
  it('returns a generic message for non-Error values', () => {
    expect(formatAuthError('string error')).toBe('An unexpected error occurred')
    expect(formatAuthError(42)).toBe('An unexpected error occurred')
    expect(formatAuthError(null)).toBe('An unexpected error occurred')
    expect(formatAuthError(undefined)).toBe('An unexpected error occurred')
    expect(formatAuthError({ message: 'obj' })).toBe('An unexpected error occurred')
  })

  it('maps "invalid password" to friendly message', () => {
    expect(formatAuthError(new Error('Invalid password'))).toBe('Incorrect email or password')
  })

  it('maps "wrong password" to friendly message', () => {
    expect(formatAuthError(new Error('wrong password provided'))).toBe('Incorrect email or password')
  })

  it('maps "user not found" to friendly message', () => {
    expect(formatAuthError(new Error('User not found'))).toBe('No account found with that email')
  })

  it('maps "no account" to friendly message', () => {
    expect(formatAuthError(new Error('No account exists'))).toBe('No account found with that email')
  })

  it('maps "already exists" to friendly message', () => {
    expect(formatAuthError(new Error('Account already exists'))).toBe(
      'An account with this email already exists'
    )
  })

  it('maps "email taken" to friendly message', () => {
    expect(formatAuthError(new Error('email taken'))).toBe(
      'An account with this email already exists'
    )
  })

  it('maps network errors to friendly message', () => {
    expect(formatAuthError(new Error('network failure'))).toBe(
      'Network error — please check your connection'
    )
    expect(formatAuthError(new Error('Failed to fetch'))).toBe(
      'Network error — please check your connection'
    )
  })

  it('returns the raw message for unclassified errors', () => {
    const msg = 'Something completely unexpected happened'
    expect(formatAuthError(new Error(msg))).toBe(msg)
  })
})
