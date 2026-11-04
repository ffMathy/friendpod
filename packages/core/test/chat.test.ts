import { describe, expect, it } from 'vitest';
import { checkChatText } from '../src/chat/moderation';
import { APP_ERRORS } from '../src/errors';
import { isBlocklisted, leetFold } from '../src/interests/blocklist';
import { foldDigits } from '../src/interests/pii';
import { checkAboutMe } from '../src/profile/aboutMe';

const before = { beforeMeetup: true } as const;
const after = { beforeMeetup: false } as const;
const WARN = { ok: true, warning: 'CONTACT_INFO_BEFORE_MEETUP' } as const;

describe('blocklist (§5.2 (2))', () => {
  it('blocks starter-list tokens and phrases on a leetspeak-folded copy', () => {
    expect(leetFold('3sc0rt')).toBe('escort');
    expect(isBlocklisted('3sc0rt')).toBe(true);
    expect(isBlocklisted('looking for a sugar daddy')).toBe(true);
    expect(isBlocklisted('køb hash her')).toBe(true);
  });

  it('lets recovery and support wording through', () => {
    expect(isBlocklisted('anonyme alkoholikere')).toBe(false);
    expect(isBlocklisted('recovering from cocaine addiction')).toBe(false);
    expect(isBlocklisted('sugar and spice')).toBe(false);
  });

  it('refuses ambiguous words in tags, but in chat only within a blocked phrase', () => {
    expect(isBlocklisted('escort')).toBe(true);
    expect(isBlocklisted('knald')).toBe(true);
    expect(isBlocklisted('i can escort you from the bus stop', 'chat')).toBe(false);
    expect(isBlocklisted('det bliver et knald godt grin', 'chat')).toBe(false);
    expect(isBlocklisted('ring til en escort service', 'chat')).toBe(true);
    expect(isBlocklisted('søger knald i aften', 'chat')).toBe(true);
    expect(isBlocklisted('min 0nlyfans', 'chat')).toBe(true);
  });
});

describe('foldDigits', () => {
  it('maps the decimal digits of every script to ASCII', () => {
    expect(foldDigits('٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹ ०१२ ๙')).toBe('0123456789 0123456789 012 9');
    // Mathematical digits are one run of five 0–9 sets.
    expect(foldDigits('\u{1D7CE}\u{1D7D7}\u{1D7D8}\u{1D7E1}\u{1D7FF}')).toBe('09099');
    expect(foldDigits('kl. 19:30, bord 12')).toBe('kl. 19:30, bord 12');
  });
});

