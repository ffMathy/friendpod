import { REPORT_CATEGORIES, REPORT_TEXT_MAX, type ReportCategory } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '@/components/theme';
import { Button, CloseButton, ErrorText, Note, Screen, Text, Title } from '@/components/ui';
import { usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { NoteField, OptionRow, useTopPadding } from '@/features/after/parts';
import { isConfirmedMember } from '@/features/pods/membership';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

/**
 * Report (§3.7, after-report) of a member, an option or a chat message: the safety alert "In danger right now? Call
 * 112." on top (white, Danger border and phone icon, Ink text), one reason as white radio rows, optional text (max 500)
 * with a warning not to include sensitive details, and "Send report" in Skov. The reporter is never revealed; "not a
 * genuine member" only in sensitive-themed pods (S7). Replay-protected App Check (§9) via the callable registry. A
 * message report names no uid: the server takes the author from the message and keeps a copy.
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
  const pod = usePod(podId, isConfirmedMember(card.data));
  const report = useCallable('report');
  const top = useTopPadding();
  const insets = useSafeAreaInsets();
  // The storyboard leaves 28 px under "Send report" where Screen leaves 32; above a home indicator both use the inset.
  const footerNudge = Math.max(insets.bottom, STORYBOARD_BOTTOM) - Math.max(insets.bottom, Layout.bottom);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [text, setText] = useState('');
  const offered = REPORT_CATEGORIES.filter((c) => c !== 'notGenuine' || card.data?.themeSensitive === true);
  // A reported message is nearly always about what it says, so "Something they wrote" leads; same categories.
  const categories = messageId ? [...offered.filter((c) => c === 'content'), ...offered.filter((c) => c !== 'content')] : offered;
  // The reported member's first name as this pod shows it (user reports, and option reports that name the author).
  const name = !messageId && targetUid ? pod.data?.roster[targetUid]?.firstName : undefined;
  const title = messageId
    ? t('report.titleMessage')
    : optionId
      ? t('report.titleOption')
      : name
        ? t('report.titleName', { name })
        : t('report.titleMember');

  const close = () => router.back();

  const send = () => {
    if (!category) return;
    const target = messageId
      ? { type: 'message' as const, podId, messageId }
      : optionId
        ? { type: 'option' as const, podId, optionId, ...(targetUid ? { uid: targetUid } : {}) }
        : { type: 'user' as const, podId, uid: targetUid ?? '' };
    report.mutate({ target, category, ...(text.trim() ? { text: text.trim() } : {}) }, { onSuccess: close });
  };

  return (
    <Screen
      safeTop
      gutter="compact"
      gap={14}
      contentStyle={{ paddingTop: top }}
      footer={
        <View style={[styles.footer, { marginBottom: footerNudge }]}>
          {report.error ? <ErrorText>{t(errorMessageKey(report.error))}</ErrorText> : null}
          <Button testID="report-send" variant="primary" label={t('report.send')} disabled={!category} busy={report.isPending} onPress={send} />
        </View>
      }
    >
      <View style={styles.header}>
        <Title size="modal" style={styles.title}>
          {title}
        </Title>
        <CloseButton onPress={close} accessibilityLabel={t('common.close')} testID="report-close" />
      </View>

      <Note tone="safety" testID="report-112">
        <Text variant="smallBold" color="text" style={styles.safetyText}>
          {t('report.danger')}
        </Text>
      </Note>

      {messageId ? <Note tone="info">{t('report.messageCopy')}</Note> : null}

      <View style={styles.categories} accessibilityRole="radiogroup" accessibilityLabel={t('report.question')}>
        <Text variant="heading" style={styles.legend}>
          {t('report.question')}
        </Text>
        {categories.map((c) => (
          <OptionRow key={c} testID={`report-${c}`} label={t(`report.categories.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>

      <NoteField
        testID="report-text"
        label={t('report.textLabel')}
        value={text}
        onChangeText={setText}
        maxLength={REPORT_TEXT_MAX}
        placeholder={t('report.textPlaceholder')}
        helper={name ? t('report.textWarningName', { name }) : t('report.textWarning')}
      />
    </Screen>
  );
}

/** Space under the storyboard's bottom button. */
const STORYBOARD_BOTTOM = 28;

const styles = StyleSheet.create({
  footer: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, lineHeight: 30 },
  safetyText: { lineHeight: 20 },
  categories: { gap: 8 },
  // The storyboard's legend sits outside the fieldset's flex gap, with its own 8 px margin: the same 8 px as here.
  legend: { lineHeight: 20 },
});
