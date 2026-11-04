import { useTranslation } from 'react-i18next';
import { Body, Heading, Screen } from '@/components/ui';

const SECTIONS = ['inputs', 'notUsed', 'sensitive', 'pauses', 'humanReview', 'pause'] as const;

/** "How matching works" (§11, PRIVACY.md §4.4): inputs used and not used, every automated pause, human review. */
export default function HowMatchingWorks() {
  const { t } = useTranslation();
  return (
    <Screen>
      {SECTIONS.map((s) => (
        <Body key={s}>{t(`info.howMatchingWorks.${s}`)}</Body>
      ))}
      <Heading>{t('info.howMatchingWorks.pausesTitle')}</Heading>
      {(['reports', 'noShow', 'underage', 'notGenuine'] as const).map((p) => (
        <Body key={p}>{`• ${t(`info.howMatchingWorks.pauseList.${p}`)}`}</Body>
      ))}
    </Screen>
  );
}
