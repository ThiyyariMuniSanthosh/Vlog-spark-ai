/**
 * Firestore Security Rules Verification Spec (Dirty Dozen Payloads)
 * Documents expected PERMISSION_DENIED outcomes for adversarial operations.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; emailVerified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Project Create',
    operation: 'create',
    path: '/projects/proj_1',
    auth: null,
    payload: { ownerId: 'user_a', title: 'Test', topic: 'Test', platform: 'YouTube', language: 'English', status: 'draft' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Owner Spoofing on Create',
    operation: 'create',
    path: '/projects/proj_2',
    auth: { uid: 'user_a', emailVerified: true },
    payload: { ownerId: 'user_b', title: 'Spoofed', topic: 'Test', platform: 'YouTube', language: 'English', status: 'draft' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User Project Read',
    operation: 'get',
    path: '/projects/proj_owned_by_a',
    auth: { uid: 'user_b', emailVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unscoped Collection Scrape',
    operation: 'list',
    path: '/projects',
    auth: { uid: 'user_b', emailVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Ghost Field Injection',
    operation: 'create',
    path: '/projects/proj_3',
    auth: { uid: 'user_a', emailVerified: true },
    payload: { ownerId: 'user_a', title: 'Test', topic: 'Test', platform: 'YouTube', language: 'English', status: 'draft', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Immutable ownerId Transfer',
    operation: 'update',
    path: '/projects/proj_owned_by_a',
    auth: { uid: 'user_a', emailVerified: true },
    payload: { ownerId: 'user_b' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Client-Forged Timestamp',
    operation: 'create',
    path: '/projects/proj_4',
    auth: { uid: 'user_a', emailVerified: true },
    payload: { ownerId: 'user_a', title: 'Test', topic: 'Test', platform: 'YouTube', language: 'English', status: 'draft', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning Attack',
    operation: 'create',
    path: '/projects/bad$id..invalid',
    auth: { uid: 'user_a', emailVerified: true },
    payload: { ownerId: 'user_a', title: 'Test', topic: 'Test', platform: 'YouTube', language: 'English', status: 'draft' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Value Poisoning on Update',
    operation: 'update',
    path: '/projects/proj_owned_by_a',
    auth: { uid: 'user_a', emailVerified: true },
    payload: { title: 12345 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'PII Blanket Read on /users',
    operation: 'get',
    path: '/users/user_a',
    auth: { uid: 'user_b', emailVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/projects/proj_5',
    auth: { uid: 'user_a', emailVerified: false },
    payload: { ownerId: 'user_a', title: 'Test', topic: 'Test', platform: 'YouTube', language: 'English', status: 'draft' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unbounded Array Exhaustion',
    operation: 'update',
    path: '/projects/proj_owned_by_a',
    auth: { uid: 'user_a', emailVerified: true },
    payload: { scenes: new Array(80).fill({ id: 's' }) },
    expected: 'PERMISSION_DENIED',
  },
];
