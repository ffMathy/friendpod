/**
 * Installs the selected scenario before any app module runs (imported first by boot.ts):
 * `?scenario=<id>&locale=da|en&platform=ios|android` in the URL, remembered for reloads in sessionStorage.
 */
import { LOCALES, type Locale } from '@grouper/core';
import { DEFAULT_SCENARIO, SCENARIOS } from '../scenarios';
import { installClock, parseNow } from './clock';
import { installNetwork } from './network';
import { reportIssue, setPreviewState, type PreviewIssue } from './state';
import { PreviewStore } from './store';
import type { DocData, Scenario } from './types';

const KEY = 'grouper.preview.params';

function readParams(): URLSearchParams {
  const fromUrl = new URLSearchParams(window.location.search);
  try {
    if (fromUrl.has('scenario')) {
      window.sessionStorage.setItem(KEY, fromUrl.toString());
      return fromUrl;
    }
    const saved = window.sessionStorage.getItem(KEY);
    if (saved) return new URLSearchParams(saved);
  } catch {
    // Storage blocked: the URL alone decides.
  }
  return fromUrl;
}

function isLocale(v: string | null): v is Locale {
  return v !== null && (LOCALES as readonly string[]).includes(v);
}

/** The signed-in user's profile follows the chosen UI language (the app applies `users/{uid}.locale` at start). */
function withLocale(docs: Readonly<Record<string, DocData>>, uid: string | undefined, locale: Locale): Record<string, DocData> {
  const out: Record<string, DocData> = { ...docs };
  const path = uid ? `users/${uid}` : null;
  if (path && out[path]) out[path] = { ...out[path], locale };
  return out;
}

const params = readParams();
const issues: PreviewIssue[] = [];
const requested = params.get('scenario') ?? DEFAULT_SCENARIO;
let scenario: Scenario | undefined = SCENARIOS.get(requested);
if (!scenario) {
  issues.push({ kind: 'scenario', message: `unknown scenario "${requested}"; known: ${[...SCENARIOS.keys()].join(', ')}` });
  scenario = SCENARIOS.get(DEFAULT_SCENARIO);
  if (!scenario) throw new Error(`preview: default scenario "${DEFAULT_SCENARIO}" is missing`);
}
const localeParam = params.get('locale');
const locale: Locale = isLocale(localeParam) ? localeParam : (scenario.locale ?? 'en');
const platformParam = params.get('platform');
const platform = platformParam === 'android' || platformParam === 'ios' ? platformParam : (scenario.platform ?? 'ios');

installClock(parseNow(scenario.now));

const user = scenario.user;
const secureStore = new Map<string, string>(Object.entries(scenario.secureStore ?? {}));
if (user && user.claims?.onb === true && scenario.onboardingFinished !== false) secureStore.set(`onboardingComplete.${user.uid}`, '1');

setPreviewState({
  scenario,
  locale,
  platform,
  store: new PreviewStore(withLocale(typeof scenario.docs === 'function' ? scenario.docs({ locale }) : (scenario.docs ?? {}), user?.uid, locale)),
  secureStore,
  auth: { user, listeners: new Set() },
  issues,
});
for (const issue of issues) reportIssue(issue);

installNetwork();

window.addEventListener('error', (e) => reportIssue({ kind: 'error', message: String(e.message) }));
window.addEventListener('unhandledrejection', (e) => reportIssue({ kind: 'unhandledrejection', message: String((e.reason as Error | undefined)?.message ?? e.reason) }));

(window as unknown as { __preview: unknown }).__preview = {
  scenario: scenario.id,
  title: scenario.title,
  locale,
  platform,
  scenarios: [...SCENARIOS.keys()],
  issues,
};
document.documentElement.lang = locale;
