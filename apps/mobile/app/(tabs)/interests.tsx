import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Button, Card, ErrorText, Screen } from '@/components/ui';
import { useNotices } from '@/data/docs';
import { InterestManager } from '@/features/interests/InterestManager';
import { REVIEWED_NOT_SENSITIVE_NOTICE, treatAsOrdinary } from '@/features/interests/treatAsOrdinary';
import { useUid } from '@/features/session/SessionProvider';
import { currentLocale } from '@/i18n';

/** Interests tab (§11): holdings, the sensitive section, and notices for reviewed tags. */
export default function Interests() {
  const { t } = useTranslation();
  const uid = useUid();
  const [failed, setFailed] = useState(false);
  const reviewed = (useNotices(uid).data ?? []).filter(
    (n) => n.data.code === REVIEWED_NOT_SENSITIVE_NOTICE && n.data.readAt === undefined,
  );
  return (
    <Screen>
      {reviewed.map((n) => {
        const interestId = n.data.params.interestId;
        return (
          <Card key={n.id}>
            <Body>{t('notices.reviewedNotSensitive')}</Body>
            {typeof interestId === 'string' ? (
              <Button
                label={t('notices.treatAsOrdinary')}
                variant="secondary"
                onPress={() => void treatAsOrdinary(interestId).catch(() => setFailed(true))}
              />
            ) : null}
          </Card>
        );
      })}
      {failed ? <ErrorText>{t('errors.FEATURE_DISABLED')}</ErrorText> : null}
      <InterestManager uid={uid} locale={currentLocale()} mode="full" />
    </Screen>
  );
}
