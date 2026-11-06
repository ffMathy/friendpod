import { POSTCODE_ATTRIBUTION } from '@grouper/core';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, Screen, ScreenHeader } from '@/components/ui';
import { useBack } from '@/features/settings/useBack';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal';

const DOCS = ['terms', 'privacy', 'licences'] as const;
type Doc = (typeof DOCS)[number];
const isDoc = (v: string | undefined): v is Doc => (DOCS as readonly string[]).includes(v ?? '');

/**
 * Terms, privacy notice and licences. The legal documents are still drafts (PRIVACY.md §16–17), so these
 * pages show their outline and version until counsel has approved the text.
 */
export default function LegalDoc() {
  const { t } = useTranslation();
  const back = useBack('/');
  const { doc } = useLocalSearchParams<{ doc: string }>();
  if (!isDoc(doc)) {
    return (
      <Screen>
        <ScreenHeader title={t('info.legalTitle')} backLabel={t('common.back')} onBack={back} />
        <AppText variant="bodyMd">{t('info.legalUnknown')}</AppText>
      </Screen>
    );
  }
  return (
    <Screen>
      <ScreenHeader eyebrow={t('info.legalTitle')} title={t(`info.legal.${doc}.title`)} backLabel={t('common.back')} onBack={back} />
      <Card>
        <AppText variant="bodyMd">{t(`info.legal.${doc}.body`)}</AppText>
        <AppText variant="caption" tone="muted">
          {doc === 'licences' ? POSTCODE_ATTRIBUTION : t('info.legalVersion', { version: LEGAL_DOC_VERSIONS[doc] })}
        </AppText>
      </Card>
    </Screen>
  );
}
