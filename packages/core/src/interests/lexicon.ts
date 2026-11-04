import { ART9_CATEGORIES, type Art9Category } from '../types/domain';
import { tagTokens } from './normalize';

/**
 * High-precision Art. 9 lexicon, da/en (DESIGN.md §5.2 (0), (5) row 2). Runs on the device before
 * anything is sent and again on the server. A hit makes the tag sensitive without the detector; the
 * embedding detector (recall-tuned) covers the long tail. Nothing overrides a hit: the known-ordinary list is
 * checked after the lexicon, and only the user's own "This isn't sensitive for me" makes their holding ordinary.
 *
 * Matching runs on normalizeTag() output, split into tokens of letters, digits and + # &:
 * - token:     a whole token equals the term
 * - prefix:    a token starts with the term (Danish inflection, English plurals)
 * - substring: a token contains the term (Danish compounds such as "brystkræft"), unless it contains an exception
 * - phrase:    consecutive tokens equal the term's tokens
 * - exact:     the whole tag equals the term (ambiguous acronyms such as "aa", "ms", "sf")
 */
export const LEXICON_RULES_VERSION = 'lexicon-2026-11-04.1';

export type LexiconMatchKind = 'token' | 'prefix' | 'substring' | 'phrase' | 'exact';

export interface LexiconEntry {
  readonly term: string;
  readonly kind: LexiconMatchKind;
  readonly category: Art9Category;
  readonly except?: readonly string[];
}

type Spec = Partial<Record<LexiconMatchKind, readonly (string | readonly [string, readonly string[]])[]>>;

const SPEC: Record<Art9Category, Spec> = {
  health: {
    exact: ['aa', 'ms', 'kol'],
    token: ['hiv', 'aids', 'copd', 'ivf', 'icsi', 'pcos', 'brca', 'adhd', 'ocd', 'ptsd', 'sober', 'rehab', 'cancer', 'døv', 'døve', 'deaf', 'addict', 'addicts', 'alcoholics', 'alcoholism', 'fertility', 'miscarriage'],
    prefix: [
      'diabet', 'pregnan', 'autis', 'asperger', 'depress', 'bipolar', 'parkinson', 'alzheimer', 'demens', 'dementia',
      'epilep', 'sclerosis', 'leukæmi', 'leukemi', 'leukaemia', 'anoreksi', 'anorexi', 'bulimi', 'skizofren', 'schizophren',
      'fibromyalg', 'endometrio', 'migræne', 'migraine', 'astma', 'asthma', 'cøliaki', 'coeliac', 'celiac', 'kemoterapi',
      'chemotherap', 'stomi', 'dialyse', 'dialysis', 'infertil', 'fertilitet', 'insemin', 'disabilit', 'disabled',
      'wheelchair', 'amput', 'døvblind', 'hørehæm', 'høretab', 'svagtseend', 'kronisk', 'stressramt', 'psykiatri',
      'psychiatr', 'selvmord', 'suicid', 'selvskad', 'alkoholiker', 'addiction', 'ædru', 'sobriety', 'afvænning', 'abort',
      'fødselsdepress', 'postpartum', 'tourette', 'ordblind', 'dyslexi', 'gigt', 'arthritis', 'diagnos', 'anxiety',
      'transplant', 'patientforening', 'sukkersyge',
    ],
    substring: [
      'gravid', 'kørestol', 'sklerose', 'sclerose', 'spiseforstyr', 'misbrug', 'sygemeld', 'lidelse',
      ['kræft', ['kræfter']],
      ['afhængig', ['uafhængig']],
      ['handicap', ['golfhandicap']],
      ['sygdom', ['plantesygdom']],
      ['angst', ['langstrakt']],
    ],
    phrase: [
      'anonyme alkoholikere', 'alcoholics anonymous', 'narcotics anonymous', 'aa møder', 'aa møde', 'aa meeting',
      'aa meetings', 'aa gruppe', '12 trin', '12 step', 'tolv trin', 'twelve step', 'mental illness', 'mental health',
      'psykisk sygdom', 'psykisk syg', 'psykisk sårbar', 'eating disorder', 'long covid', 'self harm', 'barnløs',
      'ufrivillig barnløs', 'ufrivilligt barnløs', 'spontan abort', 'chronic pain', 'chronic illness', 'chronic fatigue',
      'chronically ill', 'hearing loss', 'hearing impaired', 'visually impaired', 'sick leave', 'borderline personality',
      'down syndrome', 'downs syndrom', 'cerebral parese', 'cerebral palsy', 'venter barn', 'venter vores første',
      'expecting a baby', 'expecting our first',
    ],
  },
  religion: {
    token: ['kristen', 'kristne', 'jøde', 'jøder', 'faith', 'prayer', 'imam', 'rabbi', 'baptist', 'quaker', 'kvæker', 'wicca', 'asatro', 'iftar'],
    prefix: [
      'kristendom', 'christianity', 'muslim', 'islam', 'jødisk', 'jødedom', 'jewish', 'judais', 'buddhis', 'hindu', 'sikh',
      'ateis', 'atheis', 'agnostic', 'agnostik', 'katolsk', 'katolik', 'catholic', 'protestant', 'luthersk', 'lutheran',
      'evangeli', 'pinsekirke', 'pentecostal', 'jehova', 'mormon', 'scientolog', 'synagog', 'moské', 'moske', 'mosque',
      'bibel', 'bible', 'koran', 'quran', 'ramadan', 'gudstjeneste', 'menighed', 'adventist', 'shinto', 'taois', 'bønnegrupp',
      'kirkegænger',
    ],
    substring: ['folkekirke', 'frikirke', 'valgmenighed', 'kirkegang'],
    phrase: ['christian faith', 'kristen tro', 'bible study', 'prayer group', 'hare krishna', 'indre mission'],
  },
  sexualOrientation: {
    token: ['gay', 'gays', 'trans', 'homo', 'homoer', 'lgbt+', 'lgbtq+', 'lgbtqia+', 'nonbinary', 'kink', 'bdsm'],
    prefix: [
      'lgbt', 'queer', 'lesb', 'bøsse', 'homoseksu', 'homosexu', 'biseksu', 'bisexu', 'panseksu', 'pansexu', 'aseksu', 'asexu',
      'transkøn', 'transgender', 'nonbinær', 'ikkebinær', 'polyamor', 'swinger', 'regnbuefamili', 'fetish', 'fetich',
    ],
    phrase: [
      'pride parade', 'pride march', 'pride festival', 'pride week', 'pride month', 'gay pride', 'copenhagen pride',
      'københavn pride', 'aarhus pride', 'coming out', 'non binær', 'non binary', 'rainbow family', 'rainbow families',
    ],
  },
  politics: {
    exact: ['sf', 'df'],
    token: ['venstre', 'dsu', 'sfu', 'tory', 'tories'],
    prefix: [
      'socialdemokrat', 'moderaterne', 'danmarksdemokrat', 'enhedslist', 'alternativet', 'kristendemokrat', 'konservativ',
      'radikale', 'socialist', 'kommunis', 'communis', 'marxis', 'anarkis', 'anarchis', 'feminis', 'nationalis',
      'libertarian', 'republican', 'democrat', 'folketingskandidat', 'byrådskandidat', 'byrådsmedlem', 'partiforening',
      'partimedlem', 'ungdomsparti',
    ],
    phrase: [
      'socialistisk folkeparti', 'liberal alliance', 'dansk folkeparti', 'det konservative folkeparti', 'radikale venstre',
      'nye borgerlige', 'borgernes parti', 'frie grønne', 'venstres ungdom', 'konservativ ungdom', 'radikal ungdom',
      'liberal alliances ungdom', 'socialistisk ungdomsfront', 'politisk parti', 'green party', 'labour party',
      'conservative party', 'democratic party', 'republican party',
    ],
  },
  ethnicOrigin: {
    token: ['romani', 'inuit', 'inuk', 'bipoc', 'poc', 'diaspora'],
    prefix: ['afrodansk', 'andengenerations', 'grønlænder', 'kurder', 'somalisk'],
    phrase: [
      'etnisk minoritet', 'etniske minoriteter', 'ethnic minority', 'ethnic minorities', 'people of colour', 'people of color',
      'person of colour', 'person of color', 'black community', 'second generation immigrant', 'anden generation',
      'afro dansk', 'afro danish', 'tyrkisk dansk', 'pakistansk dansk', 'arabisk dansk', 'somali community',
      'grønlandsk fællesskab', 'black in copenhagen',
    ],
  },
  tradeUnion: {
    token: ['3f', 'hk', 'foa', 'dlf', 'dsr', 'djøf', 'krifa', 'prosa', 'nnf', 'bupl'],
    prefix: ['tillidsrepræsentant', 'tillidsmand', 'socialpædagogerne', 'serviceforbundet', 'fødevareforbundet', 'malerforbundet'],
    substring: ['fagforening', 'fagbevægelse', 'lærerforening', 'sygeplejeråd'],
    phrase: [
      'dansk metal', 'det faglige hus', 'teknisk landsforbund', 'blik og rør', 'dansk el forbund', 'dansk sygeplejeråd',
      'danmarks lærerforening', 'trade union', 'trade unions', 'labour union', 'labor union', 'union member',
      'union rep', 'union representative', 'shop steward', 'union organizing', 'union organising',
    ],
  },
};

