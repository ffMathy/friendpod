/**
 * Building blocks of the confirmed pod page (§3.4, D13; storyboards 3.1 "Pod confirmed" and 3.4 "Pod page"): the
 * inline header, the green "Confirmed" hero with the members, the Members list, the pod interests, the Chat entry and
 * "Meeting safely". Everything shown comes from the pod doc and the viewer's card; nothing is made up.
 */
import type { AttendanceStatus, PodDoc } from '@grouper/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Fonts, Radius, Spacing, Type, usePalette } from '@/components/theme';
import { AppText, Card, ChipRow, Icon, IconButton, ListGroup, Pill, Row, SwitchRow } from '@/components/ui';
import { MemberAvatar } from './MemberAvatar';
import { memberFills, viewerLast } from './memberFill';

/** Safety tips (§4.5), the same list as the Safety tips page. */
const SAFETY_TIPS = ['public', 'transport', 'tellFriend', 'leave', 'drink', 'address', 'report'] as const;

// ---------------------------------------------------------------------------------------------------------------

export interface PodHeaderProps {
  readonly theme: string;
  readonly sensitive: boolean;
  /** "5 people near Aarhus C". */
  readonly subtitle?: string;
  readonly backLabel: string;
  readonly onBack: () => void;
  /** E.g. a state pill ("Met", "Archived"). */
  readonly right?: ReactNode;
}

