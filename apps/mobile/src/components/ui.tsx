/**
 * Small shared building blocks. Every string they render is passed in by the caller, already translated.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing, usePalette } from './theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const p = usePalette();
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: p.background }]} edges={['bottom', 'left', 'right']}>
      {body}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: p.text }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted = false, bold = false }: { children: ReactNode; muted?: boolean; bold?: boolean }) {
  const p = usePalette();
  return <Text style={[styles.body, { color: muted ? p.textSecondary : p.text }, bold && styles.bold]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <Text accessibilityRole="alert" style={[styles.body, { color: p.danger }]}>
      {children}
    </Text>
  );
}

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'secondary' | 'danger';
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly testID?: string;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, busy = false, testID }: ButtonProps) {
  const p = usePalette();
  const inactive = disabled || busy;
  const bg = variant === 'primary' ? p.primary : variant === 'danger' ? p.danger : p.surface;
  const fg = variant === 'secondary' ? p.text : p.onPrimary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: inactive ? p.disabled : bg, opacity: pressed ? 0.8 : 1 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function LinkRow({ label, onPress, detail }: { label: string; onPress: () => void; detail?: string }) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={[styles.row, { borderColor: p.border }]}>
      <Text style={[styles.body, { color: p.text }]}>{label}</Text>
      {detail ? <Text style={[styles.body, { color: p.textSecondary }]}>{detail}</Text> : null}
    </Pressable>
  );
}

export interface CheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly testID?: string;
}

/** Starts unticked wherever consent is asked (EDPB 05/2020 §§93–96); the caller owns the state. */
export function Checkbox({ label, checked, onChange, testID }: CheckboxProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View style={[styles.box, { borderColor: p.text, backgroundColor: checked ? p.primary : 'transparent' }]}>
        {checked ? <Text style={{ color: p.onPrimary }}>✓</Text> : null}
      </View>
      <Text style={[styles.body, styles.flex, styles.bold, { color: p.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[styles.chip, { borderColor: value ? p.primary : p.border, backgroundColor: value ? p.primary : 'transparent' }]}
    >
      <Text style={{ color: value ? p.onPrimary : p.text }}>{label}</Text>
    </Pressable>
  );
}

/** A compact action (role button), for row actions such as "Remove" or a suggested chip. */
export function ChipButton({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[styles.chip, { borderColor: p.border }]}
    >
      <Text style={{ color: p.text }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  readonly label: string;
  readonly error?: string | null;
}

export function Field({ label, error, ...input }: FieldProps) {
  const p = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: p.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={p.textSecondary}
        style={[styles.input, { color: p.text, borderColor: error ? p.danger : p.border }]}
        {...input}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <View style={[styles.card, { backgroundColor: p.surface }]}>{children}</View>;
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator accessibilityLabel={label} />
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  bold: { fontWeight: '700' },
  label: { fontSize: 13 },
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: Spacing.md, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  row: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between' },
  checkRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  box: { width: 24, height: 24, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  chip: { borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  field: { gap: Spacing.xs },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  card: { borderRadius: 16, padding: Spacing.md, gap: Spacing.sm },
});
