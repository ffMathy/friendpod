/**
 * The reveal (pod-confirmed, blend spec §8 and §11): the third poster moment. A confirmed pod gets its full base
 * colour as a field: the back chevron and the pod menu, the white "Confirmed" pill, the pod name in Display XL and
 * the reveal mark (the viewer's figure solid: the seat is taken). Under it the white foot names the pod's members,
 * each one opening their sheet. A pod about a private interest never gets a field (decision 1): a white card with an
 * Ink border, the lock before the name and the private mark instead.
 */
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Icon, PodMark, PosterField, PosterFoot, Text, useFieldColors } from '@/components/ui';
import { BorderWidth, fitDisplay, Layout, Radius, usePalette } from '@/components/theme';
import type { PodColor } from '@/lib/podColor';
import { MemberAvatar } from './MemberAvatar';
import { PodTopBar } from './parts';
import type { Member } from './PodMembers';

export interface RevealProps {
  readonly podId: string;
  /** The theme in the viewer's own words. */
  readonly theme: string;
  /** The pod's colour; `null` for a pod about a private interest (no field). */
  readonly color: PodColor | null;
  /** "5 people near Aarhus C". */
  readonly subtitle: string;
  readonly members: readonly Member[];
  readonly viewer: string;
  /** Draws the pod menu ("⋯") at the right of the back chevron, in the given icon colour (the field's text colour). */
  readonly menu?: (color?: string) => ReactNode;
}

/** The pod-confirmed reveal: the pod's base field and the foot with every member (or the private card). */
export function Reveal(props: RevealProps) {
  return props.color ? <RevealField {...props} color={props.color} /> : <PrivateReveal {...props} />;
}

function RevealField({ podId, theme, color, subtitle, members, viewer, menu }: RevealProps & { color: PodColor }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const field = useFieldColors(color);
  return (
    <View testID="pod-confirmed">
      <PosterField color={color} gap={12} paddingBottom={52} style={{ paddingTop: insets.top + 32 }}>
        <View style={[styles.mark, { top: insets.top + 26 }]}>
          <PodMark variant="poster" color={color} ground="field" seat="taken" size={176} />
        </View>
        <PodTopBar menu={menu?.(field.text)} color={field.text} />
        <Badge tone="onField" icon="check" label={t('pod.confirmed')} />
        <Text accessibilityRole="header" variant={fitDisplay(theme, width - 2 * Layout.gutterCompact)} numberOfLines={2} style={[styles.name, { color: field.text }]}>
          {theme}
        </Text>
      </PosterField>
      <PosterFoot style={styles.foot}>
        <Text variant="smallStrong" color="textSecondary" style={styles.footLine}>
          {subtitle}
        </Text>
        <MemberGrid podId={podId} members={members} viewer={viewer} color={color} />
      </PosterFoot>
    </View>
  );
}

function PrivateReveal({ podId, theme, subtitle, members, viewer, menu }: RevealProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // The card's inner width, less the 24 px lock and its gap.
  const nameWidth = width - 2 * Layout.gutterCompact - 2 * Layout.heroPadding - 32;
  return (
    <View style={[styles.privateFrame, { paddingTop: insets.top + 28 }]}>
      <PodTopBar menu={menu?.()} />
      <View testID="pod-confirmed" style={[styles.privateCard, { backgroundColor: p.privateBg, borderColor: p.privateBorder }]}>
        <View style={styles.privateTop}>
          <Badge tone="status" icon="check" label={t('pod.confirmed')} />
          <PodMark variant="poster" color="private" seat="taken" size={96} />
        </View>
        <View style={styles.privateName}>
          <Icon name="lock" size={24} strokeWidth={2.2} color={p.text} accessibilityLabel={t('pods.privateInterest')} />
          <Text accessibilityRole="header" variant={fitDisplay(theme, nameWidth)} numberOfLines={2} style={styles.shrink}>
            {theme}
          </Text>
        </View>
        <View style={[styles.privateFoot, { borderTopColor: p.separator }]}>
          <Text variant="smallStrong" color="textSecondary">
            {subtitle}
          </Text>
          <MemberGrid podId={podId} members={members} viewer={viewer} color={null} />
        </View>
      </View>
    </View>
  );
}

/** Every member in one row (52 px avatars, 44 for six), names under them; each opens the member's sheet. */
function MemberGrid({ podId, members, viewer, color }: { podId: string; members: readonly Member[]; viewer: string; color: PodColor | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const size = members.length > 5 ? 44 : 52;
  return (
    <View style={styles.grid}>
      {members.map((m) => {
        const you = m.uid === viewer;
        const face = (
          <>
            <MemberAvatar uid={m.uid} name={m.firstName} size={size} photoV={m.photoV} you={you} color={color} />
            <Text variant="captionBold" numberOfLines={1} style={styles.memberName}>
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
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  // The reveal mark, 176 px, in the field's top-right corner (behind the back row, which sits at the left).
  mark: { position: 'absolute', right: 18 },
  name: { marginTop: 68 },
  foot: { paddingHorizontal: 12, gap: 12 },
  footLine: { marginHorizontal: 4 },
  grid: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6, minHeight: 44 },
  memberName: { maxWidth: '100%' },
  privateFrame: { paddingHorizontal: Layout.gutterCompact, gap: 6 },
  privateCard: { borderWidth: BorderWidth.control, borderRadius: Radius.hero, padding: Layout.heroPadding, gap: 12 },
  privateTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  privateName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  privateFoot: { borderTopWidth: BorderWidth.hairline, paddingTop: 14, gap: 12 },
});
