import { DROP_TIME_ZONE, POSTCODE_ATTRIBUTION, type Locale } from '@grouper/core';
import { useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { BorderWidth, Radius, usePalette } from '@/components/theme';
import { Badge, Card, ListRow, ListSection, Overline, Text, TextLink } from '@/components/ui';
import { CC_BY_4_URL, FONT_CREDITS, GEONAMES_URL, SOFTWARE, type FontCredit, type SoftwareCredit } from '@/features/shell/licences';
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
 * their outline and the month of the draft, marked with the Ink "Draft" status pill, until counsel has approved the text.
 * Licences credits the postcode data (GeoNames, CC BY 4.0, two standalone 44 px links), both bundled fonts (Plus Jakarta Sans and Bricolage
 * Grotesque) each with its full SIL Open Font License, and the open-source software and model the app ships. All three
 * cards are titled the same way, with the list card's eyebrow (POSTCODES, FONTS, OPEN-SOURCE SOFTWARE), and each
 * font's "Show the licence" is a standalone 15/700 link. Like every info page, no eyebrow above the title: they open
 * from anywhere, signed in or out.
 */
export default function LegalDoc() {
  const { t } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  if (!isDoc(doc)) {
    return (
      <ShellPage title={t('info.legalTitle')}>
        <Card>
          <Text variant="body" color="text">
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
          {/* The Ink status pill (blend-spec 6.4): a state of the document, not an action or a warning. */}
          <Badge tone="status" testID="legal-draft" label={t('info.legalDraft')} />
          {month ? (
            <Text variant="caption" color="textMuted">
              {t('info.legalVersion', { month })}
            </Text>
          ) : null}
        </View>
        <Text variant="body" color="text">
          {t(`info.legal.${doc}.body`)}
        </Text>
      </Card>
    </ShellPage>
  );
}

/**
 * One bundled font: its name and licence, the copyright line, and its full licence behind a toggle (the OFL asks that
 * notice and licence travel with the font). The toggle's spoken label names the font, as there are two.
 */
function FontLicence({ font, separator }: { readonly font: FontCredit; readonly separator: boolean }) {
  const { t } = useTranslation();
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const slug = font.name.toLowerCase().replace(/\s+/g, '-');
  return (
    <View style={[styles.font, separator ? { borderTopWidth: BorderWidth.hairline, borderTopColor: p.separator, paddingTop: 14 } : null]} testID={`licence-font-${slug}`}>
      <Text variant="small" color="text">
        {`${font.name}, ${font.licence}`}
      </Text>
      <Text variant="caption" color="textMuted">
        {font.copyright}
      </Text>
      <TextLink
        compact
        testID={`font-licence-toggle-${slug}`}
        label={open ? t('info.legalHideLicence') : t('info.legalShowLicence')}
        accessibilityLabel={open ? t('info.legalHideLicenceFor', { name: font.name }) : t('info.legalShowLicenceFor', { name: font.name })}
        onPress={() => setOpen((v) => !v)}
      />
      {open ? (
        <View style={[styles.licence, { backgroundColor: p.inset }]}>
          <Text variant="micro" color="textSecondary" testID={`font-licence-text-${slug}`}>
            {font.licenceText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Licences() {
  const { t } = useTranslation();
  return (
    <ShellPage title={t('info.legal.licences.title')} testID="legal-licences">
      <Text variant="body" color="textSecondary">
        {t('info.legal.licences.body')}
      </Text>

      <Card gap={6} testID="licence-postcodes">
        <Overline>{t('info.legalPostcodes')}</Overline>
        <Text variant="small" color="text">
          {t('info.legalPostcodesUse')}
        </Text>
        {/* Standalone links, each with a 44 px touch target (an inline link in a 14 px line would be about 20 px tall). */}
        <View style={styles.links}>
          <TextLink label={POSTCODE_SOURCE} onPress={open(GEONAMES_URL)} />
          <TextLink label="CC BY 4.0" onPress={open(CC_BY_4_URL)} />
        </View>
      </Card>

      <Card gap={14} testID="licence-fonts">
        <Overline>{t('info.legalFonts')}</Overline>
        {FONT_CREDITS.map((font, i) => (
          <FontLicence key={font.name} font={font} separator={i > 0} />
        ))}
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
  font: { gap: 6 },
  // Two 44 px links side by side (wrapping on a narrow screen), far enough apart that their touch areas don't meet.
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
  // A note inside a card: Paper, radius 14, padding 10/12, no border.
  licence: { marginTop: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.md },
});
