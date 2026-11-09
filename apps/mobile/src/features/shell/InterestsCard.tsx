import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, ChipRow, Overline, StatusText, Text, TextLink } from '@/components/ui';
import { useInterests, useSensitiveInterests } from '@/data/docs';
import { interestColor } from '@/lib/podColor';

/**
 * "Your interests" on Me: each interest as its pod chip, in the colour of its word (the same word has the same colour
 * everywhere, for everyone), the main ones with the Ink star; "Edit" opens the Interests tab, where
 * they are managed. Private interests stay quiet and unnamed here, as a count with the Ink lock: Me is the user's own
 * summary, but it is the page that looks most like a profile, and private interests are never on one.
 */
export function InterestsCard({ uid }: { readonly uid: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const interests = useInterests(uid);
  const sensitive = useSensitiveInterests(uid);
  // Me works without this card: it appears once the interests have loaded, and not at all if they can't be.
  if (!interests.data) return null;
  const rows = interests.data;
  const privateCount = sensitive.data?.length ?? 0;
  return (
    <Card gap={12} testID="me-interests">
      <View style={styles.header}>
        <Overline style={styles.flex}>{t('me.interestsTitle')}</Overline>
        <TextLink compact testID="me-edit-interests" label={t('me.editInterests')} accessibilityLabel={t('me.editInterestsLabel')} onPress={() => router.push('/interests')} />
      </View>
      {rows.length === 0 && privateCount === 0 ? (
        <Text variant="small" color="textSecondary">
          {t('me.noInterests')}
        </Text>
      ) : null}
      {rows.length > 0 ? (
        <ChipRow>
          {rows.map(({ id, data }) => (
            <Chip
              key={id}
              testID={`me-interest-${id}`}
              label={data.display}
              color={interestColor(data)}
              starred={data.starred}
              starredLabel={t('common.mainInterest')}
            />
          ))}
        </ChipRow>
      ) : null}
      {privateCount > 0 ? <StatusText testID="me-private-count" icon="lock" color="text" label={t('me.privateInterests', { count: privateCount })} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 24 },
  flex: { flex: 1 },
});
