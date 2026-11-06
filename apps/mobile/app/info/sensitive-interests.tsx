import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Banner, Card, Heading, Text } from '@/components/ui';
import { PageLede, ShellPage } from '@/features/shell/parts';

const SECTIONS = ['what', 'where', 'who', 'withdraw'] as const;

/**
 * "Private interests" (PRIVACY.md §3), opened by "Read more" on the blanket consent, the interests screen and
 * ProposalCard's "How private interests are protected". The storyboards call these interests private; "sensitive"
 * stays only where the text names the legal category or the consent. First, in the purple private-interest box under
 * "When you add an interest", what happens then: which interests count, that they are saved only with consent, kept
 * private and used only as a pod's theme. It says what core's interest notice (PRIVACY.md §3.2) says, in this page's
 * voice: the notice itself, with its "Tip:" and its pointer to Settings → Privacy, stays verbatim at the interest
 * field, where it belongs. The headed sections in the white card under it add only what that box leaves out (examples
 * and the legal basis, the lock, who sees them, withdrawing), so each fact is said once; then the amber "only share
 * what you're comfortable with".
 */
export default function SensitiveInterests() {
  const { t } = useTranslation();
  return (
    <ShellPage title={t('info.sensitive.title')} testID="sensitive-interests">
      <PageLede>{t('info.sensitive.lede')}</PageLede>
      <Banner tone="private" icon="lock" title={t('info.sensitive.noticeTitle')}>
        {t('info.sensitive.notice')}
      </Banner>
      <Card gap={16}>
        {SECTIONS.map((s) => (
          <View key={s} style={styles.section}>
            <Heading>{t(`info.sensitive.headings.${s}`)}</Heading>
            <Text variant="small" color="textBody">
              {t(`info.sensitive.${s}`)}
            </Text>
          </View>
        ))}
      </Card>
      <Banner tone="warning" icon="info">
        {t('info.sensitive.risk')}
      </Banner>
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  section: { gap: 4 },
});
