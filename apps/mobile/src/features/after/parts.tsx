/**
 * Building blocks of the after-the-meetup screens in direction E (after-feedback, after-member, after-report): the top
 * padding of a page that draws its own header, the bottom sheet over the scrim, the feedback grid's checkboxes and
 * the private Yes / No "meet again" answer, the "I wasn't there myself" check, the report's reason rows and its
 * free-text field. Calm screens: white cards on Paper, Skov for what you tap, Ink for a selected choice.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/components/ui';
import { BorderWidth, Layout, Radius, Size, typeStyle, usePalette } from '@/components/theme';

/**
 * Top padding of a page that draws its own header: the storyboards leave 28–32 px above it. Under a status bar the
 * safe-area inset already gives most of that room, so the page adds only what is missing.
 */
export function useTopPadding(storyboardTop = 32): number {
  const insets = useSafeAreaInsets();
  return Math.max(8, storyboardTop - insets.top);
}

/**
 * A bottom sheet (spec §6.14): the scrim closes it on tap, and a white panel sits at the bottom with 28 px top
 * corners and the 36 × 5 Outline handle. The panel scrolls when its content is taller than the screen allows.
 * `gap` is the space under the handle and between the children (the member sheet's 20; 18 by default); `gutter` the
 * sides (`compact` 20 as in the member sheet, `default` 24 for onboarding-style sheets).
 */
export function BottomSheet({
  children,
  onClose,
  gap = 18,
  gutter = 'default',
  testID,
}: {
  children: ReactNode;
  onClose: () => void;
  gap?: number;
  gutter?: 'default' | 'compact';
  testID?: string;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.frame} testID={testID}>
      {/* The close cross is the accessible way out; the scrim is a shortcut for touch only. */}
      <Pressable onPress={onClose} accessible={false} importantForAccessibility="no" style={[styles.backdrop, { backgroundColor: p.scrim }]} />
      <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: p.surface }]}>
        <View style={[styles.handle, { backgroundColor: p.borderStrong }]} accessible={false} importantForAccessibility="no" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            gap,
            paddingTop: gap,
            paddingHorizontal: gutter === 'compact' ? Layout.gutterCompact : Layout.gutter,
            paddingBottom: Math.max(insets.bottom, Layout.bottom),
          }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Feedback grid
// ---------------------------------------------------------------------------------------------------------------

/**
 * The checkbox square of the design system (spec §6.15): radius 7 at 24 px, white with a 1.5 px Field border when
 * off, Skov with a white tick when on. The tick is the storyboard's bold one (a native checkbox's: about 14 × 12 px
 * with a 3.25 px stroke at 24 px), drawn on the box's own 24-unit grid so it scales with the 20 px quiet check.
 * Decorative: the pressable around it carries the role, label and state.
 */
function CheckSquare({ size, checked }: { size: number; checked: boolean }) {
  const p = usePalette();
  const inner = size - BorderWidth.control * 2;
  const inset = (BorderWidth.control * 24) / size;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.square,
        { width: size, height: size, borderRadius: Math.round((size * 7) / 24) },
        checked ? { backgroundColor: p.primary, borderColor: p.primary } : { backgroundColor: p.surface, borderColor: p.field },
      ]}
    >
      {checked ? (
        // The view box skips the border, so the tick sits on the full 24-unit box as on the storyboard.
        <Svg width={inner} height={inner} viewBox={`${inset} ${inset} ${24 - inset * 2} ${24 - inset * 2}`}>
          <Path d={TICK} fill="none" stroke={p.onPrimary} strokeWidth={3.25} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

/** The bold tick on a 24-unit box: short leg down to the vertex, long leg up to the top right. */
const TICK = 'M6 12.75l3.75 3.75L18.25 6.25';

/**
 * A "Was there" cell of the feedback grid: the 24 px checkbox centred in a 44 × 44 target. Only the box shows; the
 * label ("Mette was there") is read by screen readers.
 */
export function GridCheck({ label, checked, onChange, testID }: { label: string; checked: boolean; onChange: (checked: boolean) => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.gridCheck, { opacity: pressed ? 0.8 : 1 }]}
    >
      <CheckSquare size={24} checked={checked} />
    </Pressable>
  );
}

export type MeetAgain = 'yes' | 'no';

export interface MeetAgainChoiceProps {
  readonly value: MeetAgain | undefined;
  /** `undefined` clears the answer (no answer is a valid choice, §3.6). */
  readonly onChange: (value: MeetAgain | undefined) => void;
  readonly yesLabel: string;
  readonly noLabel: string;
  /** Read by screen readers: "Yes, meet Mette again". */
  readonly yesAccessibilityLabel: string;
  readonly noAccessibilityLabel: string;
  readonly testID?: string;
}

