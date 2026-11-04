import { QUICK_REPLIES, type QuickReply } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  View,
  type HostInstance,
  type TextInputInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, ChipButton, ErrorText, Heading, Loading, Screen } from '@/components/ui';
import { Spacing, usePalette } from '@/components/theme';
import { usePod, usePodCard } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { toAppError } from '@/firebase/callables';
import { Composer } from '@/features/chat/Composer';
import { MessageBubble } from '@/features/chat/MessageBubble';
import { useChatMessages } from '@/features/chat/useChatMessages';
import { useSendMessage, type ChatContent } from '@/features/chat/useSendMessage';
import { useChatStatus } from '@/features/chat/window';
import { isConfirmedMember } from '@/features/pods/membership';
import { ScreenCaptureGuard } from '@/features/pods/ScreenCaptureGuard';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime, formatMessageTime } from '@/lib/format';

type NoticeKey = ReturnType<typeof errorMessageKey> | 'chat.cancelledChatClosed';

/**
 * Meetup chat (§3.6): current members only, writable from 24 h before until 24 h after the meetup, read-only
 * while messages exist outside it. Contact details before the meetup need "Send anyway"; every other member's
 * message can be reported.
 */
export default function Chat() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const messages = useChatMessages(uid, podId, member);
  const status = useChatStatus(pod.data);
  const { send, pending } = useSendMessage();
  const attendance = useCallable('confirmAttendance');
  const locale = currentLocale();

  const [draft, setDraft] = useState('');
  /** The exact text the server held back; the warning disappears as soon as the draft changes. */
  const [warnedText, setWarnedText] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeKey | null>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const listRef = useRef<FlatList>(null);
  // KeyboardAvoidingView measures itself against its parent only, so it needs the stack header's height.
  const frameRef = useRef<HostInstance>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  if (card.isLoading || (member && (pod.isLoading || messages.isLoading))) return <Loading label={t('common.loading')} />;
  if (!card.data || pod.data === null) {
    return (
      <Screen>
        <Body>{t('pod.gone')}</Body>
      </Screen>
    );
  }
  if (!member) {
    return (
      <Screen>
        <Body>{t('chat.membersOnly')}</Body>
      </Screen>
    );
  }
  if (!pod.data || !status) {
    return (
      <Screen>
        <ErrorText>{t('common.loadFailed')}</ErrorText>
      </Screen>
    );
  }

  const c = card.data;
  const roster = pod.data.roster;
  const rows = messages.data ?? [];
  const open = status.kind === 'open';
  const theme = c.themeLabel ?? t('pods.openToAnyone');
  const statusLine =
    status.kind === 'open'
      ? t('chat.openUntil', { when: formatDateTime(status.closesAt.getTime(), locale) })
      : status.kind === 'upcoming'
        ? t('chat.opens', { when: formatDateTime(status.opensAt.getTime(), locale) })
        : t('chat.closed');
  const closedNote =
    status.kind === 'upcoming'
      ? t('chat.notOpenYet')
      : status.kind === 'ended'
        ? t('chat.closedEnded')
        : rows.length > 0
          ? t('chat.closedOff')
          : t('chat.notScheduled');
  // An attendance answer only makes sense before the meetup has happened.
  const quickReplies = QUICK_REPLIES.filter((r) => r !== 'cantMakeIt' || pod.data?.state === 'scheduled');
  const warning = warnedText !== null && warnedText === draft;

  const authorName = (authorUid: string) =>
    authorUid === uid ? t('chat.you') : (roster[authorUid]?.firstName ?? t('member.formerMember'));

  const post = async (content: ChatContent, ackContactWarning = false): Promise<boolean> => {
    setNotice(null);
    const out = await send(podId, content, { ackContactWarning });
    switch (out.kind) {
      case 'sent':
        return true;
      case 'warned':
        setWarnedText('text' in content ? content.text : null);
        return false;
      case 'refused':
        setNotice(`errors.${out.code}`);
        return false;
      case 'failed':
        setNotice(errorMessageKey(out.error));
        return false;
    }
  };

  const sendDraft = async (ackContactWarning: boolean) => {
    const text = draft;
    if (await post({ text }, ackContactWarning)) {
      setWarnedText(null);
      // Keep anything typed while the message was on its way.
      setDraft((current) => (current === text ? '' : current));
    }
  };

  const cantMakeIt = async () => {
    setNotice(null);
    try {
      await attendance.mutateAsync({ podId, coming: false });
    } catch (e) {
      setNotice(errorMessageKey(toAppError(e)));
      return;
    }
    const out = await send(podId, { quickReply: 'cantMakeIt' });
    // Too few left coming: the pod went back to planning (or was cancelled) and the server closed the chat (§3.6).
    if (out.kind === 'failed') setNotice(out.error.code === 'CHAT_CLOSED' ? 'chat.cancelledChatClosed' : errorMessageKey(out.error));
  };

  const editWarned = () => {
    setWarnedText(null);
    inputRef.current?.focus();
  };

  const onQuickReply = (reply: QuickReply) => {
    if (pending || attendance.isPending) return;
    if (reply !== 'cantMakeIt') {
      void post({ quickReply: reply });
      return;
    }
    Alert.alert(t('chat.cantMakeItTitle'), t('chat.cantMakeItBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('chat.cantMakeItConfirm'), style: 'destructive', onPress: () => void cantMakeIt() },
    ]);
  };

  const report = (messageId: string) => router.push({ pathname: '/sheets/report', params: { podId, messageId } });

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: p.background }]} edges={['bottom', 'left', 'right']}>
      {c.themeSensitive ? <ScreenCaptureGuard /> : null}
      <View
        ref={frameRef}
        style={styles.flex}
        onLayout={() => frameRef.current?.measureInWindow((_x, y) => setKeyboardOffset(y))}
      >
        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={keyboardOffset} style={styles.flex}>
          <View style={[styles.header, { borderColor: p.border }]}>
            <Heading>{c.themeSensitive ? `🔒 ${theme}` : theme}</Heading>
            <Body muted>{statusLine}</Body>
          </View>
          <FlatList
            ref={listRef}
            style={styles.flex}
            contentContainerStyle={styles.list}
            data={rows}
            keyExtractor={(row) => row.id}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={open ? <Body muted>{t('chat.empty')}</Body> : undefined}
            renderItem={({ item }) => (
              <MessageBubble
                message={item.data}
                authorName={authorName(item.data.authorUid)}
                own={item.data.authorUid === uid}
                time={formatMessageTime(item.data.createdAt.toMillis(), locale)}
                {...(item.data.authorUid === uid ? {} : { onReport: () => report(item.id) })}
              />
            )}
          />
          <View style={[styles.footer, { borderColor: p.border }]}>
            {messages.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
            {open ? (
              <View accessibilityRole="toolbar" accessibilityLabel={t('chat.quickRepliesLabel')} style={styles.chips}>
                {quickReplies.map((r) => (
                  <ChipButton key={r} label={t(`chat.quickReplies.${r}`)} onPress={() => onQuickReply(r)} />
                ))}
              </View>
            ) : (
              <Body muted>{closedNote}</Body>
            )}
            {warning ? (
              <View style={[styles.warning, { backgroundColor: p.surface }]}>
                <Text accessibilityRole="alert" style={[styles.warningTitle, { color: p.text }]}>
                  {t('chat.contactWarning')}
                </Text>
                <Body muted>{t('chat.contactWarningDetail')}</Body>
                <View style={styles.warningActions}>
                  <View style={styles.flex}>
                    <Button label={t('chat.edit')} variant="secondary" onPress={editWarned} />
                  </View>
                  <View style={styles.flex}>
                    <Button label={t('chat.sendAnyway')} busy={pending} disabled={!open} onPress={() => void sendDraft(true)} />
                  </View>
                </View>
              </View>
            ) : null}
            {notice ? <ErrorText>{t(notice)}</ErrorText> : null}
            <Composer
              value={draft}
              onChangeText={setDraft}
              onSend={() => void sendDraft(false)}
              enabled={open}
              busy={pending || attendance.isPending}
              hideSend={warning}
              inputRef={inputRef}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  list: { padding: Spacing.md, gap: Spacing.sm },
  footer: { padding: Spacing.md, gap: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  warning: { borderRadius: 12, padding: Spacing.md, gap: Spacing.sm },
  warningTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  warningActions: { flexDirection: 'row', gap: Spacing.sm },
});