function build(): LexiconEntry[] {
  const entries: LexiconEntry[] = [];
  for (const category of ART9_CATEGORIES) {
    const spec = SPEC[category];
    for (const kind of Object.keys(spec) as LexiconMatchKind[]) {
      for (const item of spec[kind] ?? []) {
        const [term, except] = typeof item === 'string' ? [item, undefined] : item;
        entries.push(except ? { term, kind, category, except } : { term, kind, category });
      }
    }
  }
  return entries;
}

export const ART9_LEXICON: readonly LexiconEntry[] = build();

export interface LexiconResult {
  readonly hit: boolean;
  /** Candidate categories in ART9_CATEGORIES order; never shown to anyone. */
  readonly categories: readonly Art9Category[];
  readonly terms: readonly string[];
}

function matches(entry: LexiconEntry, tokens: readonly string[], joined: string): boolean {
  switch (entry.kind) {
    case 'exact':
      return joined === entry.term;
    case 'token':
      return tokens.includes(entry.term);
    case 'prefix':
      return tokens.some((t) => t.startsWith(entry.term));
    case 'substring':
      return tokens.some((t) => t.includes(entry.term) && !(entry.except ?? []).some((e) => t.includes(e)));
    case 'phrase': {
      const words = entry.term.split(' ');
      for (let i = 0; i + words.length <= tokens.length; i++) {
        if (words.every((w, j) => tokens[i + j] === w)) return true;
      }
      return false;
    }
  }
}

/** Checks a normalized tag (normalizeTag().norm) against the lexicon. */
export function lexiconCheck(norm: string): LexiconResult {
  const tokens = tagTokens(norm);
  const joined = tokens.join(' ');
  const hits = ART9_LEXICON.filter((e) => matches(e, tokens, joined));
  const found = new Set(hits.map((h) => h.category));
  return {
    hit: hits.length > 0,
    categories: ART9_CATEGORIES.filter((c) => found.has(c)),
    terms: [...new Set(hits.map((h) => h.term))],
  };
}
