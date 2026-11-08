/**
 * Page layout: the page colour, the 24 px gutter (20 on tab and pod screens), safe areas, optional scrolling,
 * and a bottom-pinned action area (the storyboards' bottom CTA). Plus the onboarding step header, the page
 * header used on tab screens, and the bottom-sheet layout used by app/sheets.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, CloseButton } from './Button';
import { ProgressSegments } from './Progress';
import { Text } from './Text';
import { Layout, Radius, Size, usePalette } from './theme';

export interface ScreenProps {
  readonly children?: ReactNode;
  /** Scroll the content (default true). */
  readonly scroll?: boolean;
  /** Fixed above the content (does not scroll): a `StepHeader` or `PageHeader`. */
  readonly header?: ReactNode;
  /** Pinned to the bottom, above the safe area: the screen's main action(s). */
  readonly footer?: ReactNode;
  /** `default` 24 px, `compact` 20 px (tab and pod screens), `none`. */
  readonly gutter?: 'default' | 'compact' | 'none';
  /** Gap between the content's children (default 16). */
  readonly gap?: number;
  /** Add the top safe-area inset (screens without a navigation header). Default false. */
  readonly safeTop?: boolean;
  /** `page` (default) or `surface` (white, for sheets). */
  readonly background?: 'page' | 'surface';
  readonly refreshControl?: React.ReactElement<RefreshControlProps>;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export function Screen({
  children,
  scroll = true,
  header,
  footer,
  gutter = 'default',
  gap = Layout.gap,
  safeTop = false,
  background = 'page',
  refreshControl,
  contentStyle,
  testID,
}: ScreenProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const side = gutter === 'none' ? 0 : gutter === 'compact' ? Layout.gutterCompact : Layout.gutter;
  const bottomInset = Math.max(insets.bottom, Layout.bottom);
  const content: ViewStyle = {
    paddingHorizontal: side,
    paddingTop: header ? gap : 16,
    paddingBottom: footer ? 16 : bottomInset,
    gap,
  };
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[content, styles.grow, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, content, contentStyle]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: background === 'surface' ? p.surface : p.page, paddingTop: safeTop ? insets.top : 0 }]}
    >
      {header ? <View style={{ paddingHorizontal: side, paddingTop: 8 }}>{header}</View> : null}
      {body}
      {footer ? <View style={[styles.footer, { paddingHorizontal: side, paddingBottom: bottomInset }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

/** Onboarding step header (spec §6.12 B): 44 px back chevron, "Step n of N" 13/600 Muted, then N segments (done Skov). */
export function StepHeader({ step, total, onBack }: { step: number; total: number; onBack?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepRow}>
        {onBack ? <BackButton onPress={onBack} accessibilityLabel={t('common.back')} /> : <View style={styles.backSpacer} />}
        <Text variant="captionStrong" color="textMuted">
          {t('common.stepOf', { step, total })}
        </Text>
      </View>
      <ProgressSegments total={total} filled={step} />
    </View>
  );
}

export interface PageHeaderProps {
  readonly title: string;
  /** Small muted line above the title ("Me", "You're on the list"). */
  readonly eyebrow?: string;
  /** Muted text at the right of the title ("Week 46", "5 of 20"). */
  readonly meta?: string;
  /** Muted line under the title ("Voting closes Tuesday 18:00"). */
  readonly subtitle?: string;
  /** Shows the back chevron above the title. */
  readonly onBack?: () => void;
  readonly backLabel?: string;
}

/**
 * The in-page header of tab screens and plain pushed screens (spec §6.12 A and D): Title (Bricolage 30/32) in Ink at the
 * left, meta ("Week 46", "5 of 20") 14/600 Muted at the right on the baseline; optional eyebrow above ("Me") and a
 * line under it. With `onBack` the 44 px back chevron sits above the title.
 */
export function PageHeader({ title, eyebrow, meta, subtitle, onBack, backLabel }: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.pageHeader}>
      {onBack ? <BackButton onPress={onBack} accessibilityLabel={backLabel ?? t('common.back')} /> : null}
      {eyebrow ? (
        <Text variant="eyebrow" color="textMuted">
          {eyebrow}
        </Text>
      ) : null}
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" variant="title" style={styles.flexShrink}>
          {title}
        </Text>
        {meta ? (
          <Text variant="smallStrong" color="textMuted">
            {meta}
          </Text>
        ) : null}
      </View>
      {subtitle ? (
        <Text variant="small" color="textMuted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export interface SheetProps {
  readonly title: string;
  readonly onClose?: () => void;
  readonly closeLabel?: string;
  /** A leading element in the title row (the member's avatar). */
  readonly leading?: ReactNode;
  /** Small muted line under the title ("In your brætspil pod"). */
  readonly subtitle?: string;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly scroll?: boolean;
}

/**
 * Bottom-sheet layout for app/sheets (drop-why, after-member; spec §6.14): white, top radius 28, a 36 × 5 Outline handle,
 * the title in Headline (Bricolage 22/26), the close cross. A destructive confirm ends with the Danger outline button and
 * a secondary Cancel; never two filled buttons in one sheet.
 */
export function Sheet({ title, onClose, closeLabel, leading, subtitle, children, footer, scroll = true }: SheetProps) {
  const p = usePalette();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const inner = (
    <View style={styles.sheetBody}>
      <View style={styles.sheetTitleRow}>
        {leading}
        <View style={styles.flex}>
          <Text accessibilityRole="header" variant="headline">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="small" color="textMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onClose ? <CloseButton onPress={onClose} accessibilityLabel={closeLabel ?? t('common.close')} /> : null}
      </View>
      {children}
    </View>
  );
  return (
    <View style={[styles.flex, styles.sheet, { backgroundColor: p.surface }]}>
      <View style={[styles.handle, { backgroundColor: p.borderStrong }]} accessible={false} />
      {scroll ? (
        <ScrollView style={styles.flex} contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.sheetScroll]}>{inner}</View>
      )}
      {footer ? <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, Layout.bottom) }]}>{footer}</View> : null}
    </View>
  );
}

/** A centred spinner on the page colour; `label` is read by screen readers. */
export function Loading({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View style={[styles.center, { backgroundColor: p.page }]}>
      <ActivityIndicator accessibilityLabel={label} color={p.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  grow: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Layout.gutter },
  footer: { paddingTop: 12, gap: 12 },
  stepHeader: { gap: 12, paddingTop: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backSpacer: { height: Size.hitTarget },
  pageHeader: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  sheet: { borderTopLeftRadius: Radius.panel, borderTopRightRadius: Radius.panel },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12 },
  sheetScroll: { paddingHorizontal: Layout.gutterCompact, paddingTop: 18, paddingBottom: Layout.bottom },
  sheetBody: { gap: 18 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheetFooter: { paddingHorizontal: Layout.gutterCompact, paddingTop: 12, gap: 12 },
});
