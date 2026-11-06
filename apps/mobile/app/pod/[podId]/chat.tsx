import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, KeyboardAvoidingView, StyleSheet, Text, View, type HostInstance, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Radius, Spacing, Type, usePalette } from '@/components/theme';
import { AppText, Banner, Body, Button, ErrorText, Icon, IconButton, Loading, Screen, ScreenHeader } from '@/components/ui';
import { usePod, usePodCard } from '@/data/docs';
import { Composer } from '@/features/chat/Composer';
import { useMarkChatRead } from '@/features/chat/lastRead';
import { MessageBubble } from '@/features/chat/MessageBubble';
import { useChatMessages } from '@/features/chat/useChatMessages';
import { useSendMessage } from '@/features/chat/useSendMessage';
import { useChatStatus } from '@/features/chat/window';
import { MemberStack } from '@/features/pods/MemberCircle';
import { memberFills } from '@/features/pods/memberFill';
import { isConfirmedMember } from '@/features/pods/membership';
import { ScreenCaptureGuard } from '@/features/pods/ScreenCaptureGuard';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime, formatMessageTime } from '@/lib/format';

type NoticeKey = ReturnType<typeof errorMessageKey>;

/**
 * Meetup chat (§3.6; storyboard 3.5): current members only, writable from 24 h before until 24 h after the meetup,
 * read-only while messages exist outside it. Text only (D14): "Can't make it" is on the pod's attendance card. Contact
 * details before the meetup need "Send anyway"; every other member's message can be reported (press and hold).
 */
