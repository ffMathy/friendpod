import type { PodReason } from '@grouper/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts, Radius, usePalette } from '@/components/theme';
import { AppText, Grabber, Icon, ScreenHeader, TextLink } from '@/components/ui';
import { usePodCard } from '@/data/docs';
import { Bold, boldList, fill, slot } from '@/features/drop/rich';
import { useUid } from '@/features/session/SessionProvider';

interface Item {
  readonly key: string;
  readonly priority: boolean;
  readonly text: ReactNode;
}

/**
 * Renders the server's reason codes (§6.7); THEME, ALSO_SHARE and SOFT_THEME carry only the viewer's own wording. Never
 * blocks, reliability or anyone else's interests. AREA joins NEAR_YOU in one line when both are present (storyboard 2.3).
 */
function reasonItems(t: TFunction, reasons: readonly PodReason[]): Item[] {
  const area = reasons.find((r) => r.code === 'AREA');
  const hasNear = reasons.some((r) => r.code === 'NEAR_YOU');
  const items: Item[] = [];
  reasons.forEach((r, i) => {
    const key = `${r.code}-${i}`;
    switch (r.code) {
      case 'THEME':
        items.push({ key, priority: false, text: fill(t('reasons.sheet.THEME', { wording: slot(0) }), [<Bold key="w">{r.yourWording}</Bold>]) });
        return;
      case 'ALSO_SHARE':
        items.push({ key, priority: false, text: fill(t('reasons.sheet.ALSO_SHARE', { list: slot(0) }), [boldList(r.yourWordings, t('pods.and'))]) });
        return;
      case 'AREA':
        if (!hasNear) items.push({ key, priority: false, text: t('reasons.sheet.AREA', { label: r.label }) });
        return;
      case 'NEAR_YOU':
        items.push({
          key,
          priority: false,
          text: area && area.code === 'AREA' ? t('reasons.sheet.NEAR_YOU_AREA', { km: r.km, label: area.label }) : t('reasons.sheet.NEAR_YOU', { km: r.km }),
        });
        return;
      case 'AGE_SPAN':
        items.push({ key, priority: false, text: t('reasons.sheet.AGE_SPAN', { min: r.min, max: r.max }) });
        return;
      case 'PRIORITY':
        items.push({ key, priority: true, text: t('reasons.sheet.PRIORITY', { count: r.weeks }) });
        return;
      case 'SOFT_THEME':
        items.push({
          key,
          priority: false,
          text: fill(t('reasons.sheet.SOFT_THEME', { yourTag: slot(0), podTheme: slot(1) }), [<Bold key="y">{r.yourTag}</Bold>, <Bold key="p">{r.podTheme}</Bold>]),
        });
        return;
      case 'OPEN_TO_ANYONE':
        items.push({ key, priority: false, text: t('reasons.sheet.OPEN_TO_ANYONE') });
        return;
    }
  });
  return items;
}

/**
 * "Why this pod" (storyboard 2.3): a bottom sheet over the proposal that fits its content, with 28-pt top corners, a
 * grabber and padding 10/24/32. It lays itself out at its content height (no flex), so a form sheet sized to its
 * contents can wrap it; under a full-height modal it sits at the top and scrolls if the text is very large.
 */
export default function WhyThisPod() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = usePalette();
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const card = usePodCard(useUid(), podId);
  const openHowMatching = () => {
    // Leave the sheet first so the page opens on the main stack, not under the modal.
    router.back();
    router.push('/info/how-matching-works');
  };

  return (
    <SafeAreaView edges={EDGES} style={[styles.sheet, { backgroundColor: p.surface }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false} alwaysBounceVertical={false}>
        <Grabber />
        <ScreenHeader title={t('pods.whyThisPod')} size="sm" closeLabel={t('common.close')} onClose={() => router.back()} />

        {card.data ? (
          <>
            <View style={styles.list}>
              {reasonItems(t, card.data.reasons).map((item) => (
                <View key={item.key} style={styles.item}>
                  <View
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.badge, { backgroundColor: item.priority ? p.amberBg : p.mint }]}
                  >
                    <Icon name={item.priority ? 'clock' : 'check'} size={16} strokeWidth={item.priority ? 2.2 : 2.4} color={item.priority ? p.amberText : p.mintText} />
                  </View>
                  <AppText variant="bodyMd" style={styles.itemText}>
                    {item.text}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={[styles.never, { backgroundColor: p.inset }]}>
              <AppText accessibilityRole="header" variant="bodySm" style={Fonts.bold}>
                {t('reasons.neverTitle')}
              </AppText>
              <AppText variant="caption" tone="soft">
                {t('reasons.neverBody')}
              </AppText>
            </View>

            <View style={styles.footer}>
              <AppText variant="caption" tone="muted">
                {t('reasons.automatic')}
              </AppText>
              <TextLink label={t('info.howMatchingWorks.title')} onPress={openHowMatching} />
            </View>
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator accessibilityLabel={t('common.loading')} color={p.primary} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The bottom inset is at least the sheet's 32-pt bottom padding (home indicator, gesture bar). */
const EDGES = { top: 'additive', bottom: 'maximum', left: 'additive', right: 'additive' } as const;

const styles = StyleSheet.create({
  // Content height, capped at the screen's: no flex, so a sheet that fits its contents can measure it.
  sheet: { maxHeight: '100%', borderTopLeftRadius: Radius.heroLg, borderTopRightRadius: Radius.heroLg, paddingBottom: 32, overflow: 'hidden' },
  scroll: { flexGrow: 0 },
  content: { paddingTop: 10, paddingHorizontal: 24, gap: 18 },
  list: { gap: 14 },
  item: { flexDirection: 'row', gap: 12 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, lineHeight: 22 },
  never: { borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 16, gap: 6 },
  footer: { gap: 2 },
  loading: { minHeight: 240, alignItems: 'center', justifyContent: 'center' },
});
