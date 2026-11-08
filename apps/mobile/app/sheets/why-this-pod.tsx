import type { PodCardDoc, PodReason } from '@grouper/core';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useLayoutEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CloseButton, Note, Strong, Text, TextLink, type IconName } from '@/components/ui';
import { usePalette } from '@/components/theme';
import { usePodCard } from '@/data/docs';
import { BottomSheet } from '@/features/after/parts';
import { useCardColor } from '@/features/drop/color';
import { PodDisc } from '@/features/drop/parts';
import { boldList, richText, slot } from '@/features/drop/richText';
import { useUid } from '@/features/session/SessionProvider';

/**
 * Drawn as a bottom sheet over a dimmed backdrop (drop-why), as tall as its content: the screen paints the backdrop
 * itself, so it is presented transparently over the screen it was opened from, without a header.
 */
const SHEET_OPTIONS = {
  headerShown: false,
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
} as const;

/**
 * The root stack presents the whole `sheets` group as a page-height modal (right for the full-screen report sheet).
 * This sheet asks for a transparent presentation of its own instance of the group instead, before the first frame
 * (a layout effect), so the screen behind shows through the backdrop. Other sheets keep the group's default.
 */
function useTransparentPresentation() {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.getParent()?.setOptions(SHEET_OPTIONS);
  }, [navigation]);
}

interface Line {
  readonly key: string;
  readonly text: ReactNode;
  /** `match` (a check) for why the pod fits, `priority` (a clock) for the viewer's waiting priority. */
  readonly kind: 'match' | 'priority';
}

/**
 * The server's reason codes (§6.7) as sentences. THEME, ALSO_SHARE and SOFT_THEME carry only the viewer's own
 * wording; AREA and NEAR_YOU read as one line. Nothing else is said: no blocks, reliability or anyone's private
 * interests.
 */
function reasonLines(t: TFunction, reasons: readonly PodReason[]): Line[] {
  const area = reasons.find((r) => r.code === 'AREA');
  const near = reasons.find((r) => r.code === 'NEAR_YOU');
  const lines: Line[] = [];
  for (const r of reasons) {
    switch (r.code) {
      case 'THEME':
        lines.push({ key: r.code, kind: 'match', text: richText(t('pods.why.THEME', { wording: slot(0) }), [<Strong key="w" color="text">{r.yourWording}</Strong>]) });
        break;
      case 'SOFT_THEME':
        lines.push({
          key: r.code,
          kind: 'match',
          text: richText(t('pods.why.SOFT_THEME', { yourTag: slot(0), podTheme: slot(1) }), [<Strong key="a" color="text">{r.yourTag}</Strong>, <Strong key="b" color="text">{r.podTheme}</Strong>]),
        });
        break;
      case 'ALSO_SHARE':
        lines.push({ key: r.code, kind: 'match', text: richText(t('pods.why.ALSO_SHARE', { list: slot(0) }), [boldList(t, r.yourWordings, 'text')]) });
        break;
      case 'NEAR_YOU':
        lines.push({
          key: r.code,
          kind: 'match',
          text: area?.code === 'AREA' ? t('pods.why.NEAR_AREA', { km: r.km, label: area.label }) : t('pods.why.NEAR_YOU', { km: r.km }),
        });
        break;
      case 'AREA':
        if (!near) lines.push({ key: r.code, kind: 'match', text: t('pods.why.AREA', { label: r.label }) });
        break;
      case 'AGE_SPAN':
        lines.push({ key: r.code, kind: 'match', text: t('pods.why.AGE_SPAN', { min: r.min, max: r.max }) });
        break;
      case 'OPEN_TO_ANYONE':
        lines.push({ key: r.code, kind: 'match', text: t('pods.why.OPEN_TO_ANYONE') });
        break;
      case 'PRIORITY':
        lines.push({ key: r.code, kind: 'priority', text: t('pods.why.PRIORITY', { count: r.weeks }) });
        break;
    }
  }
  // Priority is about the viewer, not the pod: it goes last.
  return [...lines.filter((l) => l.kind === 'match'), ...lines.filter((l) => l.kind === 'priority')];
}

const MARKS: Record<Line['kind'], IconName> = { match: 'check', priority: 'clock' };

/**
 * "Why this pod" (drop-why): a bottom sheet with the reasons, each led by a disc in the pod's tint with the icon in its
 * deep tone (white with an Ink ring for a private interest), what we never use as a quiet info note, and a link to how
 * matching works.
 */
export default function WhyThisPod() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const uid = useUid();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const card = usePodCard(uid, podId);
  useTransparentPresentation();
  const close = () => router.back();
  return (
    <>
      <Stack.Screen options={SHEET_OPTIONS} />
      <BottomSheet onClose={close} gap={16} gutter="compact" testID="why-this-pod">
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" variant="titleModal" style={styles.title}>
            {t('pods.whyThisPod')}
          </Text>
          <CloseButton onPress={close} accessibilityLabel={t('common.close')} />
        </View>
        {card.data ? <Reasons uid={uid} podId={podId} card={card.data} /> : <ActivityIndicator accessibilityLabel={t('common.loading')} color={p.primary} style={styles.loading} />}
      </BottomSheet>
    </>
  );
}

function Reasons({ uid, podId, card }: { uid: string; podId: string; card: PodCardDoc }) {
  const { t } = useTranslation();
  const router = useRouter();
  const color = useCardColor(uid, podId, card);
  return (
    <>
      <View style={styles.list}>
        {reasonLines(t, card.reasons).map((line) => (
          <View key={line.key} style={styles.line}>
            <PodDisc color={color} icon={MARKS[line.kind]} />
            <Text variant="bodySmall" color="textSecondary" style={styles.lineText}>
              {line.text}
            </Text>
          </View>
        ))}
      </View>
      <Note tone="info">
        {/* Title 14/20 and body 13/1.5, 2 px apart and 10 px from the icon, as drawn. */}
        <View style={styles.never}>
          <Text variant="smallBold" style={styles.neverTitle}>
            {t('pods.why.neverTitle')}
          </Text>
          <Text variant="caption" color="textSecondary" style={styles.neverBody}>
            {t('pods.why.neverBody')}
          </Text>
        </View>
      </Note>
      <TextLink label={t('home.howMatching')} onPress={() => router.push('/info/how-matching-works')} />
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1 },
  loading: { paddingVertical: 48 },
  list: { gap: 14 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // Centred on the 36 px disc's first line, as drawn.
  lineText: { flex: 1, paddingTop: 7 },
  never: { gap: 2, marginLeft: 2 },
  neverTitle: { lineHeight: 20 },
  neverBody: { lineHeight: 19.5 },
});
