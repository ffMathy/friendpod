import { Stack, useRouter } from 'expo-router';
import { Trans, useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderWidth, usePalette } from '@/components/theme';
import { Button, ErrorText, Eyebrow, Icon, InlineLink, ListSection, Loading, Overline, Screen, Text, Title, type IconName } from '@/components/ui';
import { useBlocks, useSensitiveInterests, useUserDoc } from '@/data/docs';
import { useCallable } from '@/data/useCallable';
import { ExportRequestStatus, ExportStatus, useLatestExport, useRequestExport, type ExportRequestState } from '@/features/account/ExportStatus';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/**
 * Me → Privacy (priv-settings; §11, PRIVACY.md §6). "What you've agreed to": private interests (the blanket Art. 9
 * consent, given or withdrawn on its own screen; the row carries the quiet Ink lock), same-gender pods (with the way to
 * turn it off and delete the gender while it is on) and the photo (changed or deleted under Me). "Your data and
 * matching": pause, the export with its authenticated download, blocked people and how matching works, with neutral
 * Ink 2 icons. Then "Delete account" as the full-width danger outline (never a red fill) and the right to complain.
 */
export default function Privacy() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = useUid();
  const user = useUserDoc(uid);
  const sensitive = useSensitiveInterests(uid).data ?? [];
  const blocks = useBlocks(uid).data ?? [];
  const updateProfile = useCallable('updateProfile');
  const participation = useCallable('setParticipation');
  const exportRequest = useRequestExport();
  const p = usePalette();

  const hideHeader = <Stack.Screen options={{ headerShown: false }} />;
  if (user.isLoading) {
    return (
      <>
        {hideHeader}
        <Loading label={t('common.loading')} />
      </>
    );
  }
  const u = user.data;
  const hasArt9Consent = u?.legal.art9 !== undefined;
  const sameGender = u?.prefs.sameGenderOnly === true;
  const hasPhoto = u?.photo !== null && u?.photo !== undefined;
  const pausedUntil = u?.participation.pausedUntil?.toMillis();
  const paused = pausedUntil !== undefined || u?.status === 'paused';
  const firstError = updateProfile.error ?? participation.error;
  const back = router.canGoBack() ? () => router.back() : undefined;

  const pauseDetail = participation.data
    ? t('me.effectiveFrom', { week: participation.data.effectiveWeekId })
    : pausedUntil !== undefined
      ? t('privacy.pausedUntil', { when: formatDateTime(pausedUntil, currentLocale()) })
      : paused
        ? t('privacy.paused')
        : t('privacy.pauseDetail');

  return (
    <Screen safeTop gutter="compact" contentStyle={{ paddingTop: Math.max(8, 40 - insets.top) }}>
      {hideHeader}
      <View style={styles.header}>
        <ParentLink label={t('tabs.me')} backLabel={t('common.back')} onBack={back} />
        <Title>{t('privacy.title')}</Title>
      </View>

      {user.error ? <ErrorText>{t('common.loadFailed')}</ErrorText> : null}
      <ListSection>
        <CardTitle>{t('privacy.agreedTo')}</CardTitle>
        <Row
          testID="privacy-sensitive"
          labelIcon="lock"
          label={t('privacy.privateInterests')}
          detail={hasArt9Consent ? t('privacy.privateOn', { count: sensitive.length }) : t('privacy.privateOff')}
          chevron
          separator
          minHeight={LINK_ROW}
          onPress={() => router.push('/settings/sensitive-consent')}
        />
        <Row
          testID="privacy-same-gender"
          label={t('privacy.sameGender')}
          detail={sameGender ? t('privacy.sameGenderOn') : t('privacy.sameGenderOff')}
          chevron
          separator={!sameGender}
          minHeight={sameGender ? undefined : LINK_ROW}
          onPress={() => router.push('/settings/preferences')}
        />
        {sameGender ? (
          <View style={[styles.inlineAction, { borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator }]}>
            <Button
              variant="danger"
              size="sm"
              label={t('privacy.sameGenderWithdraw')}
              busy={updateProfile.isPending}
              onPress={() => updateProfile.mutate({ prefs: { sameGenderOnly: false } })}
            />
          </View>
        ) : null}
        <Row
          testID="privacy-photo"
          label={t('privacy.photo')}
          detail={hasPhoto ? t('privacy.photoOn') : t('privacy.photoOff')}
          chevron
          onPress={() => router.push('/me')}
        />
      </ListSection>

      <ListSection>
        <CardTitle>{t('privacy.yourData')}</CardTitle>
        <Row
          testID="pause"
          icon="pause"
          label={t('privacy.pause')}
          detail={pauseDetail}
          role="button"
          separator
          onPress={() => (participation.isPending ? undefined : participation.mutate({ mode: 'pause' }))}
        />
        <ExportBlock uid={uid} state={exportRequest.state} onRequest={() => void exportRequest.request()} />
        <Row
          icon="block"
          label={t('privacy.blocked')}
          detail={blocks.length === 0 ? t('privacy.blockedNone') : t('privacy.blockedCount', { count: blocks.length })}
          separator
          onPress={() => router.push('/settings/blocked')}
        />
        <Row icon="info" label={t('info.howMatchingWorks.title')} onPress={() => router.push('/info/how-matching-works')} />
      </ListSection>

      {firstError ? <ErrorText>{t(errorMessageKey(firstError))}</ErrorText> : null}

      <Button
        testID="privacy-delete"
        variant="danger"
        size="md"
        fullWidth
        label={t('privacy.deleteAccount')}
        onPress={() => router.push('/settings/delete-account')}
      />
      {/* PRIVACY.md §6 requires the complaint path (priv-settings draws it under "Delete account"): a link to datatilsynet.dk. */}
      <Text variant="caption" color="textMuted" align="center">
        <Trans
          i18nKey="privacy.complaint"
          components={{ a: <InlineLink onPress={() => void Linking.openURL(DATATILSYNET_URL).catch(() => undefined)}>datatilsynet.dk</InlineLink> }}
        />
      </Text>
    </Screen>
  );
}

