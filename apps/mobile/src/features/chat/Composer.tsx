import { CHAT_MESSAGE_MAX } from '@grouper/core';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { Button, Text } from '@/components/ui';
import { BorderWidth, typeStyle, usePalette } from '@/components/theme';

export interface ComposerProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSend: () => void;
  /** False outside the window: the field and Send are disabled, existing messages stay readable. */
  readonly enabled: boolean;
  readonly busy: boolean;
  /** While the contact-details warning offers "Send anyway" / "Edit" instead. */
  readonly hideSend?: boolean;
  readonly inputRef?: Ref<TextInputInstance>;
}

/** The meetup-chat text field with its 500-character counter (A28). */
export function Composer({ value, onChangeText, onSend, enabled, busy, hideSend = false, inputRef }: ComposerProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const length = value.length;
  const trimmed = value.trim().length;
  const canSend = enabled && trimmed > 0 && trimmed <= CHAT_MESSAGE_MAX;
  return (
    <View style={styles.composer}>
      <TextInput
        ref={inputRef}
        accessibilityLabel={t('chat.inputLabel')}
        accessibilityState={{ disabled: !enabled }}
        editable={enabled}
        placeholder={t('chat.placeholder')}
        placeholderTextColor={p.textFaint}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={CHAT_MESSAGE_MAX}
        style={[typeStyle('body'), styles.input, { color: p.text, backgroundColor: p.page, borderColor: p.borderStrong, opacity: enabled ? 1 : 0.5 }]}
      />
      <View style={styles.actions}>
        <Text
          accessibilityLabel={t('chat.counterLabel', { length, max: CHAT_MESSAGE_MAX })}
          variant="caption"
          color={length >= CHAT_MESSAGE_MAX ? 'dangerText' : 'textMuted'}
        >
          {t('chat.counter', { length, max: CHAT_MESSAGE_MAX })}
        </Text>
        {hideSend ? null : (
          <View style={styles.send}>
            <Button testID="chat-send" label={t('chat.send')} icon="send" size="sm" disabled={!canSend} busy={busy} onPress={onSend} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: { gap: 6 },
  input: { minHeight: 46, maxHeight: 140, borderRadius: 23, borderWidth: BorderWidth.hairline, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  send: { minWidth: 96 },
});
