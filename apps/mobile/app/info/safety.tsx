import { useTranslation } from 'react-i18next';
import { Body, Screen } from '@/components/ui';

const TIPS = ['public', 'transport', 'tellFriend', 'leave', 'drink', 'address', 'report'] as const;

/** Safety tips (§4.5), shown at confirmation and at T−24 h. */
export default function Safety() {
  const { t } = useTranslation();
  return (
    <Screen>
      {TIPS.map((tip) => (
        <Body key={tip}>{`• ${t(`info.safety.tips.${tip}`)}`}</Body>
      ))}
    </Screen>
  );
}
