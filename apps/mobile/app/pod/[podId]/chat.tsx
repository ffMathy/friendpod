import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, KeyboardAvoidingView, StyleSheet, View, type HostInstance, type TextInputInstance } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Button, ErrorText, Icon, Loading, Screen, Strong, Text } from '@/components/ui';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
import { usePod, usePodCard } from '@/data/docs';
import { Composer } from '@/features/chat/Composer';
import { MessageBubble } from '@/features/chat/MessageBubble';
import { markChatSeen } from '@/features/chat/readMarker';
import { useChatMessages } from '@/features/chat/useChatMessages';
import { useSendMessage } from '@/features/chat/useSendMessage';
import { useChatStatus } from '@/features/chat/window';
import { isConfirmedMember } from '@/features/pods/membership';
import { MemberAvatar } from '@/features/pods/MemberAvatar';
import { goBack, SystemNote, usePodTopPadding } from '@/features/pods/parts';
import { podMembers } from '@/features/pods/PodMembers';
import { ScreenCaptureGuard } from '@/features/pods/ScreenCaptureGuard';
import { messageTime, weekdayAt } from '@/features/pods/time';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

type NoticeKey = ReturnType<typeof errorMessageKey>;

/**
 * Meetup chat (§3.6, pod-chat): current members only, writable from 24 h before until 24 h after the meetup, read-only
 * while messages exist outside it. Text only (D14): no quick replies, and "Can't make it" is on the pod's attendance
 * card. Contact details before the meetup need "Send anyway"; every other member's message can be reported.
 */
