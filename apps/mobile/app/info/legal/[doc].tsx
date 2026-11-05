import { POSTCODE_ATTRIBUTION } from '@grouper/core';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Body, Heading, Screen } from '@/components/ui';
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
  const { doc } = useLocalSearchParams<{ doc: string }>();
  if (!isDoc(doc)) {
    return (
      <Screen>
        <Body>{t('info.legalUnknown')}</Body>
      </Screen>
    );
  }
  return (
    <Screen>
      <Heading>{t(`info.legal.${doc}.title`)}</Heading>
      <Body>{t(`info.legal.${doc}.body`)}</Body>
      {doc === 'licences' ? <Body muted>{POSTCODE_ATTRIBUTION}</Body> : <Body muted>{t('info.legalVersion', { version: LEGAL_DOC_VERSIONS[doc] })}</Body>}
    </Screen>
  );
}
