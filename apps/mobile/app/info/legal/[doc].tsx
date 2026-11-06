import { DROP_TIME_ZONE, POSTCODE_ATTRIBUTION, type Locale } from '@grouper/core';
import { useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
import { Badge, Card, Heading, InlineLink, ListRow, ListSection, Text, TextLink } from '@/components/ui';
import { CC_BY_4_URL, FONT_CREDIT, FONT_LICENCE_TEXT, GEONAMES_URL, SOFTWARE, type SoftwareCredit } from '@/features/shell/licences';
import { ShellPage } from '@/features/shell/parts';
import { currentLocale } from '@/i18n';
import { LEGAL_DOC_VERSIONS } from '@/lib/legal';

const DOCS = ['terms', 'privacy', 'licences'] as const;
type Doc = (typeof DOCS)[number];
const isDoc = (v: string | undefined): v is Doc => (DOCS as readonly string[]).includes(v ?? '');

/** "GeoNames (www.geonames.org)": the credited source from core's CC BY attribution, without its English label. */
const POSTCODE_SOURCE = POSTCODE_ATTRIBUTION.replace(/^[^:]*:\s*/, '');

/** "terms-2026-11.draft-1" → "November 2026" / "november 2026": the month the draft is from, never the raw id. */
function versionMonth(version: string, locale: Locale): string | null {
  const m = /-(\d{4})-(\d{2})\b/.exec(version);
  if (!m) return null;
  const at = Date.UTC(Number(m[1]), Number(m[2]) - 1, 15);
  return new Intl.DateTimeFormat(locale === 'da' ? 'da-DK' : 'en-GB', { month: 'long', year: 'numeric', timeZone: DROP_TIME_ZONE }).format(new Date(at));
}

const open = (url: string) => () => void Linking.openURL(url).catch(() => undefined);

/** "React and React Native" / "React og React Native", "EmbeddingGemma 2 (modellen på telefonen)". */
function softwareLabel(t: TFunction, s: SoftwareCredit): string {
  const last = s.names[s.names.length - 1] ?? '';
  const names = s.names.length > 1 ? t('info.legalAnd', { list: s.names.slice(0, -1).join(', '), last }) : last;
  return s.what === 'onDeviceModel' ? t('info.legalOnDeviceModel', { name: names }) : names;
}

/**
 * Terms, privacy notice and licences. The legal documents are still drafts (PRIVACY.md §16–17), so these pages show
 * their outline and the month of the draft, marked "Draft", until counsel has approved the text. Licences credits the
 * postcode data (GeoNames, CC BY 4.0), the bundled font with its full SIL Open Font License, and the open-source
 * software and model the app ships. Like every info page, no eyebrow: they open from anywhere, signed in or out.
 */
export default function LegalDoc() {
  const { t } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  if (!isDoc(doc)) {
    return (
      <ShellPage title={t('info.legalTitle')}>
        <Card>
          <Text variant="body" color="textBody">
            {t('info.legalUnknown')}
          </Text>
        </Card>
      </ShellPage>
    );
  }
  if (doc === 'licences') return <Licences />;
  const month = versionMonth(LEGAL_DOC_VERSIONS[doc], currentLocale());
  return (
    <ShellPage title={t(`info.legal.${doc}.title`)} testID={`legal-${doc}`}>
      <Card gap={12}>
        <View style={styles.meta}>
          <Badge tone="warning" size="sm" label={t('info.legalDraft')} />
          {month ? (
            <Text variant="caption" color="textMuted">
              {t('info.legalVersion', { month })}
            </Text>
          ) : null}
        </View>
        <Text variant="body" color="textBody">
          {t(`info.legal.${doc}.body`)}
        </Text>
      </Card>
    </ShellPage>
  );
}

function Licences() {
  const { t } = useTranslation();
  const p = usePalette();
  const [fontLicence, setFontLicence] = useState(false);
  return (
    <ShellPage title={t('info.legal.licences.title')} testID="legal-licences">
      <Text variant="body" color="textSecondary">
        {t('info.legal.licences.body')}
      </Text>

      <Card gap={6} testID="licence-postcodes">
        <Heading>{t('info.legalPostcodes')}</Heading>
        <Text variant="small" color="textBody">
          {t('info.legalPostcodesUse')}
        </Text>
        <Text variant="small" color="textBody">
          <InlineLink onPress={open(GEONAMES_URL)}>{POSTCODE_SOURCE}</InlineLink>
          {', '}
          <InlineLink onPress={open(CC_BY_4_URL)}>CC BY 4.0</InlineLink>
        </Text>
      </Card>

      <Card gap={6} testID="licence-font">
        <Heading>{t('info.legalFont')}</Heading>
        <Text variant="small" color="textBody">
          {`${FONT_CREDIT.name}, ${FONT_CREDIT.licence}`}
        </Text>
        <Text variant="caption" color="textMuted">
          {FONT_CREDIT.copyright}
        </Text>
        <TextLink
          compact
          size="sm"
          testID="font-licence-toggle"
          label={fontLicence ? t('info.legalHideLicence') : t('info.legalShowLicence')}
          onPress={() => setFontLicence((v) => !v)}
        />
        {fontLicence ? (
          <View style={[styles.licence, { backgroundColor: p.inset, borderColor: p.separator }]}>
            <Text variant="micro" color="textSecondary" testID="font-licence-text">
              {FONT_LICENCE_TEXT}
            </Text>
          </View>
        ) : null}
      </Card>

      <ListSection title={t('info.legalSoftware')} testID="licence-software">
        {SOFTWARE.map((s) => (
          <ListRow key={s.names.join()} label={softwareLabel(t, s)} value={s.licence} />
        ))}
      </ListSection>
      <Text variant="caption" color="textMuted">
        {t('info.legalSoftwareNote')}
      </Text>
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  licence: { marginTop: 6, padding: 12, borderRadius: Radius.sm, borderWidth: BorderWidth.hairline },
});