/**
 * The "Meet again" cell of the feedback grid: Yes and No side by side, two 36 px round choices with a 4 px gap, so
 * the pair fills the storyboard's 76 px column. Each is 44 × 44 to the touch: the slop reaches outwards (into the
 * column gap and the card padding), never into the other answer. Tapping the chosen answer again clears it, so "no
 * answer" stays possible (§3.6 yes / no / skip). They read as the rating chips below them and pod-plan's Yes / No (spec
 * §6.15 choice chips): off is white with the 1.5 px Outline, the chosen answer is Ink with white text, whichever it is.
 */
export function MeetAgainChoice({ value, onChange, yesLabel, noLabel, yesAccessibilityLabel, noAccessibilityLabel, testID }: MeetAgainChoiceProps) {
  const options: readonly { answer: MeetAgain; label: string; a11y: string }[] = [
    { answer: 'yes', label: yesLabel, a11y: yesAccessibilityLabel },
    { answer: 'no', label: noLabel, a11y: noAccessibilityLabel },
  ];
  const p = usePalette();
  const vertical = (Size.hitTarget - ANSWER_SIZE) / 2;
  const inner = MEET_AGAIN_GAP / 2;
  const outer = Size.hitTarget - ANSWER_SIZE - inner;
  return (
    <View style={styles.meetAgain}>
      {options.map((o) => {
        const selected = value === o.answer;
        return (
          <Pressable
            key={o.answer}
            testID={testID ? `${testID}-${o.answer}` : undefined}
            accessibilityRole="radio"
            accessibilityLabel={o.a11y}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(selected ? undefined : o.answer)}
            hitSlop={{ top: vertical, bottom: vertical, left: o.answer === 'yes' ? outer : inner, right: o.answer === 'yes' ? inner : outer }}
            style={({ pressed }) => [
              styles.answer,
              selected ? { backgroundColor: p.ink, borderColor: p.ink } : { backgroundColor: pressed ? p.page : p.surface, borderColor: p.borderStrong },
              { opacity: pressed && selected ? 0.85 : 1 },
            ]}
          >
            <Text variant="captionBold" color={selected ? 'onInk' : 'text'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One Yes / No answer: a 36 px circle (a pill as narrow as it gets). */
const ANSWER_SIZE = 36;
const MEET_AGAIN_GAP = 4;
/** Width of the "Meet again" column (the storyboard's 76 px): two 36 px answers and a 4 px gap. */
export const MEET_AGAIN_WIDTH = ANSWER_SIZE * 2 + MEET_AGAIN_GAP;

/**
 * A quiet checkbox for a secondary choice that should not compete with the page around it ("I wasn't there myself",
 * at the right of the back row on after-feedback): a 20 px box of the same family as the grid's, a 13/700 Ink 2 label,
 * and slop that brings the target to 44 px high.
 */
export function QuietCheck({ label, checked, onChange, testID }: { label: string; checked: boolean; onChange: (checked: boolean) => void; testID?: string }) {
  const slop = (Size.hitTarget - QUIET_CHECK_HEIGHT) / 2;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      hitSlop={{ top: slop, bottom: slop, left: 4, right: 12 }}
      style={({ pressed }) => [styles.quietCheck, { opacity: pressed ? 0.7 : 1 }]}
    >
      <CheckSquare size={QUIET_CHECK_HEIGHT} checked={checked} />
      <Text variant="captionBold" color="textSecondary" style={styles.quietCheckLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

/** As tall as its 20 px box, so the row adds little under the grid; the slop makes the target 44. */
const QUIET_CHECK_HEIGHT = 20;

// ---------------------------------------------------------------------------------------------------------------
// Report and block choices
// ---------------------------------------------------------------------------------------------------------------

/**
 * One option of a radio group as a white row (after-report's reasons, the block choices): at least 48 px, radius 16,
 * a 24 px radio and a 15/20 label; 1.5 px Outline when off, a 2 px Skov border, Skov radio and a 600 label when
 * chosen. The design system's `Radio` sets the label at 16 px off and 15 px on and rounds to 14, so this one is
 * drawn here to the storyboard's measure.
 */
export function OptionRow({ label, selected, onPress, testID, disabled = false }: { label: string; selected: boolean; onPress: () => void; testID?: string; disabled?: boolean }) {
  const p = usePalette();
  const border = selected ? BorderWidth.strong : BorderWidth.control;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: pressed && !selected ? p.page : p.surface,
          borderColor: selected ? p.primary : p.borderStrong,
          borderWidth: border,
          // The thicker border eats into the padding, so the radio and label stay put when chosen.
          paddingHorizontal: OPTION_PADDING - border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={[styles.radio, { borderColor: selected ? p.primary : p.field, borderWidth: selected ? BorderWidth.strong : BorderWidth.control }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: p.primary }]} /> : null}
      </View>
      <Text variant={selected ? 'chipLarge' : 'bodySmall'} style={styles.optionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const OPTION_PADDING = 15.5;

export interface NoteFieldProps extends Omit<TextInputProps, 'style' | 'multiline' | 'maxLength' | 'value'> {
  /** 15/700 label, followed by a muted "(optional)"; also the input's accessibility label. */
  readonly label: string;
  readonly value: string;
  /** Shown as "0 / 500" at the right of the label. */
  readonly maxLength: number;
  /** Muted 13 px line under the field. */
  readonly helper?: string;
}

/**
 * The optional free-text field of a report (after-report, spec §6.2 standalone input): the label row with the
 * counter (12/16/600 Muted), then 6 px below it a three-line text area (16/24 text, 12 / 14 padding, radius 14,
 * 1.5 px Field border; 2 px Skov deep when focused), then the helper.
 */
export function NoteField({ label, value, maxLength, helper, onFocus, onBlur, ...input }: NoteFieldProps) {
  const p = usePalette();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const border = focused ? BorderWidth.strong : BorderWidth.control;
  return (
    <View style={styles.note}>
      <View style={styles.noteLabelRow}>
        <Text variant="heading" style={styles.noteLabel}>
          {label}
          {/* The nested run keeps the label's 20 px line, or its own 22 would make the row taller. */}
          <Text variant="heading" weight="500" color="textMuted" style={styles.noteOptional}>
            {` ${t('common.optional')}`}
          </Text>
        </Text>
        <Text variant="microStrong" color={value.length >= maxLength ? 'danger' : 'textMuted'}>
          {`${value.length} / ${maxLength}`}
        </Text>
      </View>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={helper}
        placeholderTextColor={p.textMuted}
        multiline
        maxLength={maxLength}
        value={value}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          typeStyle('body'),
          styles.noteInput,
          {
            color: p.text,
            backgroundColor: p.surface,
            borderColor: focused ? p.link : p.field,
            borderWidth: border,
            // A thicker border eats into the padding, so the text does not move when the field gets focus.
            paddingHorizontal: NOTE_PADDING_H - border,
            paddingVertical: NOTE_PADDING_V - border,
          },
        ]}
        {...input}
      />
      {helper ? (
        <Text variant="caption" color="textMuted" style={styles.noteHelper}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

/** Padding to the text, border included (the storyboard's 12 / 14 inside a 1.5 px border). */
const NOTE_PADDING_H = 15.5;
const NOTE_PADDING_V = 13.5;
/** Three 24 px lines, the padding and the border: the storyboard's `rows="3"` (99 px). */
const NOTE_MIN_HEIGHT = 24 * 3 + NOTE_PADDING_V * 2;

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  panel: { maxHeight: '92%', borderTopLeftRadius: Radius.panel, borderTopRightRadius: Radius.panel, paddingTop: 12 },
  handle: { width: 36, height: 5, borderRadius: Radius.bar, alignSelf: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  meetAgain: { width: MEET_AGAIN_WIDTH, flexDirection: 'row', justifyContent: 'space-between' },
  answer: {
    width: ANSWER_SIZE,
    height: ANSWER_SIZE,
    borderRadius: ANSWER_SIZE / 2,
    borderWidth: BorderWidth.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: BorderWidth.control },
  gridCheck: { width: Size.hitTarget, height: Size.hitTarget, alignItems: 'center', justifyContent: 'center' },
  quietCheck: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: QUIET_CHECK_HEIGHT, alignSelf: 'flex-start' },
  quietCheckLabel: { flexShrink: 1 },
  option: { minHeight: 48, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  optionLabel: { flex: 1, lineHeight: 20 },
  radio: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  note: { gap: 6 },
  noteLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  noteLabel: { flexShrink: 1, lineHeight: 20 },
  noteOptional: { lineHeight: 20 },
  noteInput: { minHeight: NOTE_MIN_HEIGHT, borderRadius: Radius.md, textAlignVertical: 'top' },
  noteHelper: { lineHeight: 19 },
});
