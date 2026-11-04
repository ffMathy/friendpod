import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalLegalText, fillTag, genderConsentText, getLegalText, LEGAL_TEXTS, type LegalText } from '../src/legal/consent-texts';
import { consentProofFor, isValidConsentProof, LEGAL_TEXT_SHA256 } from '../src/legal/hashes';

const PRIVACY = readFileSync(fileURLToPath(new URL('../../../docs/PRIVACY.md', import.meta.url)), 'utf8');
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** Every copy fragment of a text, for the comparison with PRIVACY.md. */
function fragments(t: LegalText): string[] {
  switch (t.kind) {
    case 'art9Consent': {
      const c = t.content;
      return [c.title, c.intro, c.listIntro, ...c.bullets, c.note.label, c.note.text, c.withdrawal, c.checkbox, c.addButton, c.dontAddButton, c.readMore];
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

  it('lock the SHA-256 of every unfilled template', () => {
    // Changing any wording must change the version id; update both tables only together.
    expect(LEGAL_TEXT_SHA256).toEqual({
      'art9-tag-en-v1': 'c61666e57897b3e51186c67c4fd2d9a1b0984f4cc1621ed4b28090db85585c5c',
      'art9-tag-da-v1': '0e4f91d75744d38f8a0bfac0c339e5662518c4ca48c46823cd302d671fe1a0cb',
      'gender-en-v1': '1dee9a6f14751e78b3421d9709df1407cd0454e12386429bd29fcb7d1e077004',
      'gender-nonbinary-en-v1': '5749af3c6bd3faff814fddd802af9d84031fe343474fbe33776296d17e59a44c',
      'gender-da-v1': 'e10d655e35efbb81bb67d79b4122d92f0cc8b69d42f8881e4b39868576f19974',
      'interest-notice-en-v1': 'b6840ae41002dc8f0f435036dc7c3ec8893aea7e3bce85a291d19a43e29b5d80',
      'interest-notice-da-v1': '112c7c125ca91b74d5c608fea7a167d01304009fc28fb5eec38224b9ab46f058',
      'art9-withdraw-en-v1': '82ee0a12f3f3fb170eaf777ec15d5f8fab1526f2e911a2602f4ccd1bdfac1f70',
      'art9-withdraw-da-v1': '8bf1aaff1fa65806928c8efd44e733fa330aa6bd9af6559e27c5965e1a57aa44',
    });
    for (const t of LEGAL_TEXTS) expect(sha256(canonicalLegalText(t)), t.id).toBe(LEGAL_TEXT_SHA256[t.id]);
  });

  it('hash the template, not the tag', () => {
    const t = getLegalText('art9-tag-en-v1')!;
    const canonical = canonicalLegalText(t);
    expect(canonical).toContain('"{tag}"');
    expect(fillTag(canonical, 'gravid')).toContain('"gravid" may reveal');
    expect(fillTag(canonical, 'gravid')).not.toContain('{tag}');
  });

  it('validate consent proofs against known pairs and the expected scope', () => {
    expect(isValidConsentProof(consentProofFor('art9-tag-da-v1'), 'art9')).toBe(true);
    expect(isValidConsentProof(consentProofFor('gender-en-v1'), 'gender')).toBe(true);
    expect(isValidConsentProof(consentProofFor('gender-en-v1'), 'art9')).toBe(false);
    expect(isValidConsentProof(consentProofFor('interest-notice-en-v1'), 'art9')).toBe(false);
    expect(isValidConsentProof({ textVersion: 'art9-tag-en-v1', textSha256: LEGAL_TEXT_SHA256['art9-tag-da-v1'] }, 'art9')).toBe(false);
    expect(isValidConsentProof({ textVersion: 'art9-tag-en-v9', textSha256: '0'.repeat(64) }, 'art9')).toBe(false);
  });

  it('has no Danish non-binary addendum yet (PRIVACY.md gap)', () => {
    expect(genderConsentText('en', true)?.id).toBe('gender-nonbinary-en-v1');
    expect(genderConsentText('da', false)?.id).toBe('gender-da-v1');
    expect(genderConsentText('da', true)).toBeNull();
  });
});
