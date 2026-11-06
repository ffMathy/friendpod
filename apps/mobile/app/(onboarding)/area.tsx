import {
  HEARD_FROM_SOURCES,
  POSTCODE_ATTRIBUTION,
  type HeardFromSource,
  type Locale,
  coordinatesToGh5,
  lookupPostcode,
  postcodeToGh5,
  resolveLaunchArea,
  type Gh5,
} from '@grouper/core';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { FontSize, HeroColors, Radius, Spacing, tightLine, usePalette } from '@/components/theme';
import {
  AppText,
  Banner,
  Body,
  Button,
  Card,
  ChipRow,
  ErrorText,
  Field,
  OrDivider,
  Pill,
  Screen,
  SectionTitle,
  StepHeader,
  Title,
  Toggle,
} from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { signOut } from '@/features/account/account';
import { useOnboardingDraft } from '@/features/onboarding/draft';
import { useSession } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal';
import { errorMessageKey } from '@/lib/errors';

/** Storyboards 1.2–1.7 number six steps; this is the second. */
const STEP = 2;
const STEPS = 6;

/**
 * Storyboard 1.3, §3.1 step 6: postcode (default, no permission) or approximate location (coarse permission). Either is
 * converted to a geohash-5 cell on the device and discarded; the server receives only `gh5`. Then
 * `completeOnboarding` runs with steps 3–6, plus the optional "Where did you hear about Grouper?" (one choice or none;
 * the server keeps only an aggregate counter per city and week, never the answer on the profile, §6.8).
 */
export default function Area() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refreshClaims } = useSession();
  const { draft, update, reset } = useOnboardingDraft();
  const [postcode, setPostcode] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const [heardFrom, setHeardFrom] = useState<HeardFromSource | null>(null);
  const complete = useCallable('completeOnboarding');

  const unknownPostcode = postcode.length === 4 && !lookupPostcode(postcode);
  const gh5: Gh5 | null = draft.gh5;
  const locale = currentLocale();
  // The server has deleted the Auth user; another attempt from this session must not be possible (§3.1).
  const underage = complete.error?.code === 'UNDERAGE';

  // Typing a postcode replaces any earlier choice: a known 4-digit postcode sets the cell at once, anything else clears
  // it. Only the cell enters the draft; the postcode lives in this field until the screen closes.
  const changePostcode = (text: string) => {
    setPostcode(text);
    update({ gh5: text.length === 4 ? postcodeToGh5(text) : null });
  };

  const locate = async () => {
    setLocating(true);
    setLocationFailed(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('denied');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
      update({ gh5: coordinatesToGh5(position.coords.latitude, position.coords.longitude) });
      setPostcode('');
    } catch {
      setLocationFailed(true);
    } finally {
      setLocating(false);
    }
  };

  const finish = () => {
    if (!gh5 || !draft.dob || !draft.firstName || !draft.legalAccepted) return;
    complete.mutate(
      { firstName: draft.firstName, dob: draft.dob, locale, area: { gh5 }, legal: LEGAL_DOC_VERSIONS, ...(heardFrom ? { heardFrom } : {}) },
      {
        onSuccess: async () => {
          update({ dob: null });
          await refreshClaims();
          router.replace('/sensitive-consent');
        },
        onError: (error) => {
          if (error.code === 'UNDERAGE') reset();
        },
      },
    );
  };

  return (
    <Screen
      wide
      gap={24}
      footer={
        <>
          {underage ? (
            <Banner
              tone="coral"
              accessibilityRole="alert"
              // The server has already deleted the Auth user (§3.1); this drops the local session and caches.
              actions={<Button label={t('common.ok')} size="md" inline onPress={() => void signOut().catch(() => undefined)} />}
            >
              {t('onboarding.area.underage')}
            </Banner>
          ) : complete.error ? (
            <ErrorText>{t(errorMessageKey(complete.error))}</ErrorText>
          ) : null}
          <Button label={t('common.continue')} variant="accent" disabled={!gh5 || underage} busy={complete.isPending} onPress={finish} />
        </>
      }
    >
      <StepHeader
        step={STEP}
        total={STEPS}
        stepLabel={t('onboarding.stepOf', { step: STEP, total: STEPS })}
        backLabel={underage ? undefined : t('common.back')}
        onBack={() => router.back()}
      />
      <View style={styles.stack}>
        <Title>{t('onboarding.area.heading')}</Title>
        <Body muted>{t('onboarding.area.lead')}</Body>
      </View>
      <Field
        label={t('onboarding.area.postcode')}
        value={postcode}
        onChangeText={changePostcode}
        keyboardType="number-pad"
        maxLength={4}
        autoComplete="postal-code"
        textContentType="postalCode"
        error={unknownPostcode ? t('onboarding.area.unknownPostcode') : null}
      />
      <OrDivider label={t('common.or')} />
      <View style={styles.stack}>
        <Button label={t('onboarding.area.useApproxLocation')} variant="secondary" icon="pin" busy={locating} onPress={() => void locate()} />
        {locationFailed ? <ErrorText>{t('onboarding.area.locationFailed')}</ErrorText> : null}
      </View>
      {gh5 ? <AreaCard gh5={gh5} locale={locale} /> : null}
      <View style={styles.stack}>
        <SectionTitle title={t('onboarding.heardFrom.question')} />
        <AppText variant="caption" tone="muted">
          {t('onboarding.heardFrom.hint')}
        </AppText>
        <ChipRow>
          {HEARD_FROM_SOURCES.map((source) => (
            <Toggle
              key={source}
              testID={`heard-from-${source}`}
              label={t(`onboarding.heardFrom.${source}`)}
              value={heardFrom === source}
              onChange={(on) => setHeardFrom(on ? source : null)}
            />
          ))}
        </ChipRow>
      </View>
      <AppText variant="micro" tone="muted">
        {POSTCODE_ATTRIBUTION}
      </AppText>
    </Screen>
  );
}

