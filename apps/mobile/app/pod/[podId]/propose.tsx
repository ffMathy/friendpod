import type { Place } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, CloseButton, ErrorText, Loading, Screen, Text, Title } from '@/components/ui';
import { Layout } from '@/components/theme';
import { usePodCard, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { PlacePicker } from '@/features/places/PlacePicker';
import { isConfirmedMember } from '@/features/pods/membership';
import { validateOptionForm, type OptionFormError } from '@/features/pods/optionForm';
import { goBack, usePodTopPadding } from '@/features/pods/parts';
import { WhenFields } from '@/features/pods/WhenFields';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/**
 * Suggest a time and a public place (§3.5, pod-propose): a day and a time picked from what the planner allows (within
 * 14 days, between 08:00 and 22:00), and a place picked from Google Places search (D8), so there is no free-text place
 * and no "public place" tick. The server decides; the form catches most mistakes first. On success it closes back to
 * the planner.
 */
export default function Propose() {
  const { t } = useTranslation();
  const router = useRouter();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const planning = isConfirmedMember(card.data) && card.data?.state === 'planning';
  const user = useUserDoc(uid);
  const propose = useCallable('proposeOption');
  const top = usePodTopPadding(32);
  const insets = useSafeAreaInsets();
  // The storyboard ends 28 px above the edge, as the planner's PodPage does; Screen's footer keeps 32.
  const footerPull = Math.max(insets.bottom, 28) - Math.max(insets.bottom, Layout.bottom);
  const locale = currentLocale();
  const [openedAt] = useState(() => Date.now());

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [formError, setFormError] = useState<OptionFormError | null>(null);

  const close = () => goBack(router);
  const header = (
    <View style={styles.header}>
      <Title size="modal" style={styles.flex}>
        {t('plan.proposeTitle')}
      </Title>
      <CloseButton onPress={close} accessibilityLabel={t('common.close')} />
    </View>
  );

  if (card.isLoading) {
    return <Loading label={t('common.loading')} />;
  }
  if (!planning) {
    return (
      <Screen safeTop gutter="compact" contentStyle={{ paddingTop: top }}>
        {header}
        <Text variant="body" color="textSecondary">
          {t('plan.notPlanning')}
        </Text>
      </Screen>
    );
  }

  const submit = () => {
    const v = validateOptionForm({ date, time, place }, Date.now());
    if (!v.ok) {
      setFormError(v.error);
      return;
    }
    setFormError(null);
    propose.mutate({ podId, startsAt: v.startsAt, place: v.place }, { onSuccess: close });
  };

  return (
    <Screen
      safeTop
      gutter="compact"
      gap={16}
      contentStyle={{ paddingTop: top }}
      footer={
        <View style={[styles.footer, { marginBottom: footerPull }]}>
          {formError ? <ErrorText>{t(`plan.errors.${formError}`)}</ErrorText> : null}
          {propose.error ? <ErrorText>{t(errorMessageKey(propose.error))}</ErrorText> : null}
          <Button testID="option-propose" label={t('plan.propose')} busy={propose.isPending} onPress={submit} />
        </View>
      }
    >
      {header}
      <WhenFields date={date} time={time} onDate={setDate} onTime={setTime} now={openedAt} />
      <PlacePicker language={locale} gh5={user.data?.area.gh5 ?? null} value={place} onChange={setPlace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  footer: { gap: 12 },
});
