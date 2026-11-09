import { AVAILABILITY, MAX_AGE, MIN_AGE, completeOnboardingInput, postcodeToGh5, type Prefs } from '@friendpod/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactElement } from 'react';
import { AreaCard } from '@/features/onboarding/AreaCard';
import { OnboardingDraftProvider, useOnboardingDraft, type OnboardingDraft } from '@/features/onboarding/draft';
import { ageToFraction, fractionToAge } from '@/features/profile/AgeRangeSlider';
import { PreferencesForm } from '@/features/profile/PreferencesForm';
import { i18n } from '@/i18n';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal';
import AboutYou from '../app/(onboarding)/about';
import AddInterests from '../app/(onboarding)/add-interests';
import AlmostDone from '../app/(onboarding)/almost-done';
import Area from '../app/(onboarding)/area';
import PodPreferences from '../app/(onboarding)/pod-preferences';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  canDismiss: jest.fn(() => true),
  dismissAll: jest.fn(),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn(), Accuracy: { Lowest: 1 } }));

const mockSession = { onboarded: false, refreshClaims: jest.fn(async () => undefined), finishOnboarding: jest.fn(async () => undefined) };
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me', useSession: () => mockSession }));
const mockSignOut = jest.fn(async () => undefined);
jest.mock('@/features/account/account', () => ({ signOut: () => mockSignOut() }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const PREFS: Prefs = {
  ageMin: 28,
  ageMax: 42,
  maxKm: 10,
  languages: ['da', 'en'],
  availability: AVAILABILITY.weekdayEvening | AVAILABILITY.saturdayDay | AVAILABILITY.sundayDay,
  sameGenderOnly: false,
  openToAnyone: false,
};
let mockUser: Record<string, unknown> = {};
jest.mock('@/data/docs', () => ({
  useUserDoc: () => ({ data: mockUser, error: null, isLoading: false }),
  useInterests: () => ({ data: [], error: null, isLoading: false }),
  useSensitiveInterests: () => ({ data: [], error: null, isLoading: false }),
}));
// The interests list itself is InterestManager's (tested on its own); step 4 is the screen around it.
jest.mock('@/features/interests/InterestManager', () => ({ InterestManager: () => null }));

const mockPush = { granted: false, request: true };
jest.mock('@/features/notifications/push', () => ({
  pushPermissionGranted: async () => mockPush.granted,
  requestPushPermission: async () => mockPush.request,
  registerPushToken: async () => undefined,
}));
jest.mock('@/features/photos/upload', () => ({ usePhotoUpload: () => ({ state: 'idle', choose: async () => undefined }) }));
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({ AuthenticatedPhoto: () => null }));

let client: QueryClient;
let draftSeen: OnboardingDraft | null = null;

function DraftProbe() {
  const { draft } = useOnboardingDraft();
  draftSeen = draft;
  return null;
}

function Seed({ patch }: { patch: Partial<OnboardingDraft> }) {
  const { update } = useOnboardingDraft();
  // Once, before the step's first interaction.
  useEffect(() => update(patch), []);
  return null;
}

async function renderStep(node: ReactElement, seed?: Partial<OnboardingDraft>) {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <OnboardingDraftProvider>
        {seed ? <Seed patch={seed} /> : null}
        <DraftProbe />
        {node}
      </OnboardingDraftProvider>
    </QueryClientProvider>,
  );
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  mockCall.mockReset();
  Object.values(mockRouter).forEach((f) => f.mockClear());
  mockRouter.canGoBack.mockReturnValue(true);
  mockSession.refreshClaims.mockClear();
  mockSession.finishOnboarding.mockClear();
  mockSignOut.mockClear();
  mockUser = { prefs: PREFS, photo: null };
  mockPush.granted = false;
  mockPush.request = true;
  draftSeen = null;
});
afterEach(() => client.clear());

