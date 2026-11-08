import type { PodReason } from '@grouper/core';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useLayoutEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Card, CloseButton, Headline, Icon, Strong, Text, type IconName } from '@/components/ui';
import { usePalette, type PaletteKey } from '@/components/theme';
import { usePodCard } from '@/data/docs';
import { BottomSheet } from '@/features/after/parts';
import { CardLink } from '@/features/drop/parts';
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
  /** `match` (green tick) for why the pod fits, `priority` (amber clock) for the viewer's waiting priority. */
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
        lines.push({ key: r.code, kind: 'match', text: richText(t('pods.why.THEME', { wording: slot(0) }), [<Strong key="w">{r.yourWording}</Strong>]) });
        break;
      case 'SOFT_THEME':
        lines.push({
          key: r.code,
          kind: 'match',
          text: richText(t('pods.why.SOFT_THEME', { yourTag: slot(0), podTheme: slot(1) }), [<Strong key="a">{r.yourTag}</Strong>, <Strong key="b">{r.podTheme}</Strong>]),
        });
        break;
      case 'ALSO_SHARE':
        lines.push({ key: r.code, kind: 'match', text: richText(t('pods.why.ALSO_SHARE', { list: slot(0) }), [boldList(t, r.yourWordings)]) });
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

const MARKS: Record<Line['kind'], { icon: IconName; bg: PaletteKey; fg: PaletteKey; stroke: number }> = {
  match: { icon: 'check', bg: 'inset', fg: 'textSecondary', stroke: 2.4 },
  priority: { icon: 'clock', bg: 'inset', fg: 'textSecondary', stroke: 2.2 },
};

/** "Why this pod" (drop-why): the reasons, what we never use, and a link to how matching works. */
export default function WhyThisPod() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const card = usePodCard(useUid(), podId);
  useTransparentPresentation();
  const close = () => router.back();
  return (
    <>
      <Stack.Screen options={SHEET_OPTIONS} />
      <BottomSheet onClose={close} testID="why-this-pod">
        <View style={styles.titleRow}>
          <Headline style={styles.title}>{t('pods.whyThisPod')}</Headline>
          <CloseButton onPress={close} accessibilityLabel={t('common.close')} />
        </View>
        {card.data ? (
          <>
            <View style={styles.list}>
              {reasonLines(t, card.data.reasons).map((line) => {
                const mark = MARKS[line.kind];
                return (
                  <View key={line.key} style={styles.line}>
                    <View style={[styles.mark, { backgroundColor: p[mark.bg] }]}>
                      <Icon name={mark.icon} size={16} strokeWidth={mark.stroke} color={p[mark.fg]} />
                    </View>
                    <Text variant="body" style={styles.lineText}>
                      {line.text}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Card variant="inset" radius={16} gap={6} style={styles.never}>
              <Text accessibilityRole="header" variant="smallBold">
                {t('pods.why.neverTitle')}
              </Text>
              <Text variant="caption" color="textSecondary" style={styles.neverBody}>
                {t('pods.why.neverBody')}
              </Text>
            </Card>
            <CardLink align="start" label={t('home.howMatching')} onPress={() => router.push('/info/how-matching-works')} />
          </>
        ) : (
          <ActivityIndicator accessibilityLabel={t('common.loading')} color={p.primary} style={styles.loading} />
        )}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
  loading: { paddingVertical: 48 },
  list: { gap: 14 },
  line: { flexDirection: 'row', gap: 12 },
  mark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // The storyboard's 15 px at 1.45 and 13 px at 1.5, unrounded: over five two-line reasons rounding adds up.
  lineText: { flex: 1, lineHeight: 21.75 },
  // 14/16 as drawn (a `padding` prop would win over a horizontal override on web).
  never: { paddingVertical: 14, paddingHorizontal: 16 },
  neverBody: { lineHeight: 19.5 },
});
