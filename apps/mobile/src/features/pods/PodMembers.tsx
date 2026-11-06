/**
 * Who is in the pod (§3.4): the green "Confirmed" card with every member's photo and first name (pod-confirmed), the
 * Members list with attendance (pod-scheduled), the "about me" sentences, and the pod interests.
 */
import type { AttendanceStatus, PodDoc } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Card, ChipRow, Icon, Tag, Text } from '@/components/ui';
import { BorderWidth, Radius, usePalette, type PaletteKey } from '@/components/theme';
import { MemberAvatar } from './MemberAvatar';

type Roster = PodDoc['roster'];

interface Member {
  readonly uid: string;
  readonly firstName: string;
  readonly photoV: number | null;
  readonly aboutMe?: string;
}

/** Current members in roster order, the viewer last (as on the storyboards). */
export function podMembers(memberUids: readonly string[], roster: Roster, viewer: string): Member[] {
  const all = memberUids.flatMap((uid) => {
    const entry = roster[uid];
    return entry ? [{ uid, firstName: entry.firstName, photoV: entry.photoV, ...(entry.aboutMe ? { aboutMe: entry.aboutMe } : {}) }] : [];
  });
  return [...all.filter((m) => m.uid !== viewer), ...all.filter((m) => m.uid === viewer)];
}

export interface ConfirmedHeroProps {
  readonly podId: string;
  readonly theme: string;
  readonly sensitive: boolean;
  /** "5 people near Aarhus C". */
  readonly subtitle: string;
  readonly members: readonly Member[];
  readonly viewer: string;
}

