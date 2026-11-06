import { REPORT_CATEGORIES, REPORT_TEXT_MAX, type ReportCategory } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/components/theme';
import { Banner, Button, ChoiceRow, ErrorText, Field, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { isConfirmedMember } from '@/features/pods/membership';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

/**
 * Report (§3.7, storyboard 4.3) of a member, an option or a chat message: the reporter is never revealed; "not a
 * genuine member" only in sensitive-themed pods (S7); every report points to 112 first. Replay-protected App Check (§9)
 * via the callable registry. A message report names no uid: the server takes the author from the message and keeps a
 * copy. Nobody reads reports (D2), so the copy never promises a review.
 */
export default function Report() {
  const { t } = useTranslation();
  const router = useRouter();
  const { podId, uid: targetUid, optionId, messageId } = useLocalSearchParams<{
    podId: string;
    uid?: string;
    optionId?: string;
    messageId?: string;
  }>();
  const card = usePodCard(useUid(), podId);
  // Only for the reported member's first name in the title; a report works without it.
  const pod = usePod(podId, isConfirmedMember(card.data));
  const report = useCallable('report');
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [text, setText] = useState('');
  const categories = REPORT_CATEGORIES.filter((c) => c !== 'notGenuine' || card.data?.themeSensitive === true);
  const name = targetUid ? pod.data?.roster[targetUid]?.firstName : undefined;

  const send = () => {
    if (!category) return;
    const target = messageId
      ? { type: 'message' as const, podId, messageId }
      : optionId
        ? { type: 'option' as const, podId, optionId, ...(targetUid ? { uid: targetUid } : {}) }
        : { type: 'user' as const, podId, uid: targetUid ?? '' };
    report.mutate({ target, category, ...(text.trim() ? { text: text.trim() } : {}) }, { onSuccess: () => router.back() });
  };

  const detailsLabel = t('report.tellUsMore');
  const anonymity = name ? t('report.anonymousName', { name }) : t('report.intro');

  return (
    <Screen
      gap={Spacing.md}
      footer={
        <>
          {report.error ? <ErrorText>{t(errorMessageKey(report.error))}</ErrorText> : null}
          <Button testID="report-send" label={t('report.send')} disabled={!category} busy={report.isPending} onPress={send} />
        </>
      }
    >
      <ScreenHeader size="md" title={name ? t('report.titleName', { name }) : t('report.title')} closeLabel={t('common.close')} onClose={router.back} />

      <Banner tone="coral" icon="shield" title={t('report.emergencyNow')} />
      {messageId ? <Banner tone="info">{t('report.messageCopy')}</Banner> : null}

      <View style={styles.section}>
        <SectionTitle title={t('report.whatHappened')} />
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {categories.map((c) => (
            <ChoiceRow key={c} testID={`report-${c}`} label={t(`report.reasons.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </View>

      <Field
        label={detailsLabel}
        optionalLabel={t('common.optional')}
        accessibilityLabel={`${detailsLabel} ${t('common.optional')}`}
        counter={t('report.counter', { length: text.length, max: REPORT_TEXT_MAX })}
        placeholder={t('report.placeholder')}
        hint={`${t('report.textHint')} ${anonymity}`}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={REPORT_TEXT_MAX}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  choices: { gap: Spacing.sm },
});
