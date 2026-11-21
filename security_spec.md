# VlogSpark AI 2.0 — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every `/projects/{projectId}` document belongs to exactly one `ownerId` (`request.auth.uid`). No other signed-in user may read, list, update, or delete another creator's project.
2. **PII Isolation**: `/users/{userId}` stores email and creator preferences; `get`, `create`, `update`, and `delete` are strictly limited to `request.auth.uid == userId`. Collection `list` on `/users` is denied.
3. **Subcollection Master Gate**: `/users/{userId}/activities/{activityId}` checks parent user document existence and enforces `userId == request.auth.uid` on both path and payload.
4. **Immutable Ownership & Creation Time**: `ownerId`, `uid`, and `createdAt` can never be mutated after creation. Timestamps must equal `request.time`.
5. **Bounded Payload & Array Limits**: Every string has explicit `.size()` bounds and every list (`speakingGuide`, `scenes`, `exports`) is strictly bounded to prevent resource exhaustion.
6. **Verified Auth Mandate**: Write operations require authenticated users with `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Project Create**: Anonymous caller tries to create `/projects/p1`. Expected: `PERMISSION_DENIED`.
2. **Owner Spoofing on Create**: User A tries to create `/projects/p2` with `ownerId: "user_b"`. Expected: `PERMISSION_DENIED`.
3. **Cross-User Project Read**: User B tries to `get` `/projects/p1` owned by User A. Expected: `PERMISSION_DENIED`.
4. **Unscoped Collection Scrape (`list`)**: User B tries to list `/projects` without `where("ownerId", "==", userB)`. Expected: `PERMISSION_DENIED`.
5. **Shadow Ghost Field Injection**: User A creates `/projects/p3` with extra field `isAdmin: true`. Expected: `PERMISSION_DENIED`.
6. **Immutable `ownerId` Transfer**: User A tries to update `/projects/p1` changing `ownerId` to `"user_b"`. Expected: `PERMISSION_DENIED`.
7. **Client-Forged Timestamp**: User A creates `/projects/p4` with `createdAt` set to a client-chosen Date instead of `serverTimestamp()`. Expected: `PERMISSION_DENIED`.
8. **ID Poisoning Attack**: User A tries to create `/projects/bad$id..with..invalidchars` or a 300-char ID. Expected: `PERMISSION_DENIED`.
9. **Value Poisoning on Update**: User A updates `title` on `/projects/p1` to a number `12345` or 500-char string. Expected: `PERMISSION_DENIED`.
10. **PII Blanket Read on `/users`**: User B attempts `get` on `/users/user_a` or `list` on `/users`. Expected: `PERMISSION_DENIED`.
11. **Unverified Email Write**: Authenticated user with `email_verified: false` tries to create a project. Expected: `PERMISSION_DENIED`.
12. **Unbounded Array Exhaustion**: User A submits `scenes` array with 80 elements (exceeding max 50). Expected: `PERMISSION_DENIED`.
