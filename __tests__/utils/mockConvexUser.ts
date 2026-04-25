/** Factory for creating test user objects that match the Convex auth shape. */

export interface MockUser {
  _id: string
  _creationTime: number
  email: string
  name: string | null
  emailVerified?: boolean
}

let _seq = 0

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  const n = ++_seq
  return {
    _id: `user_test_${n.toString().padStart(4, '0')}`,
    _creationTime: Date.now(),
    email: `user${n}@test.example`,
    name: `Test User ${n}`,
    emailVerified: true,
    ...overrides,
  }
}

export function resetUserSequence(): void {
  _seq = 0
}
