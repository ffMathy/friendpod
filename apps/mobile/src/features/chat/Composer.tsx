import { CHAT_MESSAGE_MAX } from '@grouper/core';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { Button, styles as ui } from '@/components/ui';
import { Spacing, usePalette } from '@/components/theme';

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
        placeholderTextColor={p.textSecondary}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={CHAT_MESSAGE_MAX}
        style={[ui.input, styles.input, { color: p.text, borderColor: p.border, opacity: enabled ? 1 : 0.5 }]}
      />
      <View style={styles.actions}>
        <Text
          accessibilityLabel={t('chat.counterLabel', { length, max: CHAT_MESSAGE_MAX })}
          style={[styles.counter, { color: length >= CHAT_MESSAGE_MAX ? p.danger : p.textSecondary }]}
        >
          {t('chat.counter', { length, max: CHAT_MESSAGE_MAX })}
        </Text>
        {hideSend ? null : (
          <View style={styles.send}>
            <Button testID="chat-send" label={t('chat.send')} disabled={!canSend} busy={busy} onPress={onSend} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: { gap: Spacing.xs },
  input: { maxHeight: 140 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  counter: { fontSize: 13 },
  send: { minWidth: 96 },
});
