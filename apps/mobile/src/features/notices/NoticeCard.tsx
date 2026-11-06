import { NOTICE_CODES, type NoticeDoc } from '@grouper/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Fonts } from '@/components/theme';
import { AppText, Banner, Card, type IconName } from '@/components/ui';
import { DownloadExportButton } from '@/features/account/ExportStatus';
import { IconBadge, InsetNote, type BadgeTone } from '@/features/settings/parts';
import { currentLocale } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { SUPPORT_EMAIL } from '@/lib/support';

/** Codes this app version can render; anything newer gets a generic line instead of a raw code. */
const KNOWN_CODES = new Set<string>(Object.values(NOTICE_CODES));

/** A decorative icon per code: pauses and holds in amber, everything else in mint. */
const CODE_ICON: Record<keyof typeof NOTICE_CODES, readonly [IconName, BadgeTone]> = {
  PAUSE_REPORTS: ['pause', 'amber'],
  PAUSE_SAFETY_REPORT: ['pause', 'amber'],
  PAUSE_UNDERAGE_REPORT: ['pause', 'amber'],
  PAUSE_NO_SHOW: ['pause', 'amber'],
  SUSPENSION_NO_SHOW: ['pause', 'amber'],
  SENSITIVE_HOLD_NOT_GENUINE: ['lock', 'amber'],
  SANCTION_ENDED: ['check', 'mint'],
  REPORT_RECEIVED: ['flag', 'mint'],
  POD_MEMBER_LEFT: ['people', 'mint'],
  EXPORT_READY: ['download', 'mint'],
  INACTIVITY_WARNING: ['clock', 'amber'],
};

const dateParam = (params: NoticeDoc['params'], key: string): string => {
  const v = params[key];
  return typeof v === 'number' ? formatDateTime(v, currentLocale()) : '';
};

/** The notice's text from its code and non-textual params only (§8.1): the server never sends wording. */
export function noticeText(t: TFunction, n: NoticeDoc): string {
  if (!KNOWN_CODES.has(n.code)) return t('notices.unknown');
  return t(`notices.codes.${n.code as keyof typeof NOTICE_CODES}`, {
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
 * One notice. A statement of reasons (DSA Art. 17) says what was decided and until when, that it was automated with
 * no human review, and where to write; it is never a review channel.
 */
export function NoticeCard({ uid, notice, exportReady }: NoticeCardProps) {
  const { t } = useTranslation();
  const when = formatDateTime(notice.createdAt.toMillis(), currentLocale());
  const exportId = notice.code === NOTICE_CODES.EXPORT_READY ? notice.params.exportId : undefined;
  const reasons = notice.type === 'statementOfReasons';
  const [icon, tone] = KNOWN_CODES.has(notice.code) ? CODE_ICON[notice.code as keyof typeof NOTICE_CODES] : (['info', 'neutral'] as const);
  return (
    <Card gap={10}>
      <View style={styles.head}>
        <IconBadge icon={icon} tone={tone} size={32} />
        <AppText variant="caption" tone="muted" style={[Fonts.semibold, styles.flex]}>
          {when}
        </AppText>
      </View>
      <AppText variant="bodyMd" style={reasons ? Fonts.bold : null}>
        {noticeText(t, notice)}
      </AppText>
      {notice.code === NOTICE_CODES.REPORT_RECEIVED && notice.params.category === 'safety' ? (
        <Banner tone="coral" icon="shield">
          {t('report.emergency')}
        </Banner>
      ) : null}
      {reasons ? (
        <InsetNote>
          <AppText variant="caption" tone="muted">
            {t('notices.automated')}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t('notices.contact', { email: SUPPORT_EMAIL })}
          </AppText>
        </InsetNote>
      ) : null}
      {typeof exportId === 'string' ? (
        exportReady ? (
          <DownloadExportButton uid={uid} exportId={exportId} />
        ) : (
          <AppText variant="caption" tone="muted">
            {t('notices.exportGone')}
          </AppText>
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});
