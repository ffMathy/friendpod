import { googleMapsPlaceUrl, placeSchema, proposeOptionInput } from '@grouper/core';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { getPlaces } from '@/features/places';
import { PlacePicker } from '@/features/places/PlacePicker';
import { publicPlaceType, toPlace } from '@/features/places/shape';
import { PlaceNotPublicError } from '@/features/places/types';

describe('places (D8)', () => {
  it('uses the stub service in tests', () => {
    expect(getPlaces().kind).toBe('stub');
  });

  it('builds a Place that proposeOption accepts: rounded coordinates and the built map URL', () => {
    const place = toPlace({
      placeId: 'ChIJstubDokk1Aarhus01',
      name: 'Dokk1',
      address: 'Hack Kampmanns Plads 2, Aarhus',
      lat: 56.153512345,
      lng: 10.214198765,
      primaryType: 'library',
      types: ['library', 'point_of_interest'],
    });
    expect(place).toMatchObject({ lat: 56.1535, lng: 10.2142, type: 'library' });
    expect(placeSchema.safeParse(place).success).toBe(true);
    expect(proposeOptionInput.safeParse({ podId: 'abcdefghijklmnopqrst', startsAt: Date.now() + 86_400_000, place }).success).toBe(true);
  });

  it('keeps a long name valid: cut at a space, with Danish letters, or inside an emoji', () => {
    const base = { placeId: 'ChIJstubLongName0001', address: 'Åboulevarden 1, 8000 Aarhus C', lat: 56.15, lng: 10.2, primaryType: 'cafe', types: ['cafe'] };
    for (const name of [`${'a'.repeat(119)} ${'b'.repeat(13)}`, 'Æblekagecaféen på Åens bred '.repeat(6), `${'x'.repeat(119)}😀 café`]) {
      const place = toPlace({ ...base, name });
      expect(place.name.length).toBeLessThanOrEqual(120);
      expect(place.name).toBe(place.name.trim());
      expect(placeSchema.safeParse(place).success).toBe(true);
    }
  });

  it('refuses contact details or a home address typed into a place by a modified client', () => {
    const place = toPlace({ placeId: 'ChIJstubDokk1Aarhus01', name: 'Dokk1', address: 'Hack Kampmanns Plads 2, Aarhus', lat: 56.15, lng: 10.2, primaryType: 'library', types: ['library'] });
    const forged = (o: { name?: string; address?: string }) => {
      const name = o.name ?? place.name;
      return placeSchema.safeParse({ ...place, ...o, mapUrl: googleMapsPlaceUrl(place.placeId, name) });
    };
    expect(forged({ name: 'Annas lejlighed, ring 20 12 34 56' }).success).toBe(false);
    expect(forged({ name: 'Vestergade 12, 8000 Aarhus C' }).success).toBe(false);
    expect(forged({ name: 'snap: annak92' }).success).toBe(false);
    expect(forged({ address: 'Vestergade 12, 2. tv, 8000 Aarhus C' }).success).toBe(false);
    expect(forged({ address: 'Vestergade 12, 8000 Aarhus C' }).success).toBe(true);
  });

  it('accepts only public place types, preferring the primary one', () => {
    expect(publicPlaceType('cafe', ['cafe', 'food'])).toBe('cafe');
    expect(publicPlaceType('point_of_interest', ['point_of_interest', 'park'])).toBe('park');
    expect(publicPlaceType('street_address', ['street_address'])).toBeNull();
    expect(() =>
      toPlace({ placeId: 'ChIJstubPrivateHome1', name: 'Nørregade 12', address: 'Aarhus', lat: 56, lng: 10, primaryType: 'premise', types: ['premise'] }),
    ).toThrow(PlaceNotPublicError);
  });

  it('the picker searches, filters to public places and returns the picked place; there is no free-text place', async () => {
    jest.useFakeTimers();
    const picked: unknown[] = [];
    function Harness() {
      const [value, setValue] = useState<Parameters<typeof PlacePicker>[0]['value']>(null);
      return (
        <PlacePicker
          language="en"
          gh5={null}
          value={value}
          onChange={(p) => {
            picked.push(p);
            setValue(p);
          }}
        />
      );
    }
    await render(<Harness />);
    await fireEvent.changeText(screen.getByTestId('place-search'), 'nør');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    // The stub's private address matches "nør" but is not a public place.
    expect(screen.queryByText('Nørregade 12, 3. tv')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('place-search'), 'café');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await fireEvent.press(screen.getByText('Café Nord'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(picked).toHaveLength(1);
    expect(placeSchema.parse(picked[0])).toMatchObject({ name: 'Café Nord', type: 'cafe' });
    expect(screen.getByText('Café Nord')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Change place' })).toBeOnTheScreen();
    jest.useRealTimers();
  });
});