/** Storyboard 3.4's header: back chevron, the theme (24/800, a lock for a private interest) and a 13-pt line. */
export function PodHeader({ theme, sensitive, subtitle, backLabel, onBack, right }: PodHeaderProps) {
  const { t } = useTranslation();
  const p = usePalette();
  return (
    <View style={styles.header}>
      <IconButton icon="chevronLeft" label={backLabel} onPress={onBack} style={styles.back} />
      <View style={styles.headerText}>
        <View style={styles.titleRow}>
          {sensitive ? <Icon name="lock" size={18} color={p.violet} /> : null}
          <AppText
            accessibilityRole="header"
            accessibilityLabel={sensitive ? t('interests.privateLabel', { name: theme }) : undefined}
            variant="titleSm"
            style={styles.flexShrink}
          >
            {theme}
          </AppText>
        </View>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export interface PodHeroProps {
  readonly uid: string;
  readonly pod: PodDoc;
  readonly theme: string;
  readonly sensitive: boolean;
  readonly subtitle: string;
}

/**
 * Storyboard 3.1: the green hero right after confirmation, with an amber "Confirmed" badge, the theme, size and area,
 * and every member's avatar and first name, the viewer last as "You". Each member has their pod colour, with the
 * green fill swapped for its mint tint on the green card. The avatar row is decorative: the Members list below names
 * the same people for screen readers and opens their sheets.
 */
export function PodHero({ uid, pod, theme, sensitive, subtitle }: PodHeroProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const { width } = useWindowDimensions();
  const fillOf = memberFills(pod.memberUids, uid, true);
  const members = viewerLast(pod.memberUids, uid).flatMap((memberUid) => {
    const entry = pod.roster[memberUid];
    return entry ? [{ memberUid, entry }] : [];
  });
  // Up to six columns across the card (screen gutter 20 and card padding 22 on each side, 6 apart).
  const columns = Math.max(members.length, 1);
  const avatar = Math.max(32, Math.min(52, Math.floor((width - 2 * (Spacing.gutter + 22) - 6 * (columns - 1)) / columns)));

  return (
    <Card tone="forest" radius="xl" padding={22} gap={14}>
      <Pill tone="amber" label={t('pod.confirmed')} />
      <View style={styles.heroTitle}>
        {sensitive ? <Icon name="lock" size={26} color={p.onForest} style={styles.heroLock} /> : null}
        <AppText
          accessibilityRole="header"
          accessibilityLabel={sensitive ? t('interests.privateLabel', { name: theme }) : undefined}
          style={[styles.heroTheme, styles.flexShrink]}
        >
          {theme}
        </AppText>
      </View>
      <AppText variant="bodySm" tone="muted">
        {subtitle}
      </AppText>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroMembers}>
        {members.map(({ memberUid, entry }) => (
          <View key={memberUid} style={styles.heroMember}>
            <MemberAvatar
              uid={memberUid}
              name={entry.firstName}
              size={avatar}
              fill={fillOf(memberUid)}
              photoV={entry.photoV}
              you={memberUid === uid}
              youLabel={t('chat.you')}
              // The viewer's ink circle has a light ring on the green card, as in the storyboard.
              ring={memberUid === uid ? p.onForest : undefined}
            />
            <AppText variant="caption" numberOfLines={1} style={Fonts.bold}>
              {entry.firstName}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export interface PodMembersProps {
  readonly uid: string;
  readonly pod: PodDoc;
  readonly onOpen: (memberUid: string) => void;
  /** Sensitive-themed pods: the viewer's own "Show my photo to this pod" switch (S6). */
  readonly photoShare?: { readonly value: boolean; readonly onChange: (share: boolean) => void; readonly disabled: boolean };
}

/**
 * Storyboard 3.4 "Members": a white list with each member's avatar (their pod colour, or their photo where the roster
 * has one), first name, "about me" sentence (F19) and, while the meetup is scheduled, whether they are coming
 * ("Hasn't confirmed" for `unconfirmed`, D5). Each row opens the member's sheet, where block and report live (§3.7).
 */
export function PodMembers({ uid, pod, onOpen, photoShare }: PodMembersProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const statusLook = (status: AttendanceStatus): { label: string; color: string } | null => {
    switch (status) {
      case 'coming':
        return { label: t('attendance.other.coming'), color: p.primary };
      case 'notComing':
        return { label: t('attendance.other.notComing'), color: p.muted };
      case 'unconfirmed':
        return { label: t('attendance.other.unconfirmed'), color: p.amberText };
      case 'pending':
        return null;
    }
  };

  const fillOf = memberFills(pod.memberUids, uid);

  return (
    <ListGroup title={t('pod.sections.members')}>
      {pod.memberUids.flatMap((memberUid) => {
        const entry = pod.roster[memberUid];
        if (!entry) return [];
        const self = memberUid === uid;
        const attendance = pod.state === 'scheduled' ? pod.attendance?.[memberUid] : undefined;
        const status = self || attendance === undefined ? null : statusLook(attendance);
        const label = self ? t('pod.you', { name: entry.firstName }) : entry.firstName;
        return [
          <Row
            key={memberUid}
            title={label}
            subtitle={entry.aboutMe}
            leading={
              <MemberAvatar
                uid={memberUid}
                name={entry.firstName}
                size={32}
                fill={fillOf(memberUid)}
                photoV={entry.photoV}
                photoLabel={t('pod.photoOf', { name: entry.firstName })}
                you={self}
                youLabel={t('chat.you')}
              />
            }
            trailing={
              status ? (
                <AppText variant="caption" color={status.color} style={Fonts.bold}>
                  {status.label}
                </AppText>
              ) : undefined
            }
            chevron={false}
            accessibilityRole="link"
            accessibilityLabel={[label, status?.label, entry.aboutMe].filter(Boolean).join(', ')}
            onPress={() => onOpen(memberUid)}
            testID={`member-${memberUid}`}
          />,
        ];
      })}
      {photoShare ? (
        <SwitchRow
          variant="plain"
          label={t('pod.showMyPhoto')}
          value={photoShare.value}
          disabled={photoShare.disabled}
          onChange={photoShare.onChange}
          testID="show-my-photo"
        />
      ) : null}
    </ListGroup>
  );
}

// ---------------------------------------------------------------------------------------------------------------

/**
 * Storyboard 3.1 "More than one of you also likes": the pod interests (non-sensitive concepts that at least two
 * members hold, never attributed to anyone, §3.4) in the viewer's language.
 */
export function PodInterests({ interests }: { interests: readonly string[] }) {
  const { t } = useTranslation();
  if (interests.length === 0) return null;
  return (
    <Card padding={16} gap={10}>
      <AppText accessibilityRole="header" variant="bodySm" style={Fonts.bold}>
        {t('pod.alsoLikes')}
      </AppText>
      <ChipRow gap={6}>
        {interests.map((interest) => (
          <Pill key={interest} tone="mint" size="lg" weight="regular" label={interest} />
        ))}
      </ChipRow>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export interface ChatEntryProps {
  /** "Open until Sun 16 Nov, 14:00", "Opens …", "Closed". */
  readonly detail: string;
  readonly onPress: () => void;
}

/** Storyboard 3.4's Chat row: the meetup chat's state, opening the chat. */
export function ChatEntry({ detail, onPress }: ChatEntryProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const title = t('pod.sections.chat');
  return (
    <Card onPress={onPress} accessibilityRole="link" accessibilityLabel={`${title}, ${detail}`} radius="lg" padding={0} testID="pod-chat">
      <View style={styles.chatRow}>
        <Icon name="chat" size={22} color={p.primary} />
        <View style={styles.chatText}>
          <AppText variant="bodyMd" style={Fonts.bold}>
            {title}
          </AppText>
          <AppText variant="caption" tone="muted">
            {detail}
          </AppText>
        </View>
        <Icon name="chevronRight" size={20} color={p.muted} />
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------

/** Storyboard 3.1 "Meeting safely": the safety tips (§4.5), folded away until tapped. */
export function MeetingSafely() {
  const { t } = useTranslation();
  const p = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <Card padding={0} gap={0}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.disclosure, pressed && { backgroundColor: p.subtle }]}
        testID="meeting-safely"
      >
        <Icon name="shield" size={18} color={p.primary} />
        <AppText variant="bodySm" style={[Fonts.bold, styles.flex]}>
          {t('pod.meetingSafely')}
        </AppText>
        <Icon name="chevronDown" size={20} color={p.muted} style={open ? styles.flipped : null} />
      </Pressable>
      {open ? (
        <AppText variant="caption" tone="soft" style={styles.disclosureBody}>
          {SAFETY_TIPS.map((tip) => t(`info.safety.tips.${tip}`)).join(' ')}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  // Header (3.4)
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  back: { marginLeft: -10 },
  headerText: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Hero (3.1)
  heroTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLock: { marginTop: 2 },
  heroTheme: { ...Type.hero, fontSize: 34, lineHeight: 37, letterSpacing: -1 },
  heroMembers: { flexDirection: 'row', gap: 6 },
  heroMember: { flex: 1, alignItems: 'center', gap: 6, minWidth: 0 },
  // Chat entry (3.4)
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: Spacing.md, minHeight: 64 },
  chatText: { flex: 1, gap: 2 },
  // Meeting safely (3.1)
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: Spacing.md, borderRadius: Radius.xl },
  disclosureBody: { paddingHorizontal: Spacing.md, paddingBottom: 14 },
  flipped: { transform: [{ rotate: '180deg' }] },
});
