import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Body, Heading, LinkRow, Loading, Screen } from '@/components/ui';
import { usePodCards } from '@/data/docs';
import { useUid } from '@/features/session/SessionProvider';

const ACTIVE = new Set(['proposed', 'planning', 'scheduled', 'happened']);

/** Active and past pods (§11). */
export default function Pods() {
  const { t } = useTranslation();
  const router = useRouter();
  const cards = usePodCards(useUid());
  if (cards.isLoading) return <Loading label={t('common.loading')} />;
  const rows = (cards.data ?? []).filter((c) => c.data.myStatus === 'accepted' || c.data.myStatus === 'invited');
  const active = rows.filter((c) => ACTIVE.has(c.data.state));
  const past = rows.filter((c) => !ACTIVE.has(c.data.state));
  const open = (podId: string) => router.push({ pathname: '/pod/[podId]', params: { podId } });
  const label = (theme: string | null, sensitive: boolean) => {
    const text = theme ?? t('pods.openToAnyone');
    return sensitive ? `🔒 ${text}` : text;
  };
  return (
    <Screen>
      <Heading>{t('pods.active')}</Heading>
      {active.length === 0 ? <Body muted>{t('pods.noneActive')}</Body> : null}
      {active.map((c) => (
        <LinkRow key={c.id} label={label(c.data.themeLabel, c.data.themeSensitive)} detail={t(`podState.${c.data.state}`)} onPress={() => open(c.id)} />
      ))}
      <Heading>{t('pods.past')}</Heading>
      {past.length === 0 ? <Body muted>{t('pods.nonePast')}</Body> : null}
      {past.map((c) => (
        <LinkRow key={c.id} label={label(c.data.themeLabel, c.data.themeSensitive)} detail={t(`podState.${c.data.state}`)} onPress={() => open(c.id)} />
      ))}
    </Screen>
  );
}
