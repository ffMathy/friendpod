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
import { Button, ChipRow, ChoiceChip, ErrorText, Heading, Label, Small, Text, TextField } from '@/components/ui';
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
 * profile, §6.8).
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
      // onb-area spaces its blocks 24 apart, which pushes the area card's last line (the privacy promise) under the
      // pinned Continue on a 390×844 phone. 20 between blocks, 12 round "or", the standard button height and a
      // shorter map keep the whole card above the footer.
      gap={20}
      footer={
        underage ? (
          // The server has already deleted the Auth user (§3.1); this drops the local session and caches.
          <Button label={t('common.ok')} onPress={() => void signOut().catch(() => undefined)} />
        ) : (
          <Button testID="area-continue" label={t('common.continue')} disabled={!gh5} busy={complete.isPending} onPress={finish} />
        )
      }
    >
      <View style={styles.entry}>
        <View style={styles.field}>
          {/* The field's label as TextField draws it, at the storyboard's normal (~19 px) line height. */}
          <Label style={styles.label}>{t('onboarding.area.postcode')}</Label>
          <TextField
            testID="postcode"
            labelHidden
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
            variant="outline"
            icon="pin"
            busy={locating}
            onPress={() => void locate()}
          />
          {locationFailed ? <ErrorText>{t('onboarding.area.locationFailed')}</ErrorText> : null}
        </View>
      </View>

      {gh5 ? (
        <AreaCard
          name={district ?? launchArea?.label[locale] ?? t('onboarding.area.nearYou')}
          area={launchArea ? { label: launchArea.label[locale], status: launchArea.status } : null}
        />
      ) : null}

      <View style={styles.section} accessibilityRole="radiogroup" accessibilityLabel={t('onboarding.heardFrom.question')}>
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

/** "—— or ——" as onb-area draws it: 1 px lines and a 13 px muted word at its normal (~16 px) line height. */
function OrDivider({ label }: { readonly label: string }) {
  const p = usePalette();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: p.border }]} />
      <Text variant="caption" color="textMuted" style={styles.dividerLabel}>
        {label}
      </Text>
      <View style={[styles.line, { backgroundColor: p.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Postcode, "or" and the location button are one choice, so they sit closer together than the step's blocks.
  entry: { gap: 12 },
  field: { gap: 8 },
  label: { lineHeight: 19 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
  dividerLabel: { lineHeight: 16 },
  locate: { gap: 8 },
  section: { gap: 10 },
});