/** pod-confirmed: brand-green card, "Confirmed", the theme in 34/800 and a row of members; each opens their sheet. */
export function ConfirmedHero({ podId, theme, sensitive, subtitle, members, viewer }: ConfirmedHeroProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const size = members.length > 5 ? 44 : 52;
  return (
    <Card variant="brand" testID="pod-confirmed">
      <Badge tone="accent" label={t('pod.confirmed')} />
      <View style={styles.themeRow}>
        {sensitive ? <Icon name="lock" size={24} color={p.onBrand} accessibilityLabel={t('pods.privateInterest')} /> : null}
        <Text accessibilityRole="header" variant="themeCompact" color="onBrand" style={styles.flexShrink}>
          {theme}
        </Text>
      </View>
      <Text variant="small" color="onBrandMuted" style={styles.heroLine}>
        {subtitle}
      </Text>
      <View style={styles.grid}>
        {members.map((m) => {
          const you = m.uid === viewer;
          const face = (
            <>
              {you ? (
                // The viewer: near-black with a 2 px white ring and "You" in 15/800 (smaller faces: 13).
                <View
                  style={[styles.you, { width: size, height: size, borderRadius: size / 2, backgroundColor: p.ink, borderColor: p.onBrand }]}
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                >
                  <Text variant={size >= 52 ? 'heading' : 'captionBold'} weight="800" color="onInk" numberOfLines={1}>
                    {t('common.you')}
                  </Text>
                </View>
              ) : (
                <MemberAvatar uid={m.uid} name={m.firstName} size={size} photoV={m.photoV} />
              )}
              <Text variant="captionBold" color="onBrand" numberOfLines={1} style={styles.heroName}>
                {m.firstName}
              </Text>
            </>
          );
          return you ? (
            <View key={m.uid} style={styles.cell} accessible accessibilityLabel={t('pod.you', { name: m.firstName })}>
              {face}
            </View>
          ) : (
            <Pressable
              key={m.uid}
              accessibilityRole="link"
              accessibilityLabel={m.firstName}
              onPress={() => router.push({ pathname: '/pod/[podId]/member/[uid]', params: { podId, uid: m.uid } })}
              style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.75 : 1 }]}
            >
              {face}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/** Each member's own "about me" sentence (F19), shown to confirmed members only; nothing when nobody wrote one. */
export function AboutMembersCard({ members, viewer }: { members: readonly Member[]; viewer: string }) {
  const { t } = useTranslation();
  const withAbout = members.filter((m) => m.uid !== viewer && m.aboutMe);
  if (withAbout.length === 0) return null;
  return (
    <Card gap={12}>
      <Text accessibilityRole="header" variant="smallBold">
        {t('pod.inTheirWords')}
      </Text>
      {withAbout.map((m) => (
        <View key={m.uid} style={styles.aboutRow}>
          <MemberAvatar uid={m.uid} name={m.firstName} size={28} photoV={m.photoV} />
          <Text variant="small" color="textSecondary" style={styles.flex}>
            <Text variant="smallBold">{m.firstName}</Text>
            {`  ${m.aboutMe ?? ''}`}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/**
 * "More than one of you also likes": pod interests in the viewer's language, never attributed to anyone (§3.4). Its
 * own white card, under the reveal (pod-confirmed) and after the Members card once the plan has locked.
 */
export function PodInterestsCard({ interests }: { interests: readonly string[] }) {
  const { t } = useTranslation();
  const p = usePalette();
  if (interests.length === 0) return null;
  // A white card with the storyboard's 14/16 padding (Card takes one padding for all sides).
  return (
    <View testID="pod-interests" style={[styles.compactCard, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text accessibilityRole="header" variant="smallBold" style={styles.interestsTitle}>
        {t('pod.alsoLikes')}
      </Text>
      <ChipRow tight>
        {interests.map((i) => (
          <Tag key={i} label={i} />
        ))}
      </ChipRow>
    </View>
  );
}

const STATUS_COLOR: Readonly<Record<'coming' | 'notComing' | 'unconfirmed', PaletteKey>> = {
  coming: 'primary',
  notComing: 'textMuted',
  unconfirmed: 'warningText',
};

export interface MembersCardProps {
  readonly podId: string;
  readonly members: readonly Member[];
  readonly viewer: string;
  readonly attendance: Readonly<Record<string, AttendanceStatus>> | null;
}

/**
 * pod-scheduled "MEMBERS": the other members with photo, first name, their "about me" and, while the meetup is
 * scheduled, whether they're coming ("Hasn't confirmed" once unconfirmed). Each row opens the member's sheet, where
 * block and report live. The card ends with the last member, as on the storyboard; the pod interests follow in
 * their own card.
 */
export function MembersCard({ podId, members, viewer, attendance }: MembersCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const others = members.filter((m) => m.uid !== viewer);
  return (
    <View testID="pod-members" style={[styles.members, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text accessibilityRole="header" variant="overline" color="textMuted" style={styles.membersTitle}>
        {t('pod.sections.members')}
      </Text>
      {others.map((m, i) => {
        const status = attendance?.[m.uid];
        const shown = status === 'coming' || status === 'notComing' || status === 'unconfirmed' ? status : null;
        const value = shown === null ? null : shown === 'unconfirmed' ? t('attendance.hasntConfirmedShort') : t(`attendance.other.${shown}`);
        const spoken = [shown === 'unconfirmed' ? t('attendance.hasntConfirmed', { name: m.firstName }) : m.firstName, shown && shown !== 'unconfirmed' ? value : null, m.aboutMe]
          .filter(Boolean)
          .join(', ');
        return (
          <Pressable
            key={m.uid}
            accessibilityRole="link"
            accessibilityLabel={spoken}
            onPress={() => router.push({ pathname: '/pod/[podId]/member/[uid]', params: { podId, uid: m.uid } })}
            style={({ pressed }) => [
              styles.memberRow,
              // The separator adds to the 48 px row (the storyboard's min-height 48 plus a 1 px border), none after the last.
              i < others.length - 1 ? { minHeight: 49, borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator } : null,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <MemberAvatar uid={m.uid} name={m.firstName} size={32} photoV={m.photoV} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{m.firstName}</Text>
              {m.aboutMe ? (
                <Text variant="caption" color="textMuted">
                  {m.aboutMe}
                </Text>
              ) : null}
            </View>
            {value && shown ? (
              <Text variant="captionBold" color={STATUS_COLOR[shown]}>
                {value}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grid: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, alignItems: 'center', gap: 6, minHeight: 44 },
  you: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  // 14 px and 13/700 at their natural line height, as on the storyboard.
  heroLine: { lineHeight: 18 },
  heroName: { lineHeight: 16 },
  compactCard: { borderWidth: BorderWidth.hairline, borderRadius: Radius.card, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  interestsTitle: { lineHeight: 18 },
  aboutRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  members: { borderWidth: BorderWidth.hairline, borderRadius: Radius.cardLg, paddingVertical: 6, paddingHorizontal: 16 },
  // 13/700 caps at its natural line height (16 px), as the storyboard's h2.
  membersTitle: { marginTop: 10, marginBottom: 2, lineHeight: 16 },
  memberRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
});