export default function Chat() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const top = usePodTopPadding();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const messages = useChatMessages(uid, podId, member);
  const status = useChatStatus(pod.data);
  const { send, pending } = useSendMessage();
  const locale = currentLocale();
  const [now] = useState(() => Date.now());

  const [draft, setDraft] = useState('');
  /** The exact text the server held back; the warning disappears as soon as the draft changes. */
  const [warnedText, setWarnedText] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeKey | null>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const listRef = useRef<FlatList>(null);
  // KeyboardAvoidingView measures itself against its parent only, so it needs the frame's offset in the window.
  const frameRef = useRef<HostInstance>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // "3 new" on the pod screen counts from the newest message seen here.
  const latest = (messages.data ?? []).reduce((max, r) => Math.max(max, r.data.createdAt.toMillis()), 0);
  useEffect(() => {
    if (member && latest > 0) markChatSeen(podId, latest);
  }, [member, podId, latest]);

  if (card.isLoading || (member && (pod.isLoading || messages.isLoading))) {
    return <Loading label={t('common.loading')} />;
  }
  const simple = (body: React.ReactNode) => (
    <Screen safeTop gutter="compact" contentStyle={{ paddingTop: top }}>
      <BackButton onPress={() => goBack(router)} accessibilityLabel={t('common.back')} />
      {body}
    </Screen>
  );
  if (!card.data || pod.data === null) {
    return simple(
      <Text variant="body" color="textSecondary">
        {t('pod.gone')}
      </Text>,
    );
  }
  if (!member) {
    return simple(
      <Text variant="body" color="textSecondary">
        {t('chat.membersOnly')}
      </Text>,
    );
  }
  if (!pod.data || !status) return simple(<ErrorText>{t('common.loadFailed')}</ErrorText>);

  const c = card.data;
  const roster = pod.data.roster;
  const others = podMembers(pod.data.memberUids, roster, uid).filter((m) => m.uid !== uid);
  const rows = messages.data ?? [];
  const open = status.kind === 'open';
  const theme = c.themeLabel ?? t('pods.openToAnyone');
  const statusLine =
    status.kind === 'open'
      ? t('chat.openUntil', { when: weekdayAt(t, status.closesAt.getTime(), locale) })
      : status.kind === 'upcoming'
        ? t('chat.opens', { when: weekdayAt(t, status.opensAt.getTime(), locale) })
        : t('chat.closed');
  const closedNote =
    status.kind === 'upcoming'
      ? t('chat.notOpenYet')
      : status.kind === 'ended'
        ? t('chat.closedEnded')
        : rows.length > 0
          ? t('chat.closedOff')
          : t('chat.notScheduled');
  const warning = warnedText !== null && warnedText === draft;

  const authorName = (authorUid: string) =>
    authorUid === uid ? t('chat.you') : (roster[authorUid]?.firstName ?? t('member.formerMember'));

  const post = async (text: string, ackContactWarning = false): Promise<boolean> => {
    setNotice(null);
    const out = await send(podId, text, { ackContactWarning });
    switch (out.kind) {
      case 'sent':
        return true;
      case 'warned':
        setWarnedText(text);
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
    if (await post(text, ackContactWarning)) {
      setWarnedText(null);
      // Keep anything typed while the message was on its way.
      setDraft((current) => (current === text ? '' : current));
    }
  };

  const editWarned = () => {
    setWarnedText(null);
    inputRef.current?.focus();
  };

  const report = (messageId: string) => router.push({ pathname: '/sheets/report', params: { podId, messageId } });

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: p.page }]} edges={['left', 'right']}>
      {c.themeSensitive ? <ScreenCaptureGuard /> : null}
      <View ref={frameRef} style={styles.flex} onLayout={() => frameRef.current?.measureInWindow((_x, y) => setKeyboardOffset(y))}>
        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={keyboardOffset} style={styles.flex}>
          <View style={[styles.header, { backgroundColor: p.surface, borderColor: p.border, paddingTop: insets.top + top }]}>
            <BackButton onPress={() => goBack(router)} accessibilityLabel={t('chat.backToPod')} />
            <View style={styles.headerText}>
              <View style={styles.titleRow}>
                {c.themeSensitive ? <Icon name="lock" size={16} color={p.privateText} accessibilityLabel={t('pods.privateInterest')} /> : null}
                <Text accessibilityRole="header" variant="cardTitle" numberOfLines={1} style={styles.shrink}>
                  {theme}
                </Text>
              </View>
              <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.statusLine}>
                {statusLine}
              </Text>
            </View>
            <View style={styles.faces}>
              {others.map((m, i) => (
                <View key={m.uid} style={i > 0 ? styles.overlap : null}>
                  <MemberAvatar uid={m.uid} name={m.firstName} size={30} photoV={m.photoV} ring />
                </View>
              ))}
            </View>
          </View>
          <FlatList
            ref={listRef}
            style={styles.flex}
            contentContainerStyle={styles.list}
            data={rows}
            keyExtractor={(row) => row.id}
            accessibilityLabel={t('chat.messages')}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={<SystemNote>{t('chat.privacyNote')}</SystemNote>}
            ListEmptyComponent={
              open ? (
                <Text variant="caption" color="textMuted" align="center">
                  {t('chat.empty')}
                </Text>
              ) : undefined
            }
            renderItem={({ item }) => (
              <MessageBubble
                message={item.data}
                authorName={authorName(item.data.authorUid)}
                own={item.data.authorUid === uid}
                time={messageTime(item.data.createdAt.toMillis(), now, locale)}
                {...(item.data.authorUid === uid ? {} : { onReport: () => report(item.id) })}
              />
            )}
          />
          <View style={[styles.footer, { backgroundColor: p.surface, borderColor: p.border, paddingBottom: Math.max(insets.bottom, 26) }]}>
            {messages.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
            {open ? null : (
              <Text variant="caption" color="textMuted" align="center">
                {closedNote}
              </Text>
            )}
            {warning ? (
              <View testID="chat-warning" style={[styles.warning, { backgroundColor: p.surface, borderColor: p.border }]}>
                <Text accessibilityRole="alert" variant="small" color="text" style={styles.warningText}>
                  <Strong>{t('chat.contactWarning')}</Strong> {t('chat.contactWarningDetail')}
                </Text>
                <View style={styles.warningActions}>
                  <Button label={t('chat.sendAnyway')} variant="secondary" size="xs" busy={pending} disabled={!open} onPress={() => void sendDraft(true)} />
                  <Button label={t('chat.edit')} variant="primary" size="xs" onPress={editWarned} />
                </View>
              </View>
            ) : null}
            {notice ? <ErrorText>{t(notice)}</ErrorText> : null}
            <Composer value={draft} onChangeText={setDraft} onSend={() => void sendDraft(false)} enabled={open} busy={pending} holdSend={warning} inputRef={inputRef} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  header: { paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: BorderWidth.hairline },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  // 13 px at its natural line height, so the header is 44 px tall as on the storyboard.
  statusLine: { lineHeight: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  faces: { flexDirection: 'row', paddingRight: 8 },
  overlap: { marginLeft: -9 },
  list: { paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  footer: { paddingTop: 10, paddingHorizontal: 12, gap: 10, borderTopWidth: BorderWidth.hairline },
  warning: { borderRadius: Radius.lg, borderWidth: BorderWidth.hairline, padding: 12, gap: 10 },
  warningText: { lineHeight: 20 },
  warningActions: { flexDirection: 'row', gap: 8 },
});
