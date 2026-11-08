import {
  HEARD_FROM_SOURCES,
  POSTCODE_ATTRIBUTION,
  type HeardFromSource,
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
import { usePalette } from '@/components/theme';
import { Button, ChipRow, ChoiceChip, ErrorText, Heading, Small, Text, TextField } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { signOut } from '@/features/account/account';
import { AreaCard } from '@/features/onboarding/AreaCard';
import { useOnboardingDraft } from '@/features/onboarding/draft';
import { OnboardingStep, useStepBack } from '@/features/onboarding/OnboardingStep';
import { useSession } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal';
import { errorMessageKey } from '@/lib/errors';

/** "GeoNames (www.geonames.org)": the credited source from core's CC BY attribution, introduced in the user's language. */
const POSTCODE_SOURCE = POSTCODE_ATTRIBUTION.replace(/^[^:]*:\s*/, '');

/**
 * Step 2 of 6, "Where do you live?" (onb-area; DESIGN §3.1 step 6): postcode (default, no permission) or approximate
 * location (coarse permission). Either is converted to a geohash-5 cell on the device and discarded; the server
 * receives only `gh5`. Continue runs `completeOnboarding` with steps 3–6, plus the optional "Where did you hear about
 * Grouper?" (one choice or none; the server keeps only an aggregate counter per city and week, never the answer on the
 * profile, §6.8). As onb-area draws it: the 52 px postcode field, "or", "Use my approximate location" (secondary, pin), and
 * the white "Your area" card; the source question and the data credit follow, under what the storyboard shows.
 */
export default function Area() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useStepBack();
  const { refreshClaims } = useSession();
  const { draft, update, reset } = useOnboardingDraft();
  const [postcode, setPostcode] = useState('');
  /** The postcode's district ("Aarhus C"), shown on the card; never stored or sent. */
  const [district, setDistrict] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const [heardFrom, setHeardFrom] = useState<HeardFromSource | null>(null);
  const complete = useCallable('completeOnboarding');

  const gh5: Gh5 | null = draft.gh5;
  const launchArea = gh5 ? resolveLaunchArea(gh5) : null;
  const locale = currentLocale();
  const unknownPostcode = postcode.length === 4 && !lookupPostcode(postcode);
  // The server has deleted the Auth user; another attempt from this session must not be possible (§3.1).
  const underage = complete.error?.code === 'UNDERAGE';

  const changePostcode = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPostcode(digits);
    setLocationFailed(false);
    const place = digits.length === 4 ? lookupPostcode(digits) : null;
    if (place) {
      update({ gh5: postcodeToGh5(digits) });
      setDistrict(place.name);
    } else if (digits.length > 0) {
      update({ gh5: null });
      setDistrict(null);
    }
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
      setDistrict(null);
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
          // Steps 1–2 are on the server now and cannot be changed from here: the consent step starts a fresh stack.
          if (router.canDismiss()) router.dismissAll();
          router.replace('/sensitive-consent');
        },
        onError: (error) => {
          if (error.code === 'UNDERAGE') reset();
        },
      },
    );
  };

  return (
    <OnboardingStep
      step={2}
      title={t('onboarding.area.title')}
      lede={t('onboarding.area.lede')}
      onBack={back}
      footer={
        underage ? (
          // The server has already deleted the Auth user (§3.1); this drops the local session and caches.
          <Button label={t('common.ok')} onPress={() => void signOut().catch(() => undefined)} />
        ) : (
          <Button testID="area-continue" label={t('common.continue')} disabled={!gh5} busy={complete.isPending} onPress={finish} />
        )
      }
    >
      <View style={styles.postcode}>
        <TextField
          testID="postcode"
          size="md"
          label={t('onboarding.area.postcode')}
          value={postcode}
          onChangeText={changePostcode}
          keyboardType="number-pad"
          autoComplete="postal-code"
          textContentType="postalCode"
          maxLength={4}
          error={unknownPostcode ? t('onboarding.area.unknownPostcode') : null}
        />
      </View>

      <OrDivider label={t('common.or')} />

      <View style={styles.locate}>
        <Button
          testID="use-location"
          label={t('onboarding.area.useLocation')}
          variant="secondary"
          icon="pin"
          busy={locating}
          onPress={() => void locate()}
        />
        {locationFailed ? <ErrorText>{t('onboarding.area.locationFailed')}</ErrorText> : null}
      </View>

      {gh5 ? (
        <AreaCard
          name={district ?? launchArea?.label[locale] ?? t('onboarding.area.nearYou')}
          area={launchArea ? { label: launchArea.label[locale], status: launchArea.status } : null}
        />
      ) : null}

      {/* The app's own optional question (DESIGN §3.1 step 6, F37), after what the storyboard draws. */}
      <View style={[styles.block, styles.section]} accessibilityRole="radiogroup" accessibilityLabel={t('onboarding.heardFrom.question')}>
        <Heading>
          {t('onboarding.heardFrom.question')}
          <Text variant="heading" weight="500" color="textMuted">{` ${t('common.optional')}`}</Text>
        </Heading>
        <Small>{t('onboarding.heardFrom.hint')}</Small>
        <ChipRow>
          {HEARD_FROM_SOURCES.map((source) => (
            <ChoiceChip
              key={source}
              testID={`heard-from-${source}`}
              size="sm"
              label={t(`onboarding.heardFrom.${source}`)}
              selected={heardFrom === source}
              onPress={() => setHeardFrom((current) => (current === source ? null : source))}
            />
          ))}
        </ChipRow>
      </View>

      {underage ? (
        <ErrorText>{t('onboarding.area.underage')}</ErrorText>
      ) : complete.error ? (
        <ErrorText>{t(errorMessageKey(complete.error))}</ErrorText>
      ) : null}

      <Text variant="micro" color="textMuted">
        {t('onboarding.area.attribution', { source: POSTCODE_SOURCE })}
      </Text>
    </OnboardingStep>
  );
}

/** "—— or ——" as onb-area draws it: 1 px Line rules and a 13/600 Muted word. */
function OrDivider({ label }: { readonly label: string }) {
  const p = usePalette();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: p.border }]} />
      <Text variant="captionStrong" color="textMuted">
        {label}
      </Text>
      <View style={[styles.line, { backgroundColor: p.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // onb-area adds 4 px above the postcode field (16 under the lede with the step's 12) and sets its label 15/20;
  // TextField's label line is 22, so 2 px here put the field, and everything under it, where the storyboard has them.
  postcode: { paddingTop: 2 },
  block: { paddingTop: 4 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
  locate: { gap: 8 },
  section: { gap: 10 },
});
