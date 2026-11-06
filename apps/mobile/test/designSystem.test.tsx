import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ConfigContext } from 'expo/config';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { StyleSheet, Text } from 'react-native';
import appConfig from '../app.config';
import { ANDROID_FONT_FAMILY, AvatarFills, Colors, IOS_FONT_FAMILY, avatarFill, type Palette } from '@/components/theme';
import {
  Avatar,
  Button,
  Checkbox,
  ChoiceRow,
  Field,
  Icon,
  ICON_NAMES,
  LinkRow,
  ListGroup,
  Logo,
  HeroCircles,
  Screen,
  ScreenHeader,
  Segmented,
  StatCard,
  StepHeader,
  Toggle,
} from '@/components/ui';

const projectRequire = createRequire(path.join(__dirname, '..', 'package.json'));

/** The PostScript name (name table, nameID 6) of a TrueType file: what iOS calls the font. */
function postScriptName(file: string): string {
  const buf = readFileSync(file);
  const tables = buf.readUInt16BE(4);
  for (let i = 0; i < tables; i++) {
    const rec = 12 + 16 * i;
    if (buf.toString('latin1', rec, rec + 4) !== 'name') continue;
    const table = buf.readUInt32BE(rec + 8);
    const count = buf.readUInt16BE(table + 2);
    const strings = table + buf.readUInt16BE(table + 4);
    for (let j = 0; j < count; j++) {
      const r = table + 6 + 12 * j;
      const platform = buf.readUInt16BE(r);
      if (buf.readUInt16BE(r + 6) !== 6) continue;
      const start = strings + buf.readUInt16BE(r + 10);
      const raw = buf.subarray(start, start + buf.readUInt16BE(r + 8));
      return platform === 1 ? raw.toString('latin1') : Buffer.from(raw).swap16().toString('utf16le');
    }
  }
  throw new Error(`no PostScript name in ${file}`);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

describe('design foundation: fonts', () => {
  const ctx = { config: {}, projectRoot: path.join(__dirname, '..') } as unknown as ConfigContext;
  const plugin = appConfig(ctx).plugins?.find((entry) => Array.isArray(entry) && entry[0] === 'expo-font');
  const fonts = (Array.isArray(plugin) ? (plugin[1] as { fonts: string[] }).fonts : []).map((f) => projectRequire.resolve(f));

  it('embeds the five Plus Jakarta Sans weights with the expo-font plugin', () => {
    expect(fonts).toHaveLength(5);
  });

  it('names each Android family after its embedded file', () => {
    expect(fonts.map((f) => path.basename(f, '.ttf'))).toEqual(Object.values(ANDROID_FONT_FAMILY));
  });

  it('names each iOS family by the PostScript name inside the file', () => {
    expect(fonts.map(postScriptName)).toEqual(Object.values(IOS_FONT_FAMILY));
  });
});

describe('design foundation: palette', () => {
  const pairs: readonly (readonly [keyof Palette, keyof Palette])[] = [
    ['ink', 'ground'],
    ['ink', 'surface'],
    ['muted', 'ground'],
    ['muted', 'surface'],
    ['inkSoft', 'surface'],
    ['primary', 'ground'],
    ['onPrimary', 'primary'],
    ['onInk', 'ink'],
    ['mintText', 'mint'],
    ['onMint', 'mint'],
    ['onAmber', 'amber'],
    ['amberText', 'amberBg'],
    ['amberInk', 'amberBg'],
    ['coralText', 'coralBg'],
    ['coralTextSoft', 'coralBg'],
    ['onCoralStrong', 'coralStrong'],
    ['coralStrong', 'ground'],
    ['violet', 'violetBg'],
    ['violet', 'surface'],
    ['onViolet', 'violet'],
    ['violetText', 'violetBg'],
    ['onNight', 'night'],
    ['nightMuted', 'night'],
    ['amber', 'night'],
    ['onForest', 'forest'],
    ['forestMuted', 'forest'],
    ['disabledText', 'disabledBg'],
  ];
  it.each(['light', 'dark'] as const)('keeps text pairs at WCAG AA in %s mode', (scheme) => {
    const p: Palette = Colors[scheme];
    const failing = pairs.filter(([fg, bg]) => contrast(p[fg], p[bg]) < 4.5).map(([fg, bg]) => `${fg}/${bg}`);
    expect(failing).toEqual([]);
  });

  it.each(['light', 'dark'] as const)('keeps the star on an ink chip at 3:1 (WCAG 1.4.11) in %s mode', (scheme) => {
    expect(contrast(Colors[scheme].starOnInk, Colors[scheme].ink)).toBeGreaterThanOrEqual(3);
  });

  it('gives a person the same avatar colour every time', () => {
    expect(avatarFill('uid-123')).toBe(avatarFill('uid-123'));
    expect(AvatarFills).toContain(avatarFill('Mette'));
  });
});

describe('design foundation: components', () => {
  it('draws every icon, decorative unless labelled', async () => {
    await render(
      <>
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} size={20} />
        ))}
        <Icon name="lock" accessibilityLabel="Private" />
      </>,
    );
    expect(screen.getAllByRole('image')).toHaveLength(1);
    expect(screen.getByRole('image', { name: 'Private' })).toBeOnTheScreen();
  });

  it('shows the logo and the welcome illustration', async () => {
    await render(
      <>
        <Logo />
        <HeroCircles />
      </>,
    );
    expect(screen.getByRole('image', { name: 'Grouper' })).toBeOnTheScreen();
    expect(screen.getByText('Grouper')).toBeOnTheScreen();
  });

  it('keeps Button, Toggle and Checkbox semantics', async () => {
    const onPress = jest.fn();
    const onToggle = jest.fn();
    const onCheck = jest.fn();
    await render(
      <>
        <Button label="Continue" onPress={onPress} variant="accent" icon="send" />
        <Button label="Agree" onPress={onPress} disabled testID="agree" />
        <Toggle label="10 km" value onChange={onToggle} />
        <Checkbox label="I'll meet in public places" checked={false} onChange={onCheck} variant="card" />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('agree')).toBeDisabled();
    expect(screen.getByRole('switch', { name: '10 km' })).toBeChecked();
    await fireEvent.press(screen.getByRole('switch', { name: '10 km' }));
    expect(onToggle).toHaveBeenCalledWith(false);
    await fireEvent.press(screen.getByRole('checkbox', { name: "I'll meet in public places" }));
    expect(onCheck).toHaveBeenCalledWith(true);
  });

  it('offers one choice of a few as switches', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented
        variant="track"
        value="en"
        onChange={onChange}
        options={[
          { value: 'da', label: 'Dansk' },
          { value: 'en', label: 'English' },
        ]}
      />,
    );
    expect(screen.getByRole('switch', { name: 'English' })).toBeChecked();
    await fireEvent.press(screen.getByRole('switch', { name: 'Dansk' }));
    expect(onChange).toHaveBeenCalledWith('da');
  });

  it('names a link row by its label, then its detail', async () => {
    const onPress = jest.fn();
    await render(
      <ListGroup title="What you've agreed to">
        <LinkRow label="Private interests" detail="1 interest, consent given" icon="lock" onPress={onPress} />
        <LinkRow label="Photo" onPress={onPress} />
      </ListGroup>,
    );
    await fireEvent.press(screen.getByRole('link', { name: /^Private interests/ }));
    expect(screen.getByRole('link', { name: 'Photo' })).toBeOnTheScreen();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws the in-page header with a labelled back button', async () => {
    const onBack = jest.fn();
    await render(
      <>
        <ScreenHeader title="Plan the meetup" subtitle="Voting closes Tuesday 18:00" subtitleIcon="clock" backLabel="Back" onBack={onBack} />
        <StepHeader step={2} total={6} stepLabel="Step 2 of 6" backLabel="Back to start" onBack={onBack} />
      </>,
    );
    expect(screen.getByRole('header', { name: 'Plan the meetup' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back to start' }));
    expect(onBack).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Step 2 of 6')).toBeOnTheScreen();
  });

  it('exposes the stat card progress to screen readers', async () => {
    await render(
      <StatCard
        label="Odense waitlist"
        value="137"
        suffix="of 250"
        progress={137 / 250}
        progressLabel="People on the Odense waitlist"
        progressValue={{ min: 0, max: 250, now: 137 }}
        progressTestID="progress"
      >
        When 250 people in Odense have joined, we open the city.
      </StatCard>,
    );
    expect(screen.getByRole('progressbar', { name: 'People on the Odense waitlist' })).toHaveAccessibilityValue({ min: 0, max: 250, now: 137 });
    expect(screen.getByText('137')).toBeOnTheScreen();
  });

  it('draws an initial, or the viewer label, on an avatar', async () => {
    await render(
      <>
        <Avatar name="mette" uid="u1" />
        <Avatar name="Mathias" you label="You" size={52} />
      </>,
    );
    // Decorative next to a visible name, as the storyboards' aria-hidden avatars.
    expect(screen.queryByText('M')).toBeNull();
    expect(screen.getByText('M', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('You', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

describe('design foundation: integration seams', () => {
  const light = Colors.light;

  it('leaves the bottom inset to the tab bar inside the tabs, and keeps it elsewhere', async () => {
    // The safe-area view gets its edges as { top: 'additive', bottom: 'off', … }.
    const edgesOf = (id: string): Record<string, string> => screen.getByTestId(id).props.edges as Record<string, string>;
    await render(
      <>
        <Screen testID="outside">
          <Text>Settings</Text>
        </Screen>
        <BottomTabBarHeightContext.Provider value={80}>
          <Screen testID="inside">
            <Text>This week</Text>
          </Screen>
        </BottomTabBarHeightContext.Provider>
      </>,
    );
    expect(edgesOf('outside')).toMatchObject({ top: 'additive', bottom: 'additive' });
    expect(edgesOf('inside')).toMatchObject({ top: 'additive', bottom: 'off' });
  });

  it("draws an unselected radio ring that keeps 3:1 against the card (WCAG 1.4.11)", async () => {
    await render(<ChoiceRow testID="reason" label="Spam" selected={false} onPress={() => undefined} />);
    type Node = { props: { style?: unknown }; children?: readonly (Node | string)[] };
    const styled = (n: Node): Node[] => [n, ...(n.children ?? []).flatMap((c) => (typeof c === 'string' ? [] : styled(c)))];
    const ring = styled(screen.getByTestId('reason') as unknown as Node).find((n) => {
      const st = StyleSheet.flatten(n.props.style as never) as { width?: number; borderRadius?: number } | undefined;
      return st?.width === 20 && st.borderRadius === 10;
    });
    expect(StyleSheet.flatten(ring?.props.style as never)).toMatchObject({ borderColor: light.muted });
    expect(contrast(light.muted, light.surface)).toBeGreaterThanOrEqual(3);
  });

  it("sizes the 'md' field's text to 15 pt (storyboard 1.7) and the default one to 17 pt", async () => {
    await render(
      <>
        <Field label="About me" size="md" testID="md" value="" onChangeText={() => undefined} />
        <Field label="First name" testID="lg" value="" onChangeText={() => undefined} />
      </>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('md').props.style)).toMatchObject({ fontSize: 15, paddingLeft: 14, paddingRight: 14 });
    expect(StyleSheet.flatten(screen.getByTestId('lg').props.style)).toMatchObject({ fontSize: 17, paddingLeft: 16, paddingRight: 16 });
  });
});
