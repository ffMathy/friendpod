import { currentLegalText } from '@grouper/core';
import { useTranslation } from 'react-i18next';
import { Body, Screen } from '@/components/ui';
import { currentLocale } from '@/i18n';

/** "Read more about sensitive interests" from the consent sheet (PRIVACY.md §3). */
export default function SensitiveInterests() {
  const { t } = useTranslation();
  const notice = currentLegalText('interestNotice', currentLocale());
  return (
    <Screen>
      <Body>{notice.kind === 'interestNotice' ? notice.content.text : ''}</Body>
      {(['what', 'where', 'who', 'withdraw', 'risk'] as const).map((s) => (
        <Body key={s}>{t(`info.sensitive.${s}`)}</Body>
      ))}
    </Screen>
  );
}
