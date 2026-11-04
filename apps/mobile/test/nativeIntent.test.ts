import { redirectSystemPath } from '../app/+native-intent';

describe('+native-intent', () => {
  it('rewrites Hosting email links to auth/complete with the full URL', () => {
    const link = 'https://grouper-prod.firebaseapp.com/__/auth/links?link=https%3A%2F%2Fgrouper-prod.firebaseapp.com%2F__%2Fauth%2Faction%3Fmode%3DsignIn%26oobCode%3Dabc';
    expect(redirectSystemPath({ path: link, initial: true })).toBe(`/auth/complete?link=${encodeURIComponent(link)}`);
  });

  it('leaves other paths alone', () => {
    expect(redirectSystemPath({ path: '/pod/abc', initial: false })).toBe('/pod/abc');
  });
});
