import { REPORT_CATEGORIES, REPORT_TEXT_MAX, type ReportCategory } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, ChipRow, ErrorText, Field, Screen, Toggle } from '@/components/ui';
import { usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { useUid } from '@/features/session/SessionProvider';
import { errorMessageKey } from '@/lib/errors';

/**
 * Report (§3.7) of a member, an option or a chat message: the reporter is never revealed; "not a genuine member"
 * only in sensitive-themed pods (S7); safety reports point to 112. Replay-protected App Check (§9) via the
 * callable registry. A message report names no uid: the server takes the author from the message and keeps a copy.
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
  const report = useCallable('report');
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [text, setText] = useState('');
  const categories = REPORT_CATEGORIES.filter((c) => c !== 'notGenuine' || card.data?.themeSensitive === true);

  const send = () => {
    if (!category) return;
    const target = messageId
      ? { type: 'message' as const, podId, messageId }
      : optionId
        ? { type: 'option' as const, podId, optionId, ...(targetUid ? { uid: targetUid } : {}) }
        : { type: 'user' as const, podId, uid: targetUid ?? '' };
    report.mutate({ target, category, ...(text.trim() ? { text: text.trim() } : {}) }, { onSuccess: () => router.back() });
  };

  return (
    <Screen>
      <Body>{t('report.intro')}</Body>
      {messageId ? <Body muted>{t('report.messageCopy')}</Body> : null}
      <ChipRow>
        {categories.map((c) => (
          <Toggle key={c} label={t(`report.categories.${c}`)} value={category === c} onChange={() => setCategory(c)} />
        ))}
      </ChipRow>
      {category === 'safety' ? <ErrorText>{t('report.emergency')}</ErrorText> : null}
      <Field label={t('report.textLabel')} value={text} onChangeText={setText} multiline maxLength={REPORT_TEXT_MAX} />
      <Body muted>{t('report.textWarning')}</Body>
      {report.error ? <ErrorText>{t(errorMessageKey(report.error))}</ErrorText> : null}
      <Button label={t('report.send')} disabled={!category} busy={report.isPending} onPress={send} />
    </Screen>
  );
}
