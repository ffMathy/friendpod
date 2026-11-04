import { ART9_CATEGORIES, type Art9Category, type Locale } from '@grouper/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Body, Button, Checkbox, ChipRow, Heading, Screen, Toggle } from '@/components/ui';
import { art9ConsentCopy, art9ConsentPayload, fillSheet, type Art9ConsentGrant } from './art9';

export interface Art9ConsentSheetProps {
  /** The user's own wording, as typed (`display`): consent is per tag (PRIVACY.md §3.1). */
  readonly tag: string;
  readonly locale: Locale;
  readonly onAdd: (grant: Art9ConsentGrant) => void;
  readonly onDontAdd: () => void;
  readonly onReadMore: () => void;
}

/**
 * The explicit Art. 9 consent sheet (PRIVACY.md §3.3): verbatim copy from @grouper/core, an unticked
 * checkbox, "Add" disabled until it is ticked, and "Don't add" that discards the tag. The optional
 * category pick is not part of the hashed text, so its labels come from i18n.
 */
export function Art9ConsentSheet({ tag, locale, onAdd, onDontAdd, onReadMore }: Art9ConsentSheetProps) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const [category, setCategory] = useState<Art9Category | undefined>(undefined);
  const { textId, sheet } = art9ConsentCopy(locale);
  const copy = fillSheet(sheet, tag);

  return (
    <Screen>
      <Heading>{copy.title}</Heading>
      <Body>{copy.intro}</Body>
      <View>
        <Body>{copy.listIntro}</Body>
        {copy.bullets.map((bullet) => (
          <Body key={bullet}>{`• ${bullet}`}</Body>
        ))}
      </View>
      <Text>
        <Body bold>{copy.note.label}</Body> <Body>{copy.note.text}</Body>
      </Text>
      <Body>{copy.withdrawal}</Body>

      <Body muted>{t('consent.categoryPrompt')}</Body>
      <ChipRow>
        {ART9_CATEGORIES.map((c) => (
          <Toggle
            key={c}
            label={t(`categories.${c}`)}
            value={category === c}
            onChange={(on) => setCategory(on ? c : undefined)}
            testID={`category-${c}`}
          />
        ))}
      </ChipRow>

      <Checkbox testID="consent-checkbox" label={copy.checkbox} checked={checked} onChange={setChecked} />
      <Button
        testID="consent-add"
        label={copy.addButton}
        disabled={!checked}
        onPress={() => onAdd({ consent: art9ConsentPayload(textId), ...(category ? { category } : {}) })}
      />
      <Button testID="consent-dont-add" label={copy.dontAddButton} variant="secondary" onPress={onDontAdd} />
      <Button testID="consent-read-more" label={copy.readMore} variant="secondary" onPress={onReadMore} />
    </Screen>
  );
}
