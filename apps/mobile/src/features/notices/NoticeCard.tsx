import { NOTICE_CODES, type NoticeDoc } from '@grouper/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Body, Card, ErrorText } from '@/components/ui';
import { DownloadExportButton } from '@/features/account/ExportStatus';
import { currentLocale } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { SUPPORT_EMAIL } from '@/lib/support';

/** Codes this app version can render; anything newer gets a generic line instead of a raw code. */
const KNOWN_CODES = new Set<string>(Object.values(NOTICE_CODES));

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
  return (
    <Card>
      <Body muted>{when}</Body>
      <Body bold={notice.type === 'statementOfReasons'}>{noticeText(t, notice)}</Body>
      {notice.code === NOTICE_CODES.REPORT_RECEIVED && notice.params.category === 'safety' ? <ErrorText>{t('report.emergency')}</ErrorText> : null}
      {notice.type === 'statementOfReasons' ? (
        <>
          <Body muted>{t('notices.automated')}</Body>
          <Body muted>{t('notices.contact', { email: SUPPORT_EMAIL })}</Body>
        </>
      ) : null}
      {typeof exportId === 'string' ? (
        exportReady ? (
          <DownloadExportButton uid={uid} exportId={exportId} />
        ) : (
          <Body muted>{t('notices.exportGone')}</Body>
        )
      ) : null}
    </Card>
  );
}
