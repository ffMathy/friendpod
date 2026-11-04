import { describe, expect, it } from 'vitest';
import { ART9_LEXICON, lexiconCheck } from '../src/interests/lexicon';
import { normalizeTag } from '../src/interests/normalize';
import { detectThirdParty } from '../src/interests/thirdParty';

const check = (text: string) => {
  const r = normalizeTag(text);
  if (!r.ok) throw new Error(`not a tag: ${text}`);
  return lexiconCheck(r.norm);
};

describe('Art. 9 lexicon (§5.2 (0), (5) row 2)', () => {
  it.each([
    ['3F', 'tradeUnion'],
    ['HK', 'tradeUnion'],
    ['FOA', 'tradeUnion'],
    ['Dansk Metal', 'tradeUnion'],
    ['Fagforeningsarbejde', 'tradeUnion'],
    ['tillidsrepræsentant', 'tradeUnion'],
    ['Enhedslisten', 'politics'],
    ['Socialdemokratiet', 'politics'],
    ['Radikale Venstre', 'politics'],
    ['Venstre', 'politics'],
    ['SF', 'politics'],
    ['Liberal Alliance', 'politics'],
    ['Dansk Folkeparti', 'politics'],
    ['AA', 'health'],
    ['AA-møder', 'health'],
    ['Anonyme Alkoholikere', 'health'],
    ['IVF', 'health'],
    ['IVF-behandling', 'health'],
    ['Gravid', 'health'],
    ['førstegangsgravid', 'health'],
    ['Pregnant', 'health'],
    ['type 1 diabetes', 'health'],
    ['ADHD', 'health'],
    ['autisme', 'health'],
    ['depression', 'health'],
    ['angstlidelse', 'health'],
    ['sclerose', 'health'],
    ['ædru', 'health'],
    ['kronisk syg', 'health'],
    ['Muslim', 'religion'],
    ['Kristendom', 'religion'],
    ['bibelstudie', 'religion'],
    ['Buddhisme', 'religion'],
    ['jødisk kultur', 'religion'],
    ['folkekirken', 'religion'],
    ['LGBTQ+', 'sexualOrientation'],
    ['queer bookclub', 'sexualOrientation'],
    ['lesbisk', 'sexualOrientation'],
    ['Copenhagen Pride', 'sexualOrientation'],
    ['etniske minoriteter', 'ethnicOrigin'],
  ] as const)('%j hits %s', (text, category) => {
    const r = check(text);
    expect(r.hit).toBe(true);
    expect(r.categories).toContain(category);
  });

  it('catches the two known detector misses and both Danish near-misses [EXP]', () => {
    expect(check('Pride parade volunteering').categories).toEqual(['sexualOrientation']);
    expect(check('diabetes-friendly baking').categories).toEqual(['health']);
    expect(check('brystkræft').categories).toEqual(['health']);
    expect(check('kørestolsbruger').categories).toEqual(['health']);
  });

  it.each([
    // The detector's typical false flags [EXP] must not become lexicon hits.
    'korsang',
    'surdejsbrød',
    'vandring',
    'madlavning',
    'brætspil',
    'board games',
    'cooking',
    'fodbold',
    'heavy metal',
    'Pride and Prejudice',
    'venstrehåndet',
    'konservatoriet',
    'Christiania',
    'gode kræfter',
    'uafhængig musik',
    'golfhandicap',
    'C++',
    'D&D',
    'Chronicles of Narnia',
    'non-alcoholic beer',
    'add new hobbies',
    'kaffe',
    'yoga',
    'strikning',
    'frivilligt arbejde',
    'vinsmagning',
    'politik',
    'historie',
  ])('%j is not a hit', (text) => {
    expect(check(text).hit).toBe(false);
  });

  it('covers the hardest true positives for EmbeddingGemma 2, all Danish [CAL]', () => {
    for (const text of ['ufrivilligt barnløs', 'iftar under ramadanen', 'døv', 'bøsse']) expect(check(text).hit, text).toBe(true);
  });

  it('lists several categories when a tag spans them, in a fixed order', () => {
    expect(check('queer muslim').categories).toEqual(['religion', 'sexualOrientation']);
  });

  it('stores every term already normalized, so device and server agree', () => {
    for (const e of ART9_LEXICON) {
      for (const word of e.term.split(' ')) {
        const r = normalizeTag(word.length >= 2 ? word : `${word}${word}`);
        expect(r.ok).toBe(true);
      }
      expect(e.term).toBe(e.term.normalize('NFKC').toLowerCase().trim());
    }
  });
});

describe('third-party kinship patterns (§5.2 (2))', () => {
  it.each([
    'min datters autisme',
    'min søns diabetes',
    'min mands depression',
    'mit barns ADHD',
    'vores børns skole',
    'min mor har demens',
    'my son’s autism',
    "my daughter's diabetes",
    'my husband',
    'our kids football',
  ])('%j is about a third party', (text) => {
    const r = normalizeTag(text);
    expect(r.ok && detectThirdParty(r.norm).hit).toBe(true);
  });

  it.each([
    'forælder til et barn med autisme',
    'parent of an autistic child',
    'mor til tvillinger',
    'madlavning',
    'min yndlingsret',
    'my own business',
  ])('%j is about the user', (text) => {
    const r = normalizeTag(text);
    expect(r.ok && detectThirdParty(r.norm).hit).toBe(false);
  });
});