export default function Chat() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const uid = useUid();
  const card = usePodCard(uid, podId);
  const member = isConfirmedMember(card.data);
  const pod = usePod(podId, member);
  const messages = useChatMessages(uid, podId, member);
  // What this screen shows counts as read: the pod page's Chat row drops its "new" badge.
  useMarkChatRead(uid, podId, member ? messages.data : undefined);
  const status = useChatStatus(pod.data);
  const { send, pending } = useSendMessage();
  const locale = currentLocale();

  const [draft, setDraft] = useState('');
  /** The exact text the server held back; the warning disappears as soon as the draft changes. */
  const [warnedText, setWarnedText] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeKey | null>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const listRef = useRef<FlatList>(null);
  // KeyboardAvoidingView measures itself against its parent only, so it needs its own offset in the window.
  const frameRef = useRef<HostInstance>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/pod/[podId]', params: { podId } }, { withAnchor: true }));

  if (card.isLoading || (member && (pod.isLoading || messages.isLoading))) return <Loading label={t('common.loading')} />;
  const plain = (body: ReactNode) => (
    <Screen>
      <ScreenHeader title={t('chat.title')} size="sm" backLabel={t('common.back')} onBack={back} />
      {body}
    </Screen>
  );
  if (!card.data || pod.data === null) return plain(<Body>{t('pod.gone')}</Body>);
  if (!member) return plain(<Body>{t('chat.membersOnly')}</Body>);
  if (!pod.data || !status) return plain(<ErrorText>{t('common.loadFailed')}</ErrorText>);

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
  const warning = warnedText !== null && warnedText === draft;
  // One gentle paragraph with only its first sentence ("You haven't met yet.") in bold, as in the storyboard; the
  // reason (contact details found) is the screen reader's hint.
  const warningText = t('chat.contactWarning');
  const [, warningLead = warningText, warningRest = ''] = /^(.+?[.!?])\s+(.+)$/.exec(warningText) ?? [];
  // The other members in pod order, each in the colour they have on every pod screen.
  const fillOf = memberFills(pod.data.memberUids, uid);
  const others = pod.data.memberUids.flatMap((memberUid) => {
    const entry = roster[memberUid];
    return memberUid !== uid && entry ? [{ uid: memberUid, name: entry.firstName, fill: fillOf(memberUid) }] : [];
  });

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
    <View style={[styles.flex, { backgroundColor: p.ground }]}>
      {c.themeSensitive ? <ScreenCaptureGuard /> : null}
      <View ref={frameRef} style={styles.flex} onLayout={() => frameRef.current?.measureInWindow((_x, y) => setKeyboardOffset(y))}>
        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={keyboardOffset} style={styles.flex}>
          <View
            style={[
              styles.header,
              { paddingTop: insets.top + Spacing.sm, paddingLeft: insets.left + Spacing.ms, paddingRight: insets.right + Spacing.ms },
              { backgroundColor: p.surface, borderBottomColor: p.border },
            ]}
          >
            <IconButton icon="chevronLeft" label={t('common.back')} onPress={back} />
            <View style={styles.headerText}>
              <View style={styles.titleRow}>
                {c.themeSensitive ? <Icon name="lock" size={16} color={p.violet} /> : null}
                <AppText
                  accessibilityRole="header"
                  accessibilityLabel={c.themeSensitive ? t('interests.privateLabel', { name: theme }) : undefined}
                  variant="heading"
                  numberOfLines={1}
                  style={styles.flexShrink}
                >
                  {theme}
                </AppText>
              </View>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {statusLine}
              </AppText>
            </View>
            {others.length > 0 ? (
              <View style={styles.avatars}>
                <MemberStack members={others} size={30} max={5} youLabel={t('chat.you')} />
              </View>
            ) : null}
          </View>
          <FlatList
            ref={listRef}
            style={styles.flex}
            contentContainerStyle={[styles.list, { paddingLeft: insets.left + Spacing.md, paddingRight: insets.right + Spacing.md }]}
            data={rows}
            keyExtractor={(row) => row.id}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              <Text style={[Type.micro, styles.notice, { color: p.muted, backgroundColor: p.subtle }]}>{t('chat.notice')}</Text>
            }
            ListEmptyComponent={
              open ? (
                <Body size="sm" muted align="center">
                  {t('chat.empty')}
                </Body>
              ) : undefined
            }
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
          <View
            style={[
              styles.footer,
              { paddingBottom: insets.bottom + Spacing.ms, paddingLeft: insets.left + Spacing.ms, paddingRight: insets.right + Spacing.ms },
              { backgroundColor: p.surface, borderTopColor: p.border },
            ]}
          >
            {messages.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
            {open ? null : (
              <Banner tone="subtle" icon="clock">
                {closedNote}
              </Banner>
            )}
            {warning ? (
              <View style={[styles.warning, { backgroundColor: p.amberBg, borderColor: p.amberBorder }]}>
                <Text
                  accessibilityRole="alert"
                  accessibilityLabel={warningText}
                  accessibilityHint={t('chat.contactWarningDetail')}
                  style={[Type.bodySm, { color: p.amberInk }]}
                >
                  <Text style={Fonts.bold}>{warningLead}</Text>
                  {warningRest ? ` ${warningRest}` : null}
                </Text>
                <View style={styles.warningActions}>
                  <Button label={t('chat.sendAnyway')} size="xs" inline busy={pending} disabled={!open} onPress={() => void sendDraft(true)} />
                  <Button label={t('chat.edit')} variant="secondary" size="xs" inline onPress={editWarned} />
                </View>
              </View>
            ) : null}
            {notice ? <ErrorText>{t(notice)}</ErrorText> : null}
            <Composer
              value={draft}
              onChangeText={setDraft}
              onSend={() => void sendDraft(false)}
              enabled={open}
              busy={pending}
              hideSend={warning}
              inputRef={inputRef}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: Spacing.ms, borderBottomWidth: 1 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatars: { paddingRight: Spacing.sm },
  list: { paddingVertical: 14, gap: 10 },
  notice: { alignSelf: 'center', maxWidth: 300, textAlign: 'center', borderRadius: Radius.sm + 2, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.ms, marginBottom: Spacing.xs, overflow: 'hidden' },
  footer: { paddingTop: 10, gap: 10, borderTopWidth: 1 },
  warning: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.ms, gap: 10 },
  warningActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
