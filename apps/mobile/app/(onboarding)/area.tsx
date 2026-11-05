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
import { Body, Button, Card, Checkbox, ErrorText, Field, Heading, Screen } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { signOut } from '@/features/account/account';
import { useOnboardingDraft } from '@/features/onboarding/draft';
import { useSession } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal';
import { errorMessageKey } from '@/lib/errors';

/**
 * §3.1 step 6: postcode (default, no permission) or approximate location (coarse permission). Either is
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

  const place = postcode.length === 4 ? lookupPostcode(postcode) : null;
  const gh5: Gh5 | null = draft.gh5;
  const area = gh5 ? resolveLaunchArea(gh5) : null;
  const locale = currentLocale();
  // The server has deleted the Auth user; another attempt from this session must not be possible (§3.1).
  const underage = complete.error?.code === 'UNDERAGE';

  const applyPostcode = () => {
    const cell = postcodeToGh5(postcode);
    if (cell) update({ gh5: cell });
    setPostcode('');
  };

  const locate = async () => {
    setLocating(true);
    setLocationFailed(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('denied');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
      update({ gh5: coordinatesToGh5(position.coords.latitude, position.coords.longitude) });
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
    <Screen>
      <Heading>{t('onboarding.area.title')}</Heading>
      <Body muted>{t('onboarding.area.privacy')}</Body>
      <Field label={t('onboarding.area.postcode')} value={postcode} onChangeText={setPostcode} keyboardType="number-pad" maxLength={4} />
      {postcode.length === 4 && !place ? <ErrorText>{t('onboarding.area.unknownPostcode')}</ErrorText> : null}
      <Button label={place ? t('onboarding.area.usePostcode', { name: place.name }) : t('onboarding.area.usePostcodeShort')} disabled={!place} onPress={applyPostcode} />
      <Button label={t('onboarding.area.useLocation')} variant="secondary" busy={locating} onPress={() => void locate()} />
      {locationFailed ? <ErrorText>{t('onboarding.area.locationFailed')}</ErrorText> : null}
      {gh5 ? (
        <Card>
          <Body bold>{area ? area.label[locale] : t('onboarding.area.outside')}</Body>
          <Body muted>{area ? t(`areaStatus.${area.status}`) : t('onboarding.area.outsideHint')}</Body>
        </Card>
      ) : null}
      <Card>
        <Body bold>{t('onboarding.heardFrom.question')}</Body>
        <Body muted>{t('onboarding.heardFrom.hint')}</Body>
        {HEARD_FROM_SOURCES.map((source) => (
          <Checkbox
            key={source}
            testID={`heard-from-${source}`}
            label={t(`onboarding.heardFrom.${source}`)}
            checked={heardFrom === source}
            onChange={(checked) => setHeardFrom(checked ? source : null)}
          />
        ))}
      </Card>
      {underage ? (
        <>
          <ErrorText>{t('onboarding.area.underage')}</ErrorText>
          {/* The server has already deleted the Auth user (§3.1); this drops the local session and caches. */}
          <Button label={t('common.ok')} onPress={() => void signOut().catch(() => undefined)} />
        </>
      ) : complete.error ? (
        <ErrorText>{t(errorMessageKey(complete.error))}</ErrorText>
      ) : null}
      <Button label={t('common.continue')} disabled={!gh5 || underage} busy={complete.isPending} onPress={finish} />
      <Body muted>{POSTCODE_ATTRIBUTION}</Body>
    </Screen>
  );
}
