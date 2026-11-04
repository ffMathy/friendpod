/**
 * Keeps Firestore's iOS offline cache out of iCloud and Finder backups (PRIVACY.md §5 "Device caches"), the iOS
 * counterpart of Android's `allowBackup: false`. The cache holds the user's sensitive interests and pod docs
 * (co-members' first names, which in a sensitive pod are Art. 9 data about them); a backup copy would outlive
 * sign-out, withdrawal and deletion. The Firebase iOS SDK keeps it under Library/Application Support/firestore;
 * expo-image's disk cache is under Library/Caches, which is never backed up.
 *
 * The on-device model (Documents/models, ~210 MB, D1) is excluded the same way: it is public data that can always be
 * downloaded again, so it has no business in the user's iCloud quota.
 *
 * Runs at every launch, before JavaScript can open Firestore: the flag on the directory covers everything the SDK
 * later creates inside it, and setting it again repairs a directory that was replaced.
 */
const { withAppDelegate } = require('expo/config-plugins');

const TAG = 'grouper-firestore-backup-exclusion';
const ANCHOR = /return\s+super\.application\(\s*application\s*,\s*didFinishLaunchingWithOptions:\s*launchOptions\s*\)/;

const SWIFT = [
  '    var excludedFromBackup = URLResourceValues()',
  '    excludedFromBackup.isExcludedFromBackup = true',
  '    var firestoreCache = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]',
  '      .appendingPathComponent("firestore", isDirectory: true)',
  '    try? FileManager.default.createDirectory(at: firestoreCache, withIntermediateDirectories: true)',
  '    try? firestoreCache.setResourceValues(excludedFromBackup)',
  '    var modelFiles = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]',
  '      .appendingPathComponent("models", isDirectory: true)',
  '    try? FileManager.default.createDirectory(at: modelFiles, withIntermediateDirectories: true)',
  '    try? modelFiles.setResourceValues(excludedFromBackup)',
].join('\n');

const BEGIN = `// @generated begin ${TAG}`;
const END = `// @generated end ${TAG}`;

/** Inserts the exclusion right above `return super.application(...)` in `didFinishLaunchingWithOptions`; idempotent. */
function addBackupExclusion(contents) {
  if (contents.includes(BEGIN)) return contents;
  const match = ANCHOR.exec(contents);
  // Failing the prebuild is safer than shipping a cache that iCloud backs up.
  if (!match) throw new Error(`${TAG}: no \`return super.application(...)\` in AppDelegate.swift`);
  const lineStart = contents.lastIndexOf('\n', match.index) + 1;
  return `${contents.slice(0, lineStart)}    ${BEGIN}\n${SWIFT}\n    ${END}\n${contents.slice(lineStart)}`;
}

function withFirestoreBackupExclusion(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') throw new Error(`${TAG}: expected a Swift AppDelegate`);
    mod.modResults.contents = addBackupExclusion(mod.modResults.contents);
    return mod;
  });
}

module.exports = withFirestoreBackupExclusion;
module.exports.addBackupExclusion = addBackupExclusion;
