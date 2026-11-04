import type { Locale } from '@grouper/core';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Checkbox, ErrorText, Heading } from '@/components/ui';
import { art9BlanketCopy, consentPayload, type ConsentPayload } from './art9';

export interface Art9BlanketConsentProps {
  readonly locale: Locale;
  readonly onAgree: (consent: ConsentPayload) => void;
  readonly onNotNow: () => void;
  readonly onReadMore: () => void;
  readonly busy?: boolean;
  readonly error?: string | null;
}

/**
 * The blanket Art. 9 consent (D3, PRIVACY.md §3.3), on its own screen: verbatim copy from @grouper/core, an unticked
 * checkbox, "I agree" disabled until it is ticked, and "Not now", which carries on with nothing recorded. Saying no
 * keeps the app usable; sensitive tags are then refused when added, so the consent stays freely given.
 */
export function Art9BlanketConsent({ locale, onAgree, onNotNow, onReadMore, busy = false, error = null }: Art9BlanketConsentProps) {
  const [checked, setChecked] = useState(false);
  const { textId, copy } = art9BlanketCopy(locale);
  return (
    <View style={{ gap: 16 }}>
      <Heading>{copy.title}</Heading>
      <Body>{copy.intro}</Body>
      <View style={{ gap: 4 }}>
        <Body>{copy.listIntro}</Body>
        {copy.bullets.map((bullet) => (
          <Body key={bullet}>{`• ${bullet}`}</Body>
        ))}
      </View>
      <Text>
        <Body bold>{copy.note.label}</Body> <Body>{copy.note.text}</Body>
      </Text>
      <Body>{copy.override}</Body>
      <Body>{copy.withdrawal}</Body>
      <Checkbox testID="art9-checkbox" label={copy.checkbox} checked={checked} onChange={setChecked} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button testID="art9-agree" label={copy.agreeButton} disabled={!checked} busy={busy} onPress={() => onAgree(consentPayload(textId))} />
      <Button testID="art9-not-now" label={copy.notNowButton} variant="secondary" disabled={busy} onPress={onNotNow} />
      <Button label={copy.readMore} variant="secondary" onPress={onReadMore} />
    </View>
  );
}
