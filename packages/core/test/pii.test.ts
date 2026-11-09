import { describe, expect, it } from 'vitest';
import { containsPii, findPii, mentionsHandle } from '../src/interests/pii';

describe('PII patterns (§5.2 (2))', () => {
  it.each([
    ['ring 12 34 56 78', 'phone'],
    ['+45 12345678', 'phone'],
    ['0045-12-34-56-78', 'phone'],
    ['(+45) 2012 3456', 'phone'],
    ['mail me: anna@example.dk', 'email'],
    ['anna (at) gmail (dot) com', 'email'],
    ['https://example.com/x', 'url'],
    ['www.friendpod.dk', 'url'],
    ['find os på madklub.dk', 'url'],
    ['@anna_k', 'handle'],
    ['insta: anna.k', 'handle'],
    ['snap=annak', 'handle'],
    ['010190-1234', 'cpr'],
    ['0101901234', 'cpr'],
  ] as const)('%j contains %s', (text, kind) => {
    expect(findPii(text)).toContain(kind);
  });

  it.each([
    'C++',
    'D&D',
    '3F',
    'madlavning',
    'board games',
    'node.js',
    'vue.js',
    '1990-2000 musik',
    '1000 piece puzzles',
    '24/7',
    'Pokémon 151',
    'løb 5 km',
    'discord gaming',
    'top 40',
  ])('%j has no PII', (text) => {
    expect(containsPii(text)).toBe(false);
  });

  it('reports CPR instead of phone for a valid ddmmyy prefix, phone otherwise', () => {
    expect(findPii('3112991234')).toEqual(['cpr']);
    expect(findPii('9999991234')).toEqual(['phone']);
  });

  it('checks every 10-digit run for a CPR number, not only the first', () => {
    expect(findPii('+4520304050 010190-1234')).toContain('cpr');
    expect(findPii('booking 1234567890, cpr 0101901234')).toContain('cpr');
    expect(findPii('+4520304050 og 9999991234')).toEqual(['phone']);
  });
});

describe('handles in running text (meetup chat only)', () => {
  it.each(['add me on snap annak92', 'skriv på insta anna.k92', 'Snapchat er anna_k', 'tilføj mig på discord annak', 'add me on ig: @anna'])(
    '%j names a handle',
    (text) => {
      expect(mentionsHandle(text)).toBe(true);
    },
  );

  it.each(['discord gaming', 'snap 2026', 'signal er dårlig her', 'et kik på kortet', 'jeg er på discord hele dagen', 'fb 18.30'])(
    '%j does not',
    (text) => {
      expect(mentionsHandle(text)).toBe(false);
    },
  );
});
