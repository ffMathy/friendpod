import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalLegalText, currentLegalText, genderConsentText, LEGAL_TEXTS, type LegalText } from '../src/legal/consent-texts';
import { consentProofFor, isValidArt9ConsentProof, isValidConsentProof, LEGAL_TEXT_SHA256 } from '../src/legal/hashes';

const PRIVACY = readFileSync(fileURLToPath(new URL('../../../docs/PRIVACY.md', import.meta.url)), 'utf8');
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** Every copy fragment of a text, for the comparison with PRIVACY.md. */
function fragments(t: LegalText): string[] {
  switch (t.kind) {
    case 'art9Blanket': {
      const c = t.content;
      return [c.title, c.intro, c.listIntro, ...c.bullets, c.note.label, c.note.text, c.override, c.withdrawal, c.checkbox, c.agreeButton, c.notNowButton, c.readMore];
    }
    case 'genderConsent':
      return [t.content.body, t.content.checkbox, ...(t.content.nonbinaryAddendum ? [t.content.nonbinaryAddendum] : [])];
    default:
      return [t.content.text];
  }
}

describe('consent texts (PRIVACY.md §3.2, §3.3, §3.5, §3.6)', () => {
  it('are verbatim copies of PRIVACY.md', () => {
    for (const t of LEGAL_TEXTS) {
      for (const f of fragments(t)) expect(PRIVACY, `${t.id}: ${f.slice(0, 40)}…`).toContain(f);
    }
  });

  it('lock the SHA-256 of every text', () => {
    // Changing any wording must change the version id; update both tables only together.
    // 2026-11-04 (D3): the per-tag texts (art9-tag-*-v1, interest-notice-*-v1, art9-withdraw-*-v1) were replaced by
    // the blanket consent before anything shipped, so no consent event records them.
    // 2026-11-09: the app was renamed Grouper → Friendpod. The texts naming it (art9-blanket-*, gender-*,
    // art9-withdraw-all-*) moved from v1 to v2 with only the brand name changed; v1 never shipped, so it was dropped.
    expect(LEGAL_TEXT_SHA256).toEqual({
      'art9-blanket-en-v2': '6d0512a9a8ed7cfe833009eb80a2fcc97eac46f953ed85b3c395ae5156c4e333',
      'art9-blanket-da-v2': 'ecedcf6f82c44b5c41ce2d9c3bdb41f02efde144b4873b5dfa30258fbf0e63b4',
      'gender-en-v2': 'ed1ade304a997b76ceee079c40e445676c0f86056e4332ffeb81bcfa70ac1cf7',
      'gender-nonbinary-en-v2': '0196877153642c2063fb35d9d085e8971daecf373567f950fd4090662f955ef4',
      'gender-da-v2': 'bd4a5a330585f92cfd1aef52185ce45b554ae6e132a979dcaad837628e3fd4a6',
      'interest-notice-en-v2': '596f74a7aaaa5f702483d7c474b68cf41cecfcf3e5d9308c251c76c93f36385c',
      'interest-notice-da-v2': 'b63d67b68971a7a3d2166b15fc69b000928d0dfe9e58e7619be8d43d69bcf3d0',
      'art9-withdraw-all-en-v2': '44aeb4488c24a37bc3679de8082cc3a5eb704a8a710f7f907ea3d7c893c77e15',
      'art9-withdraw-all-da-v2': 'df108230ba9c2ad09e0deba51e03c12827d5fe3856f8d630b0c07dcdc4a1c465',
    });
    for (const t of LEGAL_TEXTS) expect(sha256(canonicalLegalText(t)), t.id).toBe(LEGAL_TEXT_SHA256[t.id]);
  });

  it('name every purpose of the blanket Art. 9 consent in both languages (D3)', () => {
    const en = canonicalLegalText(currentLegalText('art9Blanket', 'en'));
    for (const f of ['on your phone', 'automated matching', "pod's theme only", 'meetup chat', 'Settings → Privacy', 'cannot rule it out', "This isn't sensitive for me", 'Keep this private']) {
      expect(en, f).toContain(f);
    }
    const da = canonicalLegalText(currentLegalText('art9Blanket', 'da'));
    for (const f of ['på din telefon', 'automatisk matchning', 'podens tema', 'mødechat', 'Indstillinger → Privatliv', 'kan ikke udelukke', 'Den er ikke følsom for mig', 'Hold den privat']) {
      expect(da, f).toContain(f);
    }
    // One consent for all interests: no per-tag placeholder survives anywhere.
    for (const t of LEGAL_TEXTS) expect(canonicalLegalText(t), t.id).not.toContain('{tag}');
  });

  it('validate consent proofs against known pairs and the expected scope', () => {
    expect(isValidConsentProof(consentProofFor('art9-blanket-da-v2'), 'art9')).toBe(true);
    expect(isValidConsentProof(consentProofFor('gender-en-v2'), 'gender')).toBe(true);
    expect(isValidConsentProof(consentProofFor('gender-en-v2'), 'art9')).toBe(false);
    expect(isValidConsentProof(consentProofFor('interest-notice-en-v2'), 'art9')).toBe(false);
    expect(isValidConsentProof({ textVersion: 'art9-blanket-en-v2', textSha256: LEGAL_TEXT_SHA256['art9-blanket-da-v2'] }, 'art9')).toBe(false);
    expect(isValidConsentProof({ textVersion: 'art9-tag-en-v1', textSha256: 'd5458e681a1a5afc4f8be9d5576a415b095ea0a5653e5bfb2dd611f6c1b7b843' }, 'art9')).toBe(false);
    expect(isValidArt9ConsentProof(consentProofFor('art9-blanket-en-v2'))).toBe(true);
    expect(isValidArt9ConsentProof(consentProofFor('gender-da-v2'))).toBe(false);
    expect(isValidArt9ConsentProof(consentProofFor('art9-withdraw-all-en-v2'))).toBe(false);
  });

  it('has no Danish non-binary addendum yet (PRIVACY.md gap)', () => {
    expect(genderConsentText('en', true)?.id).toBe('gender-nonbinary-en-v2');
    expect(genderConsentText('da', false)?.id).toBe('gender-da-v2');
    expect(genderConsentText('da', true)).toBeNull();
  });
});
