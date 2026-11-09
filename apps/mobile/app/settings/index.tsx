import type { Locale } from '@grouper/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ErrorText, ListRow, ListSection, SegmentedControl } from '@/components/ui';
import { useCallable } from '@/data/useCallable';
import { signOut } from '@/features/account/account';
import { ControlRow, GlobeIcon, ShellPage } from '@/features/shell/parts';
import { currentLocale, initI18n } from '@/i18n';
import { errorMessageKey } from '@/lib/errors';

/**
 * Me → Settings: what Me's row promises, the app language (saved on the profile, so pushes and the drop use it too),
 * notifications, the legal documents and sign out; plus Privacy, because the locked consent texts send people to
 * "Settings → Privacy". Me lists Privacy too (priv-settings' eyebrow is "Me") with its summary line; here it is a plain
 * row, so the two lists don't repeat each other. Pod preferences and messages from Friendpod are on Me, blocked people
 * under Privacy. Laid out like priv-settings: "Me" above the title, white list cards with eyebrows, Ink 2 row icons,
 * the language as a segmented control (selected: Ink), and "Sign out" as a white secondary button (it is not
 * destructive: nothing is deleted). As in priv-settings, a card's rows either all have an icon or none do: General's
 * three rows each have one (a globe for the language), the legal documents none.
 */
export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const updateProfile = useCallable('updateProfile');
  const [busy, setBusy] = useState(false);
  const locale = currentLocale();
  return (
    <ShellPage title={t('settings.title')} eyebrow={t('tabs.me')} testID="settings">
      <ListSection title={t('settings.general')}>
        <ControlRow label={t('me.language')} leading={<GlobeIcon />} separator>
          <SegmentedControl<Locale>
            testID="language"
            accessibilityLabel={t('me.language')}
            options={[
              { value: 'da', label: t('languages.da') },
              { value: 'en', label: t('languages.en') },
            ]}
            value={locale}
            onChange={(l) => updateProfile.mutate({ locale: l }, { onSuccess: () => initI18n(l) })}
          />
        </ControlRow>
        <ListRow icon="bell" label={t('settings.notifications.title')} onPress={() => router.push('/settings/notifications')} />
        <ListRow icon="lock" label={t('settings.privacy.title')} onPress={() => router.push('/settings/privacy')} />
      </ListSection>
      {updateProfile.error ? <ErrorText>{t(errorMessageKey(updateProfile.error))}</ErrorText> : null}

      <ListSection title={t('info.legalTitle')}>
        <ListRow label={t('info.legalTerms')} onPress={() => router.push({ pathname: '/info/legal/[doc]', params: { doc: 'terms' } })} />
        <ListRow label={t('info.legalPrivacy')} onPress={() => router.push({ pathname: '/info/legal/[doc]', params: { doc: 'privacy' } })} />
        <ListRow label={t('info.legalLicences')} onPress={() => router.push({ pathname: '/info/legal/[doc]', params: { doc: 'licences' } })} />
      </ListSection>

      <Button
        testID="sign-out"
        label={t('settings.signOut')}
        variant="secondary"
        size="md"
        fullWidth
        busy={busy}
        onPress={() => {
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        }}
      />
    </ShellPage>
  );
}
