/**
 * The preview's network: Storage photo downloads (REST, §9 Photos) get placeholder avatars, Google Places gets the
 * scenario's place fixtures, and every other request to another origin is refused, so a preview never reaches a real
 * service. Same-origin requests (the bundle, fonts, assets) pass through.
 */
import { preview, reportIssue } from './state';
import type { PlaceFixture } from './types';

const AVATAR_COLOURS = ['#F7D58E', '#8DBFAE', '#F2B544', '#2F8A72', '#E1EFE9', '#C9D1CA'];

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** The member's first name from any pod roster or their own profile, for the avatar's initial. */
function firstNameOf(uid: string): string | null {
  const { store } = preview();
  const own = store.get(`users/${uid}`)?.firstName;
  if (typeof own === 'string') return own;
  for (const doc of store.all()) {
    const roster = doc.data.roster as Record<string, { firstName?: string }> | undefined;
    const name = roster?.[uid]?.firstName;
    if (typeof name === 'string') return name;
  }
  return null;
}

export function avatarSvg(uid: string): string {
  const name = firstNameOf(uid) ?? '?';
  const bg = AVATAR_COLOURS[hash(uid) % AVATAR_COLOURS.length]!;
  const fg = bg === '#2F8A72' ? '#FFFFFF' : '#18211D';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="${bg}"/><text x="128" y="128" dy="0.35em" text-anchor="middle" font-family="Plus Jakarta Sans, Helvetica, Arial, sans-serif" font-weight="700" font-size="112" fill="${fg}">${name.slice(0, 1).toUpperCase()}</text></svg>`;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function photoResponse(objectPath: string): Promise<Response> {
  // photos/<uid>/<v>.jpg or photos/<uid>/<v>_256.jpg
  const owner = /^photos\/([^/]+)\//.exec(objectPath)?.[1];
  if (!owner) return new Response('not found', { status: 404 });
  const custom = preview().scenario.photos?.[owner];
  if (custom) return realFetch(custom);
  return new Response(new Blob([avatarSvg(owner)], { type: 'image/svg+xml' }), { status: 200 });
}

/** Loose like Autocomplete: any typed word found in the name, the address or the type is a hit. */
function placeMatches(place: PlaceFixture, input: string): boolean {
  const words = input.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${place.name} ${place.address} ${place.primaryType}`.toLowerCase();
  return words.length === 0 || words.some((w) => haystack.includes(w));
}

async function placesResponse(url: URL, init: RequestInit | undefined): Promise<Response> {
  const places = preview().scenario.places ?? [];
  if (url.pathname === '/v1/places:autocomplete') {
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as { input?: string };
    const hits = places.filter((p) => placeMatches(p, body.input ?? ''));
    return json({
      suggestions: hits.map((p) => ({
        placePrediction: {
          placeId: p.placeId,
          text: { text: p.name },
          structuredFormat: { mainText: { text: p.name }, secondaryText: { text: p.address } },
          types: [p.primaryType],
        },
      })),
    });
  }
  const id = decodeURIComponent(url.pathname.replace(/^\/v1\/places\//, ''));
  const p = places.find((x) => x.placeId === id);
  if (!p) return new Response('{}', { status: 404 });
  return json({
    id: p.placeId,
    displayName: { text: p.name },
    shortFormattedAddress: p.address,
    location: { latitude: p.lat, longitude: p.lng },
    primaryType: p.primaryType,
    types: [p.primaryType],
  });
}

let realFetch: typeof fetch = (...args) => fetch(...args);

export function installNetwork(): void {
  realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (url.origin === window.location.origin || url.protocol === 'data:' || url.protocol === 'blob:') return realFetch(input, init);
    if (url.hostname === 'firebasestorage.googleapis.com' || url.port === '9199') {
      const objectPath = decodeURIComponent(url.pathname.replace(/^\/v0\/b\/[^/]+\/o\//, ''));
      return photoResponse(objectPath);
    }
    if (url.hostname === 'places.googleapis.com') return placesResponse(url, init);
    reportIssue({ kind: 'blockedRequest', message: `${init?.method ?? 'GET'} ${url.origin}${url.pathname}` });
    throw new TypeError(`preview: network request to ${url.origin} blocked`);
  };
}
