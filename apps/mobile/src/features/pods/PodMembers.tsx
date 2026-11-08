/**
 * Who is in the pod (§3.4): the Members list with attendance (pod-scheduled), the "about me" sentences and the pod
 * interests. The reveal's member row (pod-confirmed) is in Reveal.tsx.
 */
import type { AttendanceStatus, PodDoc } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChipRow, Overline, StatusText, Text, type IconName } from '@/components/ui';
import { BorderWidth, Radius, Size, usePalette } from '@/components/theme';
import type { PodColor } from '@/lib/podColor';
import { MemberAvatar } from './MemberAvatar';
import { PodCard } from './parts';

type Roster = PodDoc['roster'];

export interface Member {
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

/** Each member's own "about me" sentence (F19), shown to confirmed members only; nothing when nobody wrote one. */
export function AboutMembersCard({ members, viewer, color }: { members: readonly Member[]; viewer: string; color: PodColor | null }) {
  const { t } = useTranslation();
  const withAbout = members.filter((m) => m.uid !== viewer && m.aboutMe);
  if (withAbout.length === 0) return null;
  return (
    <PodCard gap={12}>
      <Text accessibilityRole="header" variant="heading">
        {t('pod.inTheirWords')}
      </Text>
      {withAbout.map((m) => (
        <View key={m.uid} style={styles.aboutRow}>
          <MemberAvatar uid={m.uid} name={m.firstName} size={32} photoV={m.photoV} color={color} />
          <Text variant="small" color="textSecondary" style={styles.flex}>
            <Text variant="small" weight="700">
              {m.firstName}
            </Text>
            {`  ${m.aboutMe ?? ''}`}
          </Text>
        </View>
      ))}
    </PodCard>
  );
}

/**
 * "More than one of you also likes" (pod-confirmed): pod interests in the viewer's language, never attributed to
 * anyone (§3.4). The pod document carries them as words only, without concept ids, and a colour may only come from a
 * concept id (decision 9), so they are neutral chips here: Paper on the white card, a 1 px Line border, no dot. Not the
 * plain-clash chip (white, Outline border, hollow ring), which means "the same colour as this pod".
 * DESIGN-DEVIATION: the storyboard colours them (sourdough Solsikke, coffee Bær, hiking Blomme); that needs the pod
 * document to carry each interest's concept id (`{ conceptId, da, en }`), a founder decision on the core schema.
 */
export function PodInterestsCard({ interests }: { interests: readonly string[] }) {
  const { t } = useTranslation();
  if (interests.length === 0) return null;
  return (
    <PodCard testID="pod-interests" style={styles.interests}>
      <Text accessibilityRole="header" variant="heading">
        {t('pod.alsoLikes')}
      </Text>
      <ChipRow>
        {interests.map((i) => (
          <PlainChip key={i} label={i} />
        ))}
      </ChipRow>
    </PodCard>
  );
}

/** A neutral 32 px interest chip with no colour and no dot (an interest whose concept id the app does not have). */
function PlainChip({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View testID="pod-interest-chip" style={[styles.plainChip, { backgroundColor: p.inset, borderColor: p.border }]}>
      <Text variant="chip">{label}</Text>
    </View>
  );
}

const STATUS_ICON: Readonly<Record<'coming' | 'notComing' | 'unconfirmed', IconName>> = {
  coming: 'check',
  notComing: 'close',
  unconfirmed: 'clock',
};

export interface MembersCardProps {
  readonly podId: string;
  readonly members: readonly Member[];
  readonly viewer: string;
  readonly attendance: Readonly<Record<string, AttendanceStatus>> | null;
  /** The pod's colour (avatars in its deep tone); `null` for a private pod. */
  readonly color: PodColor | null;
}

/**
 * pod-scheduled "MEMBERS": the other members with their initial (or photo), first name, their "about me" and, while
 * the meetup is scheduled, whether they're coming. Someone who hasn't confirmed is shown quietly (decision 3): a dashed
 * avatar, a clock and the words in Ink 2, never a coloured flag. Each row opens the member's sheet, where block and
 * report live. The locked plan page ("Your meetup") shows the same card under the plan.
 */
export function MembersCard({ podId, members, viewer, attendance, color }: MembersCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const others = members.filter((m) => m.uid !== viewer);
  return (
    <View testID="pod-members" style={[styles.members, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Overline style={styles.membersTitle}>{t('pod.sections.members')}</Overline>
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
              i < others.length - 1 ? { borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator } : null,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <MemberAvatar uid={m.uid} name={m.firstName} size={32} photoV={m.photoV} color={color} pending={shown === 'unconfirmed'} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" style={styles.name}>
                {m.firstName}
              </Text>
              {m.aboutMe ? (
                <Text variant="captionStrong" color="textMuted" weight="400">
                  {m.aboutMe}
                </Text>
              ) : null}
            </View>
            {value && shown ? <StatusText icon={STATUS_ICON[shown]} label={value} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  aboutRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  interests: { paddingBottom: 16 },
  plainChip: { height: Size.tag, borderRadius: Size.tag / 2, borderWidth: BorderWidth.hairline, paddingHorizontal: 12, justifyContent: 'center', alignSelf: 'flex-start' },
  members: { borderWidth: BorderWidth.hairline, borderRadius: Radius.card, paddingHorizontal: 16 },
  membersTitle: { marginTop: 12 },
  // The storyboard's rows: min-height 46 with the 1 px divider counted in.
  memberRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  // 15/600 at the storyboard's 20 px line.
  name: { lineHeight: 20 },
});
