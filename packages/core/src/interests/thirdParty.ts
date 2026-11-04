import { tagTokens } from './normalize';

/**
 * Possessive kinship patterns (§5.2 (2)): "min datters …", "my son's …". A hit plus a sensitive or
 * suspected tag is refused (THIRD_PARTY_SENSITIVE): the user's consent cannot cover a family member's
 * Art. 9 data (PRIVACY.md §4.3). An ordinary hit only warns. "forælder til et barn med autisme" /
 * "parent of an autistic child" is about the user and does not match.
 */
const DA_POSSESSIVES = new Set(['min', 'mit', 'mine', 'vores']);
const DA_KIN = [
  'datter', 'døtre', 'søn', 'sønner', 'mand', 'kone', 'hustru', 'kæreste', 'partner', 'ægtefælle', 'mor', 'far',
  'forælder', 'forældre', 'barn', 'børn', 'bror', 'brødre', 'søster', 'søstre', 'søskende', 'veninde', 'ven', 'venner',
  'bedstemor', 'bedstefar', 'mormor', 'morfar', 'farmor', 'farfar', 'oldemor', 'oldefar', 'svigermor', 'svigerfar',
  'svigerinde', 'svoger', 'nevø', 'niece', 'fætter', 'kusine', 'onkel', 'tante', 'baby', 'stedsøn', 'steddatter',
  'papdatter', 'papsøn', 'papbarn', 'papbørn', 'barnebarn', 'børnebørn', 'eks',
];
// Danish genitive and definite/plural endings on a kinship noun: datters, sønnens, børnenes, ...
const DA_KIN_FORM = new RegExp(`^(?:${DA_KIN.join('|')})(?:s|en|ens|et|ets|ne|nes|erne|ernes)?$`, 'u');

const EN_POSSESSIVES = new Set(['my', 'our']);
const EN_KIN = new Set([
  'son', 'sons', 'daughter', 'daughters', 'husband', 'wife', 'partner', 'spouse', 'boyfriend', 'girlfriend', 'mom',
  'mum', 'mother', 'dad', 'father', 'parent', 'parents', 'child', 'children', 'kid', 'kids', 'baby', 'babies',
  'brother', 'brothers', 'sister', 'sisters', 'sibling', 'siblings', 'grandma', 'grandmother', 'grandpa',
  'grandfather', 'grandchild', 'grandchildren', 'grandson', 'granddaughter', 'aunt', 'uncle', 'cousin', 'nephew',
  'niece', 'friend', 'friends', 'ex', 'stepson', 'stepdaughter', 'fiance', 'fiancé', 'fiancee', 'fiancée',
]);

export interface ThirdPartyResult {
  readonly hit: boolean;
  /** Matched "possessive kin" pairs, e.g. "min datters". */
  readonly matches: readonly string[];
}

export function detectThirdParty(norm: string): ThirdPartyResult {
  // Apostrophe forms ("son's", "sons'") split into tokens; drop the trailing "s" token they leave.
  const tokens = tagTokens(norm.replace(/['’]s\b|s['’]/gu, 's'));
  const matches: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) {
    const owner = tokens[i]!;
    const kin = tokens[i + 1]!;
    const isDa = DA_POSSESSIVES.has(owner) && DA_KIN_FORM.test(kin);
    const isEn = EN_POSSESSIVES.has(owner) && (EN_KIN.has(kin) || (kin.endsWith('s') && EN_KIN.has(kin.slice(0, -1))));
    if (isDa || isEn) matches.push(`${owner} ${kin}`);
  }
  return { hit: matches.length > 0, matches };
}