describe('onboarding step 1, About you', () => {
  const fill = async (o: { name?: string; day?: string; month?: string; year?: string; terms?: boolean } = {}) => {
    await fireEvent.changeText(screen.getByTestId('first-name'), o.name ?? 'Ea');
    await fireEvent.changeText(screen.getByTestId('dob-day'), o.day ?? '14');
    await fireEvent.changeText(screen.getByTestId('dob-month'), o.month ?? '3');
    await fireEvent.changeText(screen.getByTestId('dob-year'), o.year ?? '1991');
    if (o.terms !== false) await fireEvent.press(screen.getByTestId('terms-accept'));
  };

  it('is step 1 of 6 and asks for the first name, date of birth and the Terms', async () => {
    await renderStep(<AboutYou />);
    expect(screen.getByText('Step 1 of 6')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'About you' })).toBeOnTheScreen();
    expect(screen.getByText('Only people in a confirmed pod with you see it.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Date of birth, Day')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'I accept the Terms' })).not.toBeChecked();
  });

  it('continues only with a valid name, a real date and the Terms accepted, then keeps the answers on the device', async () => {
    await renderStep(<AboutYou />);
    const next = screen.getByTestId('about-continue');
    expect(next).toBeDisabled();
    await fill({ terms: false });
    expect(next).toBeDisabled();
    await fireEvent.press(screen.getByTestId('terms-accept'));
    expect(next).toBeEnabled();
    await fireEvent.press(next);
    expect(mockRouter.push).toHaveBeenCalledWith('/area');
    expect(draftSeen).toEqual({ legalAccepted: true, dob: '1991-03-14', firstName: 'Ea', gh5: null });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('says why a date or a name is refused; an under-18 date still goes to the server, which decides', async () => {
    await renderStep(<AboutYou />);
    await fill({ name: 'ea@example.com', day: '31', month: '2' });
    expect(screen.getByText('Use 1–30 letters. No contact details.')).toBeOnTheScreen();
    expect(screen.getByText('That is not a valid date.')).toBeOnTheScreen();
    expect(screen.getByTestId('about-continue')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('first-name'), 'Ea');
    await fireEvent.changeText(screen.getByTestId('dob-day'), '1');
    await fireEvent.changeText(screen.getByTestId('dob-year'), String(new Date().getFullYear() - 10));
    expect(screen.getByText('Friendpod is only for people aged 18 and over.')).toBeOnTheScreen();
    expect(screen.getByTestId('about-continue')).toBeEnabled();
  });

  it('back on the first step returns to the welcome screen by signing out', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    await renderStep(<AboutYou />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('onboarding step 2, Where do you live?', () => {
  const answers = { legalAccepted: true, dob: '1991-03-14', firstName: 'Ea' } as const;

  it('turns the postcode into the ~5 km cell on the device and shows the area card', async () => {
    await renderStep(<Area />, answers);
    expect(screen.queryByTestId('area-card')).toBeNull();
    expect(screen.getByTestId('area-continue')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('postcode'), '8000');
    expect(draftSeen?.gh5).toBe(postcodeToGh5('8000'));
    expect(screen.getByText('Your area')).toBeOnTheScreen();
    expect(screen.getByText('Aarhus C')).toBeOnTheScreen();
    // Status from the bundled launch-area config (Aarhus is on the waitlist in areas.json).
    expect(screen.getByText('Aarhus opens soon')).toBeOnTheScreen();
    expect(screen.getByText(/We store only this area, never your address or exact location\./)).toBeOnTheScreen();
    expect(screen.getByTestId('area-continue')).toBeEnabled();
  });

  it('refuses an unknown postcode', async () => {
    await renderStep(<Area />, answers);
    await fireEvent.changeText(screen.getByTestId('postcode'), '0001');
    expect(screen.getByText("We don't know that postcode.")).toBeOnTheScreen();
    expect(draftSeen?.gh5).toBeNull();
    expect(screen.getByTestId('area-continue')).toBeDisabled();
  });

  it('runs completeOnboarding with the cell only (never the postcode), then starts the consent step on a fresh stack', async () => {
    mockCall.mockResolvedValue({ areaStatus: 'waitlist' });
    await renderStep(<Area />, answers);
    await fireEvent.changeText(screen.getByTestId('postcode'), '8000');
    await act(async () => await fireEvent.press(screen.getByTestId('area-continue')));
    await flush();
    expect(mockCall).toHaveBeenCalledTimes(1);
    const [name, input] = mockCall.mock.calls[0] as [string, unknown];
    expect(name).toBe('completeOnboarding');
    expect(completeOnboardingInput.parse(input)).toEqual({
      firstName: 'Ea',
      dob: '1991-03-14',
      locale: 'en',
      area: { gh5: postcodeToGh5('8000') },
      legal: LEGAL_DOC_VERSIONS,
    });
    expect(JSON.stringify(input)).not.toContain('8000');
    expect(mockSession.refreshClaims).toHaveBeenCalledTimes(1);
    expect(draftSeen?.dob).toBeNull();
    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/sensitive-consent');
  });

  it('the area card says whether Friendpod runs there: live, opening soon, or not open', async () => {
    const view = await renderStep(<AreaCard name="Aarhus C" area={{ label: 'Aarhus', status: 'live' }} />);
    expect(screen.getByText('Aarhus is live')).toBeOnTheScreen();
    await view.rerender(<AreaCard name="Aarhus C" area={{ label: 'Aarhus', status: 'waitlist' }} />);
    expect(screen.getByText('Aarhus opens soon')).toBeOnTheScreen();
    await view.rerender(<AreaCard name="Near you" area={null} />);
    expect(screen.getByText('Not open here yet')).toBeOnTheScreen();
    expect(screen.getByText(/^You can still sign up/)).toBeOnTheScreen();
  });

  it('credits the postcode data in the user\'s language', async () => {
    await renderStep(<Area />, answers);
    expect(screen.getByText('Postal code data: GeoNames (www.geonames.org)')).toBeOnTheScreen();
  });

  it('under 18: the server has deleted the sign-in; the answers are dropped and OK signs out', async () => {
    mockCall.mockRejectedValue({ code: 'UNDERAGE' });
    await renderStep(<Area />, answers);
    await fireEvent.changeText(screen.getByTestId('postcode'), '8000');
    await act(async () => await fireEvent.press(screen.getByTestId('area-continue')));
    await flush();
    expect(screen.getByText(/We have deleted your sign-in and kept nothing else about you\./)).toBeOnTheScreen();
    expect(draftSeen).toEqual({ legalAccepted: false, dob: null, firstName: null, gh5: null });
    expect(screen.queryByTestId('area-continue')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('onboarding step 5, Who would you like to meet?', () => {
  it('shows the defaults: ages, about-distances, languages and the availability grid', async () => {
    await renderStep(<PodPreferences />);
    expect(screen.getByText('Step 5 of 6')).toBeOnTheScreen();
    expect(screen.getByText('28–42')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'about 10 km' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Danish' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Saturday, daytime' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Weekdays, daytime' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Same-gender pods only' })).not.toBeChecked();
  });

  it('names the meetup languages in the reader\'s language, not as the app-language picker\'s endonyms', async () => {
    await i18n.changeLanguage('da');
    try {
      await renderStep(<PodPreferences />);
      expect(screen.getByRole('checkbox', { name: 'Dansk' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Engelsk' })).toBeChecked();
      expect(screen.queryByText('English')).toBeNull();
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  it('saves the changes (never sameGenderOnly, which has its own consent) and goes on to the last step', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderStep(<PodPreferences />);
    const low = screen.getByTestId('age-range-low');
    // The slider is adjustable by screen readers, one year per step.
    await fireEvent(low, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByText('29–42')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('radius-15'));
    await fireEvent.press(screen.getByTestId('availability-weekdayDay'));
    await fireEvent.press(screen.getByTestId('language-da'));
    await act(async () => await fireEvent.press(screen.getByTestId('prefs-continue')));
    await flush();
    expect(mockCall).toHaveBeenCalledWith('updateProfile', {
      prefs: { ageMin: 29, ageMax: 42, maxKm: 15, languages: ['en'], availability: PREFS.availability | AVAILABILITY.weekdayDay, openToAnyone: false },
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/almost-done');
  });

  it('draws the ages on a scale that gives the common ages room, with every year reachable', () => {
    // onb-prefs draws 28–42 at 22 % and 54 % of the track.
    expect(ageToFraction(28, MIN_AGE, MAX_AGE)).toBeCloseTo(0.22, 2);
    expect(ageToFraction(42, MIN_AGE, MAX_AGE)).toBeCloseTo(0.525, 2);
    expect(ageToFraction(MIN_AGE, MIN_AGE, MAX_AGE)).toBe(0);
    expect(ageToFraction(MAX_AGE, MIN_AGE, MAX_AGE)).toBe(1);
    let previous = -1;
    for (let age = MIN_AGE; age <= MAX_AGE; age++) {
      const at = ageToFraction(age, MIN_AGE, MAX_AGE);
      expect(at).toBeGreaterThan(previous);
      expect(Math.round(fractionToAge(at, MIN_AGE, MAX_AGE))).toBe(age);
      previous = at;
    }
  });

  it('keeps the age range at least 5 years wide', async () => {
    await renderStep(<PodPreferences />);
    const high = screen.getByTestId('age-range-high');
    for (let i = 0; i < 20; i++) await fireEvent(high, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(screen.getByText('28–33')).toBeOnTheScreen();
  });

  it('leaves "open to anyone" to the area\'s profile, as onb-prefs does, and saves it unchanged', async () => {
    mockUser = { prefs: { ...PREFS, openToAnyone: true }, photo: null };
    mockCall.mockResolvedValue({ ok: true });
    await renderStep(<PodPreferences />);
    expect(screen.queryByTestId('open-to-anyone')).toBeNull();
    await act(async () => await fireEvent.press(screen.getByTestId('prefs-continue')));
    await flush();
    expect(mockCall).toHaveBeenCalledWith('updateProfile', { prefs: expect.objectContaining({ openToAnyone: true }) });
  });

  it('keeps "open to anyone" in Settings → Preferences', async () => {
    await renderStep(<PreferencesForm initial={PREFS} locale="en" submitLabel="Save" onSaved={jest.fn()} />);
    expect(screen.getByRole('switch', { name: 'Open to meeting anyone' })).not.toBeChecked();
  });

  it('same-gender pods turn on only through their own sheet: a gender, the unticked consent, then the proof', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderStep(<PreferencesForm initial={PREFS} locale="en" submitLabel="Save" onSaved={jest.fn()} />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Same-gender pods only' }));
    expect(screen.getByTestId('gender-sheet')).toBeOnTheScreen();
    expect(screen.getByText('Same-gender pods')).toBeOnTheScreen();
    expect(screen.getByTestId('gender-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('gender-woman'));
    expect(screen.getByTestId('gender-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('gender-consent'));
    await act(async () => await fireEvent.press(screen.getByTestId('gender-confirm')));
    await flush();
    expect(mockCall).toHaveBeenCalledWith('updateProfile', {
      prefs: { sameGenderOnly: true },
      gender: 'woman',
      genderConsent: expect.objectContaining({ checked: true, textVersion: expect.any(String), textSha256: expect.any(String) }),
    });
    expect(screen.queryByTestId('gender-sheet')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Same-gender pods only' })).toBeChecked();
  });

  it('closing the same-gender sheet sends nothing and leaves the setting off', async () => {
    await renderStep(<PreferencesForm initial={PREFS} locale="en" submitLabel="Save" onSaved={jest.fn()} />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Same-gender pods only' }));
    await fireEvent.press(screen.getByTestId('gender-man'));
    // The close cross and the Cancel button under the actions both say "Cancel".
    const cancels = screen.getAllByRole('button', { name: 'Cancel' });
    expect(cancels).toHaveLength(2);
    await fireEvent.press(cancels[cancels.length - 1]!);
    expect(screen.queryByTestId('gender-sheet')).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Same-gender pods only' })).not.toBeChecked();
  });

  it('needs at least one time slot', async () => {
    await renderStep(<PodPreferences />);
    for (const slot of ['weekdayEvening', 'saturdayDay', 'sundayDay']) await fireEvent.press(screen.getByTestId(`availability-${slot}`));
    await act(async () => await fireEvent.press(screen.getByTestId('prefs-continue')));
    await flush();
    expect(screen.getByText('Pick at least one time.')).toBeOnTheScreen();
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('onboarding step 4, What are you into?', () => {
  it('goes back to the consent step; after a resume (no history) it opens that step in its place', async () => {
    await renderStep(<AddInterests />);
    expect(screen.getByText('Step 4 of 6')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await screen.unmount();

    mockRouter.canGoBack.mockReturnValue(false);
    await renderStep(<AddInterests />);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/sensitive-consent');
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('needs three interests before Continue', async () => {
    await renderStep(<AddInterests />);
    expect(screen.getByTestId('interests-continue')).toBeDisabled();
  });
});

describe('onboarding step 6, Almost done', () => {
  it('needs the safety pledge to finish; photo, About me and notifications are optional', async () => {
    await renderStep(<AlmostDone />);
    expect(screen.getByText('Step 6 of 6')).toBeOnTheScreen();
    expect(screen.getByText('Add a photo')).toBeOnTheScreen();
    const finish = screen.getByTestId('finish');
    expect(finish).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: /^I'll meet in public places/ }));
    expect(finish).toBeEnabled();
    await act(async () => await fireEvent.press(finish));
    await flush();
    expect(mockCall).not.toHaveBeenCalled();
    expect(mockSession.finishOnboarding).toHaveBeenCalledTimes(1);
  });

  it('saves "About me" on Finish, and refuses contact details before anything is sent', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await renderStep(<AlmostDone />);
    await fireEvent.press(screen.getByTestId('pledge'));
    await fireEvent.changeText(screen.getByTestId('about-me'), 'Text me on 12 34 56 78');
    expect(screen.getByText(/No contact details here/)).toBeOnTheScreen();
    expect(screen.getByTestId('finish')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('about-me'), 'New in town, always up for a game');
    expect(screen.getByText('33 / 140')).toBeOnTheScreen();
    await act(async () => await fireEvent.press(screen.getByTestId('finish')));
    await flush();
    expect(mockCall).toHaveBeenCalledWith('updateProfile', { aboutMe: 'New in town, always up for a game' });
    expect(mockSession.finishOnboarding).toHaveBeenCalledTimes(1);
  });

  it('does not finish when saving "About me" fails', async () => {
    mockCall.mockRejectedValue({ code: 'UNAVAILABLE' });
    await renderStep(<AlmostDone />);
    await fireEvent.press(screen.getByTestId('pledge'));
    await fireEvent.changeText(screen.getByTestId('about-me'), 'Always up for a game');
    await act(async () => await fireEvent.press(screen.getByTestId('finish')));
    await flush();
    expect(mockSession.finishOnboarding).not.toHaveBeenCalled();
  });

  it('asks for notifications in place and shows when they are on', async () => {
    await renderStep(<AlmostDone />);
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' })));
    await flush();
    expect(screen.getByText('Notifications are on')).toBeOnTheScreen();
  });

  it('a declined permission is fine: it says where to turn them on later', async () => {
    mockPush.request = false;
    await renderStep(<AlmostDone />);
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' })));
    await flush();
    expect(screen.getByText('Notifications are off. You can turn them on later in Settings.')).toBeOnTheScreen();
  });
});