describe('checkChatText (meetup chat)', () => {
  it.each([
    ['phone', 'ring mig på 20 30 40 50'],
    ['phone', '+45 12345678'],
    ['email', 'skriv til anna@example.dk'],
    ['handle', 'find mig på @anna_k'],
    ['handle', 'insta: anna.k'],
    ['url', 'se https://example.com/os'],
    ['url', 'vi er på madklub.dk'],
    ['non-https map link', 'http://maps.apple.com/?q=Aarhus'],
    ['look-alike map host', 'https://maps.apple.com.evil.example/x'],
    ['handle without a colon', 'Add me on snap annak92'],
    ['handle without a colon', 'skriv på insta anna.k92'],
    ['handle after an invitation', 'add me on snap annak'],
    ['phone in Arabic-Indic digits', 'Ring på ٢٠٣٠٤٠٥٠'],
    ['phone in Persian digits', 'ring på ۲۰۳۰۴۰۵۰'],
    ['phone written with dots', 'ring 20.30.40.50'],
    ['phone that starts like a time', 'ring 20.30 40.50'],
    ['phone next to a time', 'Jeg er der 18.30, ring 2030 4050'],
  ])('warns about a %s before the meetup and allows it after: %j', (_kind, text) => {
    expect(checkChatText(text, before)).toEqual(WARN);
    expect(checkChatText(text, after)).toEqual({ ok: true });
  });

  it.each([
    'Jeg er der om 10 min, står ved indgangen',
    'Running 5 minutes late, sorry!',
    'Bord 12 på 2. sal',
    'Vi ses kl. 19:30 🙂',
    'Bordet er booket 18.30-21.00',
    'Vi mødes kl. 18.30-20.00',
    'Vi ses lørdag 14.11.2026',
    'Vi ses 14.11. 13.00',
    'Vi ses 2026-11-14 kl 18:30',
    'Tak.Se jer snart',
    'I can escort you from the bus stop',
    'Det bliver et knald godt grin',
    'Signal er dårlig her',
    'Jeg er på discord hele dagen',
  ])('passes ordinary chat before the meetup: %j', (text) => {
    expect(checkChatText(text, before)).toEqual({ ok: true });
  });

  it.each([
    'Her er stedet: https://maps.app.goo.gl/Xy12AbCd',
    'https://www.google.com/maps/place/Dokk1/@56.1532815,10.2125318,17z/data=!3m1!4b1',
    'Vi mødes her (https://www.openstreetmap.org/#map=17/56.15328/10.21253).',
    'HTTPS://MAPS.APPLE.COM/?ll=56.1533,10.2125&q=Dokk1',
  ])('allows an allowlisted map link before the meetup: %j', (text) => {
    expect(checkChatText(text, before)).toEqual({ ok: true });
  });

  it('still warns about contact details next to a map link', () => {
    expect(checkChatText('https://maps.app.goo.gl/Xy12AbCd ring 20 30 40 50', before)).toEqual(WARN);
    expect(checkChatText('https://maps.app.goo.gl/Xy12AbCd eller https://example.com', before)).toEqual(WARN);
  });

  it.each([
    '010190-1234',
    'mit cpr er 0101901234',
    '010190​-1234',
    'https://maps.apple.com/?q=010190-1234',
    // An earlier 10-digit run that is not a date must not hide the CPR number after it.
    'Min tlf er +4520304050. Til lejekontrakten: 010190-1234',
    'Booking 1234567890, mit cpr er 010190-1234',
    'cpr ٠١٠١٩٠-١٢٣٤',
    '۰۱۰۱۹۰۱۲۳۴',
  ])('always rejects a CPR number: %j', (text) => {
    expect(checkChatText(text, before)).toEqual({ ok: false, code: 'PII_CPR' });
    expect(checkChatText(text, after)).toEqual({ ok: false, code: 'PII_CPR' });
  });

  it.each(['Sugar Daddy søges', 'f0llow my 0nlyfans', 'onlyf​ans', 'https://maps.apple.com/?q=onlyfans', 'Escort service'])(
    'always rejects blocklisted text: %j',
    (text) => {
      expect(checkChatText(text, before)).toEqual({ ok: false, code: 'BLOCKLIST' });
      expect(checkChatText(text, after)).toEqual({ ok: false, code: 'BLOCKLIST' });
    },
  );

  it('rejects with app error codes the client can localise', () => {
    expect(APP_ERRORS.PII_CPR).toBe('invalid-argument');
    expect(APP_ERRORS.BLOCKLIST).toBe('invalid-argument');
    expect(APP_ERRORS.CONTACT_INFO_BEFORE_MEETUP).toBeDefined();
  });
});

describe('"about me" moderation (D4)', () => {
  it('refuses contact details outright and blocklisted text; lets an ordinary sentence through', () => {
    expect(checkAboutMe('Elsker kaffe, brætspil og lange gåture langs vandet.')).toEqual({ ok: true });
    expect(checkAboutMe('Skriv på 12 34 56 78')).toEqual({ ok: false, code: 'CONTACT_INFO' });
    expect(checkAboutMe('anna@example.dk')).toEqual({ ok: false, code: 'CONTACT_INFO' });
    expect(checkAboutMe('add me on snap annak92')).toEqual({ ok: false, code: 'CONTACT_INFO' });
    expect(checkAboutMe('looking for a sugar daddy')).toEqual({ ok: false, code: 'BLOCKLIST' });
  });

  it('refuses a street address and handles or links that findPii alone misses', () => {
    for (const text of [
      'Jeg bor på Vestergade 12, 2. tv, 8000 Aarhus C',
      'Bor på Nørrebrogade 4b.',
      'Kig forbi nr. 12, st. th',
      'I live at 12 Baker Street',
      'Ring på hos os, 8000 Aarhus',
      'discord annak#1234',
      'linktr.ee/annak',
      'find me on bsky annak.bsky.social',
    ]) {
      expect(checkAboutMe(text), text).toEqual({ ok: false, code: 'CONTACT_INFO' });
    }
    for (const text of [
      'Løber på Strandvejen 5 dage om ugen, bl.a. med hunden.',
      'Ny i Aarhus siden 2024 og glad for o.s.v. lange gåture',
      'I run 5 km down the road most mornings',
      'Spiller discord-spil og strikker',
    ]) {
      expect(checkAboutMe(text), text).toEqual({ ok: true });
    }
  });
});
