# tests/rules

Security-rules tests for `firestore.rules` and `storage.rules` (DESIGN.md §9, §13), plus invariants of
`firestore.indexes.json`. This is a standalone npm project with its own `package-lock.json`, not a workspace
(DESIGN.md §14 lists it as a workspace; it is standalone so it never races the root lockfile). It does not use
`@grouper/core`, so it does not need the root install.

```sh
npm ci --prefix tests/rules
# from the repo root; the emulators set FIRESTORE_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST
firebase emulators:exec --only firestore,storage --project demo-grouper "npm --prefix tests/rules test"
npm --prefix tests/rules run typecheck
npm --prefix tests/rules run validate:indexes   # firebase-tools' own deploy-time validator; needs `firebase` on PATH
```

Without the emulator variables the rules suites fail with the command to run. They load the real rules files from
the repo root and run one file at a time, because they share the `demo-grouper` emulator project.

## What is covered

- `firestore.test.ts`: owner-only reads of `users/{uid}` and every subcollection (interests, sensitiveInterests,
  pod cards, blocks, notices, exports), no collection-group reads; pods readable only by `memberUids` **and**
  `onb == true`, including queries; options and meetup-chat messages only through the parent pod's `memberUids`,
  lost at once when a member is removed; areas need `onb`;
  only `config/app` is public; every server-only collection of §8.2 (meet-again `pairSignals` included) is
  unreadable by any client (including
  docs whose id is the caller's uid); no client write of any kind anywhere (set, merge, update, delete, batch,
  transaction), tried as the most privileged client there is.
- `storage.test.ts`: uploads only as `uploads/{own uid}/pending.jpg` or `pending_256.jpg`, `image/jpeg`,
  under 2 MiB, create or overwrite only; photos readable by the owner or through
  `photoGrants/{owner}_{viewer}` (seeded with rules disabled), directional, revoked as soon as the grant doc
  is gone; exports owner-only; everything else denied.
- `indexes.test.ts`: the two vector indexes, the backfill composite, the collection-group indexes, the
  exempted large fields, and an unindexed `expiresAt` TTL policy for exactly the TTL'd collection groups
  (`messages`, the meetup chat, and `pairSignals` included; no review queue since D2).

## Notes

- The photo-grant check is a cross-service rule: the Storage emulator reads the grant doc from the Firestore
  emulator. firebase-tools 15.34.2 sends that internal request through `HTTPS_PROXY` when one is set (it
  ignores `NO_PROXY`), so behind a proxy the two tests that expect a grantee to read a photo fail while every
  denial still passes. CI runners have no proxy.