const DATATILSYNET_URL = 'https://www.datatilsynet.dk';
/** priv-settings' link rows: min-height 56 plus the 1 px separator under it. */
const LINK_ROW = 56 + BorderWidth.hairline;

/**
 * The "ME" eyebrow above the title (priv-settings). The storyboard has no separate back chevron: the parent's name is
 * the way back, so with history it becomes "‹ ME" with a 44 px touch target from hitSlop, keeping the layout.
 */
function ParentLink({ label, backLabel, onBack }: { label: string; backLabel: string; onBack?: () => void }) {
  const p = usePalette();
  const text = <Eyebrow>{label}</Eyebrow>;
  if (!onBack) return text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${backLabel}: ${label}`}
      onPress={onBack}
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 24 }}
      style={({ pressed }) => [styles.parent, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="back" size={14} color={p.textMuted} strokeWidth={2.6} />
      {text}
    </Pressable>
  );
}

interface RowProps {
  readonly label: string;
  readonly detail?: string;
  readonly icon?: IconName;
  /** A 16 px Ink icon inline before the label (the lock of "Private interests"). */
  readonly labelIcon?: IconName;
  readonly trailing?: ReactNode;
  readonly chevron?: boolean;
  /** A 1 px separator at the bottom, inside `minHeight`. */
  readonly separator?: boolean;
  /** Default 56. The storyboard's link rows are 56 plus their separator (57); its button rows 56 with it. */
  readonly minHeight?: number;
  /** `link` (default): opens another screen; `button`: acts here (pause, download). */
  readonly role?: 'link' | 'button';
  readonly onPress?: () => void;
  readonly testID?: string;
}

/**
 * A row of the priv-settings cards, on the storyboard's metrics: 56 px (57 for the link rows with a separator), the
 * 16/600 title on a 22 px line and the 13 px Muted detail on an 18 px line, 2 px under it (ListRow's 24/20 lines are
 * taller), a 20 px neutral Ink 2 icon (Skov is only for what you tap) or a 20 px Muted chevron.
 */
function Row({ label, detail, icon, labelIcon, trailing, chevron = false, separator = false, minHeight = 56, role = 'link', onPress, testID }: RowProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { minHeight },
        separator ? { borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator } : null,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={p.textSecondary} /> : null}
      <View style={styles.rowText}>
        <View style={styles.rowLabel}>
          {labelIcon ? <Icon name={labelIcon} size={16} strokeWidth={2.2} color={p.privateText} /> : null}
          <Text variant="rowTitle" style={styles.rowTitle}>
            {label}
          </Text>
        </View>
        {detail ? (
          <Text variant="caption" color="textMuted" style={styles.rowDetail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevronRight" size={20} color={p.textMuted} /> : null}
    </Pressable>
  );
}

/** "WHAT YOU'VE AGREED TO": ListSection's title, at the storyboard h2's normal line height (16 px, not 17). */
function CardTitle({ children }: { children: string }) {
  return <Overline style={styles.cardTitle}>{children}</Overline>;
}

/** "Download my data" as a row of the data card, with the request's outcome and the latest export's state under it. */
function ExportBlock({ uid, state, onRequest }: { uid: string; state: ExportRequestState; onRequest: () => void }) {
  const p = usePalette();
  const { t } = useTranslation();
  const latest = useLatestExport(uid);
  const working = state === 'working';
  const showStatus = latest !== null || (state !== 'idle' && !working);
  return (
    <View style={{ borderBottomWidth: BorderWidth.hairline, borderBottomColor: p.separator }}>
      <Row
        testID="export-request"
        minHeight={56 - BorderWidth.hairline}
        icon="download"
        label={t('privacy.export')}
        detail={t('privacy.exportDetail')}
        role="button"
        trailing={working ? <ActivityIndicator color={p.primary} accessibilityLabel={t('common.loading')} /> : undefined}
        onPress={working ? undefined : onRequest}
      />
      {showStatus ? (
        <View style={styles.exportStatus}>
          <ExportRequestStatus state={state} />
          <ExportStatus uid={uid} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  parent: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginLeft: -3 },
  cardTitle: { marginTop: 10, marginBottom: 2, lineHeight: 16 },
  /** The padding only shows when a long (Danish) detail wraps to a third line. */
  row: { paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { lineHeight: 22, flexShrink: 1 },
  rowDetail: { lineHeight: 18 },
  inlineAction: { paddingBottom: 12, paddingLeft: 0 },
  /** Under "Download my data": in line with its text (the 20 px icon and the 12 px gap). */
  exportStatus: { paddingLeft: 32, gap: 8, paddingBottom: 14 },
});
