import { NOTICE_CODES, type NoticeDoc } from '@friendpod/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Note, Text, type IconName } from '@/components/ui';
import { DownloadExportButton } from '@/features/account/ExportStatus';
import { IconDot, type BulletTone } from '@/features/shell/parts';
import { currentLocale } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { SUPPORT_EMAIL } from '@/lib/support';

/** Codes this app version can render; anything newer gets a generic line instead of a raw code. */
const KNOWN_CODES = new Set<string>(Object.values(NOTICE_CODES));

type NoticeCode = keyof typeof NOTICE_CODES;

/**
 * The icon beside each notice, on a quiet Paper disc with Ink 2: no alarm colour (a pause is a calm fact about the
 * account, and nothing here is a deadline of the user's own), and no pod colour (a notice belongs to no pod). The hold
 * on private-interest pods gets the quiet private disc (white, Ink ring, lock).
 */
const LOOK: Record<NoticeCode, { readonly icon: IconName; readonly tone: BulletTone }> = {
  PAUSE_REPORTS: { icon: 'pause', tone: 'neutral' },
  PAUSE_SAFETY_REPORT: { icon: 'pause', tone: 'neutral' },
  PAUSE_UNDERAGE_REPORT: { icon: 'pause', tone: 'neutral' },
  PAUSE_NO_SHOW: { icon: 'pause', tone: 'neutral' },
  SUSPENSION_NO_SHOW: { icon: 'pause', tone: 'neutral' },
  SENSITIVE_HOLD_NOT_GENUINE: { icon: 'lock', tone: 'private' },
  SANCTION_ENDED: { icon: 'check', tone: 'neutral' },
  REPORT_RECEIVED: { icon: 'flag', tone: 'neutral' },
  POD_MEMBER_LEFT: { icon: 'people', tone: 'neutral' },
  EXPORT_READY: { icon: 'download', tone: 'neutral' },
  INACTIVITY_WARNING: { icon: 'clock', tone: 'neutral' },
};

const dateParam = (params: NoticeDoc['params'], key: string): string => {
  const v = params[key];
  return typeof v === 'number' ? formatDateTime(v, currentLocale()) : '';
};

/** The notice's short bold title ("Matching paused"); the details follow in the text. */
export function noticeTitle(t: TFunction, n: NoticeDoc): string {
  return KNOWN_CODES.has(n.code) ? t(`notices.titles.${n.code as NoticeCode}`) : t('notices.unknownTitle');
}

/** The notice's text from its code and non-textual params only (§8.1): the server never sends wording. */
export function noticeText(t: TFunction, n: NoticeDoc): string {
  if (!KNOWN_CODES.has(n.code)) return t('notices.unknown');
  return t(`notices.codes.${n.code as NoticeCode}`, {
    until: dateParam(n.params, 'until'),
    deleteAfter: dateParam(n.params, 'deleteAfter'),
  });
}

export interface NoticeCardProps {
  readonly uid: string;
  readonly notice: NoticeDoc;
  /** The matching export is ready and not yet expired, so the download can be offered. */
  readonly exportReady: boolean;
}

/**
 * One notice in a white card: the icon disc, the date (Muted), a short 15/700 title and the text in regular weight
 * (the storyboards bold only titles). A statement of reasons (DSA Art. 17) adds, in a Paper note inside the card, that
 * it was decided automatically with no human review and where to write; it is never a review channel. A safety
 * report's receipt adds after-report's safety alert "In danger right now? Call 112." (white, 1.5 px Danger border);
 * "your data is ready" offers the download while it exists, as priv-delete's white secondary "Download my data first".
 */
export function NoticeCard({ uid, notice, exportReady }: NoticeCardProps) {
  const { t } = useTranslation();
  const when = formatDateTime(notice.createdAt.toMillis(), currentLocale());
  const exportId = notice.code === NOTICE_CODES.EXPORT_READY ? notice.params.exportId : undefined;
  const look = KNOWN_CODES.has(notice.code) ? LOOK[notice.code as NoticeCode] : { icon: 'info' as const, tone: 'neutral' as const };
  const reasons = notice.type === 'statementOfReasons';
  const dangerLine = notice.code === NOTICE_CODES.REPORT_RECEIVED && notice.params.category === 'safety';
  return (
    <Card gap={12} testID={`notice-${notice.code}`}>
      <View style={styles.row}>
        <IconDot icon={look.icon} tone={look.tone} size={32} />
        <View style={styles.text}>
          <Text variant="caption" color="textMuted">
            {when}
          </Text>
          <Text variant="heading" accessibilityRole="header">
            {noticeTitle(t, notice)}
          </Text>
          <Text variant="small" color="text">
            {noticeText(t, notice)}
          </Text>
        </View>
      </View>
      {dangerLine ? <Note tone="safety" alert title={t('report.danger')} /> : null}
      {reasons ? (
        <Note tone="inset" icon="info">
          <Text variant="caption" color="textSecondary">
            {t('notices.automated')}
          </Text>
          <Text variant="caption" color="textSecondary">
            {t('notices.contact', { email: SUPPORT_EMAIL })}
          </Text>
        </Note>
      ) : null}
      {typeof exportId === 'string' ? (
        exportReady ? (
          <View style={styles.download}>
            <DownloadExportButton uid={uid} exportId={exportId} variant="secondary" size="sm" />
          </View>
        ) : (
          <Text variant="caption" color="textMuted">
            {t('notices.exportGone')}
          </Text>
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  text: { flex: 1, gap: 2 },
  download: { alignItems: 'flex-start', gap: 8, paddingLeft: 44 },
});
