import { CHAT_MESSAGE_MAX } from '@grouper/core';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { Spacing, Type, usePalette } from '@/components/theme';
import { Icon } from '@/components/ui';

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

const SEND_SIZE = 46;

/**
 * The meetup-chat composer (storyboard 3.5): a rounded field and a round green Send button, with the 500-character
 * counter (A28) under them. Send stays green while the chat is open, as drawn; with nothing to send it does nothing
 * and is announced as disabled. It turns grey only when the chat is closed.
 */
export function Composer({ value, onChangeText, onSend, enabled, busy, hideSend = false, inputRef }: ComposerProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const length = value.length;
  const trimmed = value.trim().length;
  const canSend = enabled && trimmed > 0 && trimmed <= CHAT_MESSAGE_MAX;
  const sendDisabled = !canSend || busy;
  return (
    <View style={styles.composer}>
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={t('chat.inputLabel')}
          accessibilityState={{ disabled: !enabled }}
          editable={enabled}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={p.muted}
          selectionColor={p.primary}
          cursorColor={p.primary}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={CHAT_MESSAGE_MAX}
          style={[styles.input, { color: p.ink, backgroundColor: p.ground, borderColor: p.borderStrong, opacity: enabled ? 1 : 0.5 }]}
        />
        {hideSend ? null : (
          <Pressable
            testID="chat-send"
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
            accessibilityState={{ disabled: sendDisabled, busy }}
            disabled={sendDisabled}
            onPress={onSend}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: !enabled ? p.disabledBg : pressed && canSend ? p.primaryPressed : p.primary },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={p.onPrimary} />
            ) : (
              <Icon name="send" size={20} strokeWidth={2.2} color={enabled ? p.onPrimary : p.disabledText} />
            )}
          </Pressable>
        )}
      </View>
      <Text
        accessibilityLabel={t('chat.counterLabel', { length, max: CHAT_MESSAGE_MAX })}
        style={[Type.micro, styles.counter, { color: length >= CHAT_MESSAGE_MAX ? p.coralStrong : p.muted }]}
      >
        {t('chat.counter', { length, max: CHAT_MESSAGE_MAX })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  input: {
    ...Type.bodyMd,
    flex: 1,
    minWidth: 0,
    minHeight: SEND_SIZE,
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: SEND_SIZE / 2,
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'center',
  },
  send: { width: SEND_SIZE, height: SEND_SIZE, borderRadius: SEND_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  counter: { textAlign: 'right', paddingHorizontal: Spacing.xs },
});