/** "Your area" (storyboard 1.3): the launch area the cell falls in and the city's status, or "not in your area yet". */
function AreaCard({ gh5, locale }: { gh5: Gh5; locale: Locale }) {
  const { t } = useTranslation();
  const area = resolveLaunchArea(gh5);
  return (
    // Appears as soon as a postcode or the location resolves; screen readers hear the result.
    <View accessibilityLiveRegion="polite">
      <Card padding={18} gap={Spacing.ms}>
        <View style={styles.cardHead}>
          <View style={styles.cardTitle}>
            <AppText variant="caption" tone="muted">
              {t('onboarding.area.title')}
            </AppText>
            <AppText variant="headline" style={styles.areaName}>
              {area ? area.label[locale] : t('onboarding.area.outside')}
            </AppText>
          </View>
          {area ? (
            // A sentence about the city ("Aarhus is live", "Aarhus opens soon"), not about the user, who is not on any list yet.
            <Pill label={t(`onboarding.area.status.${area.status}`, { city: area.label[locale] })} tone={area.status === 'live' ? 'mint' : 'amber'} />
          ) : null}
        </View>
        {area ? null : (
          <AppText variant="bodySm" tone="soft">
            {t('onboarding.area.outsideHint')}
          </AppText>
        )}
        <AreaMap />
        <AppText variant="caption" tone="muted">
          {t('onboarding.area.stored')}
        </AppText>
      </Card>
    </View>
  );
}

/** A schematic of a ~5 km cell between two roads; the same for everyone, so it shows nothing about where anyone lives. */
function AreaMap() {
  const p = usePalette();
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.map, { backgroundColor: p.subtle }]}>
      <View style={[styles.mapCell, { backgroundColor: HeroColors[2], borderColor: p.primary }]} />
      <View style={[styles.roadH, { backgroundColor: p.surface }]} />
      <View style={[styles.roadV, { backgroundColor: p.surface }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.sm },
  // The status pill names the city, so with a long name ("Copenhagen opens soon") it moves under the name rather than
  // squeezing it.
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: Spacing.ms, rowGap: Spacing.sm },
  cardTitle: { flexGrow: 1, flexShrink: 1, gap: Spacing.xxs },
  areaName: { ...tightLine(FontSize.h5, 26) },
  map: { height: 110, borderRadius: Radius.md, overflow: 'hidden' },
  // Positions from the storyboard's 304-pt-wide map, as fractions so it scales with the card.
  mapCell: { position: 'absolute', left: '39.5%', top: 18, width: '33%', height: 74, borderRadius: Radius.sm, borderWidth: 2, opacity: 0.55 },
  roadH: { position: 'absolute', left: '6.5%', right: 0, top: 60, height: 2 },
  roadV: { position: 'absolute', left: '62.5%', top: 0, bottom: 0, width: 2 },
});
