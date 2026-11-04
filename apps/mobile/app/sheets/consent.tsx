import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Body, Screen } from '@/components/ui';
import { Art9ConsentSheet } from '@/features/consent/Art9ConsentSheet';
import { consentRequestTag, settleConsentRequest } from '@/features/consent/requests';
import { currentLocale } from '@/i18n';

/**
 * Art. 9 explicit consent sheet (§11 `sheets/consent`, PRIVACY.md §3.3). The tag comes from the
 * in-memory request, not from the URL. Leaving the sheet any other way counts as "Don't add".
 */
export default function ConsentSheetRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const { request } = useLocalSearchParams<{ request?: string }>();
  const requestId = request ?? '';
  const tag = consentRequestTag(requestId);

  useEffect(() => () => settleConsentRequest(requestId, null), [requestId]);

  if (tag === null) {
    return (
      <Screen>
        <Body>{t('consent.expired')}</Body>
      </Screen>
    );
  }
  return (
    <Art9ConsentSheet
      tag={tag}
      locale={currentLocale()}
      onAdd={(grant) => {
        settleConsentRequest(requestId, grant);
        router.back();
      }}
      onDontAdd={() => {
        settleConsentRequest(requestId, null);
        router.back();
      }}
      onReadMore={() => router.push('/info/sensitive-interests')}
    />
  );
}
