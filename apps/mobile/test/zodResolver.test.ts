import { prefsSchema, type Prefs } from '@grouper/core';
import type { ResolverOptions } from 'react-hook-form';
import { zodResolver } from '@/lib/zodResolver';

const prefs: Prefs = {
  ageMin: 25,
  ageMax: 39,
  maxKm: 10,
  languages: ['da'],
  availability: 0b000011,
  sameGenderOnly: false,
  openToAnyone: false,
};
const options = { fields: {}, shouldUseNativeValidation: false } as ResolverOptions<Prefs>;

describe('zodResolver', () => {
  it('passes valid values through the core schema', async () => {
    await expect(zodResolver(prefsSchema)(prefs, undefined, options)).resolves.toEqual({ values: prefs, errors: {} });
  });

  it('maps schema issues to field errors (age range narrower than 5 years, no language)', async () => {
    const result = await zodResolver(prefsSchema)({ ...prefs, ageMax: 27, languages: [] }, undefined, options);
    expect(result.values).toEqual({});
    expect(Object.keys(result.errors).sort()).toEqual(['ageMax', 'languages']);
  });
});
