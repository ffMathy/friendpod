import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import withFirestoreBackupExclusion from '../plugins/withFirestoreBackupExclusion';

// The AppDelegate.swift that `expo prebuild` generates for SDK 58 (expo-template-bare-minimum 58.0.32).
const TEMPLATE = readFileSync(join(__dirname, 'fixtures', 'AppDelegate.sdk58.swift'), 'utf8');
const { addBackupExclusion } = withFirestoreBackupExclusion;

describe('Firestore backup exclusion (iOS, PRIVACY.md §5)', () => {
  it('flags the Firestore cache directory before React Native starts, once', () => {
    const out = addBackupExclusion(TEMPLATE);
    const exclusion = out.indexOf('excludedFromBackup.isExcludedFromBackup = true');
    expect(exclusion).toBeGreaterThan(out.indexOf('didFinishLaunchingWithOptions launchOptions'));
    expect(exclusion).toBeLessThan(out.indexOf('return super.application(application, didFinishLaunchingWithOptions: launchOptions)'));
    expect(out).toContain('.applicationSupportDirectory');
    expect(out).toContain('appendingPathComponent("firestore", isDirectory: true)');
    expect(addBackupExclusion(out)).toBe(out);
  });

  it('fails the prebuild instead of silently skipping when the template changes', () => {
    expect(() => addBackupExclusion(TEMPLATE.replace(/return super\.application[^\n]*/, 'return true'))).toThrow(/AppDelegate/);
  });
});
