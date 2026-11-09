import { fireEvent, render, screen } from '@testing-library/react-native';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_FILES } from '../app.config';
import { FONT_ASSETS } from '@/components/fonts';
import { Colors, DisplayFontFamily, displayTextWidth, fitDisplay, FontFamily, POD_PALETTE, podColors, Type, TypeScale, typeStyle } from '@/components/theme';
import {
  AddField,
  Avatar,
  Badge,
  Button,
  Checkbox,
  ChipButton,
  ChoiceChip,
  Chip,
  HeroCard,
  Icon,
  ICONS,
  ListRow,
  ListSection,
  Logo,
  Note,
  OptionCard,
  PodBand,
  PodMark,
  PosterField,
  Radio,
  SeatRow,
  SegmentedControl,
  StatusText,
  StepHeader,
  Switch,
  TextField,
} from '@/components/ui';

const root = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('design tokens', () => {
  it('light and dark palettes define the same colours', () => {
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });

  it('light mode is the blend palette (spec §2.1)', () => {
    expect(Colors.light).toMatchObject({
      page: '#F6F3EC',
      surface: '#FFFFFF',
      text: '#18211D',
      textSecondary: '#3A423D',
      textMuted: '#4A514C',
      primary: '#1B6452',
      primaryPressed: '#174F42',
      link: '#174F42',
      border: '#E4DFD4',
      separator: '#EEEAE2',
      borderStrong: '#C9C3B6',
      field: '#8A857A',
      track: '#DDD8CD',
      needsYou: '#FFD84D',
      danger: '#C41E3A',
      privateBorder: '#18211D',
    });
  });

  it('dark mode is the blend night palette (spec §12.1)', () => {
    expect(Colors.dark).toMatchObject({ page: '#131916', surface: '#1D2521', text: '#F2EFE8', primary: '#7FCDB0', onPrimary: '#18211D', danger: '#F69B96', house: '#1B6452' });
  });

  it('six pod colours with refined deep tones; dark mode goes deep with white type and a tint ring', () => {
    expect(Object.keys(POD_PALETTE)).toEqual(['solsikke', 'blad', 'baer', 'tomat', 'fjord', 'blomme']);
    expect(Object.values(POD_PALETTE).map((c) => c.deep)).toEqual(['#6A4900', '#395500', '#90124D', '#8C2107', '#124593', '#4F2272']);
    expect(podColors('tomat', 'light')).toMatchObject({ field: '#F26A4B', surface: '#FDE2D9', surfaceBorder: 'rgba(242, 106, 75, 0.4)', name: '#8C2107', avatar: '#8C2107' });
    expect(podColors('tomat', 'dark')).toMatchObject({ field: '#8C2107', onField: '#FFFFFF', surface: '#8C2107', name: '#FDE2D9', dotRing: '#FDE2D9' });
    // Private stays quiet: no pod colour anywhere.
    expect(podColors(null, 'light')).toMatchObject({ color: null, surface: '#FFFFFF', surfaceBorder: '#18211D', name: '#18211D', avatar: '#3A423D' });
  });

  it('maps every weight to its own family (Bricolage for display roles) and never sets fontWeight', () => {
    for (const variant of Object.keys(TypeScale) as (keyof typeof TypeScale)[]) {
      const spec: { weight: keyof typeof FontFamily; display?: boolean } = TypeScale[variant];
      const family = spec.display ? DisplayFontFamily[spec.weight as '700' | '800'] : FontFamily[spec.weight];
      expect(Type[variant].fontFamily).toBe(family);
      expect(Type[variant]).not.toHaveProperty('fontWeight');
    }
    expect(typeStyle('title')).toMatchObject({ fontSize: 30, lineHeight: 32, fontFamily: 'BricolageGrotesque_800ExtraBold', letterSpacing: -0.6 });
    expect(typeStyle('displayXL')).toMatchObject({ fontSize: 56, lineHeight: 58, letterSpacing: -1.96 });
    expect(typeStyle('headline')).toMatchObject({ fontSize: 22, lineHeight: 26, fontFamily: 'BricolageGrotesque_700Bold' });
    expect(typeStyle('body')).toMatchObject({ fontSize: 16, lineHeight: 24, fontFamily: 'PlusJakartaSans_400Regular' });
    expect(typeStyle('body', '700').fontFamily).toBe('PlusJakartaSans_700Bold');
  });

  it('display fit rule: steps 56 → 52 → 48 → 40 by the longest word and two lines at most', () => {
    // The spec's measurement with the app's opsz-14 cut: "Thursday brætspil" at 52 px is 444 px.
    expect(Math.round(displayTextWidth('Thursday brætspil', 52))).toBe(444);
    expect(fitDisplay('brætspil', 342)).toBe('displayXL');
    expect(fitDisplay('far på barsel', 342)).toBe('displayXL');
    // drop-home: "Thursday" beside the 128 px poster mark.
    expect(fitDisplay('Thursday 18:00', 214)).toBe('displayXL48');
    expect(fitDisplay('Fællesspisningsaften', 342)).toBe('displayXL40');
  });

  it('loads exactly the seven families at start (Jakarta 400–800, Bricolage 700/800), and embeds the same files natively', () => {
    const families = [...Object.values(FontFamily), ...Object.values(DisplayFontFamily)];
    expect(Object.keys(FONT_ASSETS).sort()).toEqual(families.sort());
    expect(FONT_FILES).toHaveLength(7);
    for (const file of FONT_FILES) {
      expect(existsSync(join(root, file))).toBe(true);
      expect(families).toContain(file.split('/').pop()?.replace('.ttf', ''));
    }
  });

  it('no screen sets fontWeight (a custom font needs the family for its weight: use Text/typeStyle/font)', () => {
    const files = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'src'))];
    const offenders = files.filter((f) => /\bfontWeight\s*:/.test(readFileSync(f, 'utf8').replace(/fontWeight: 'normal'/g, '')));
    expect(offenders.map((f) => f.slice(root.length + 1))).toEqual([]);
  });
});

describe('primitives', () => {
  it('Button: role, label, disabled and busy states', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    await render(<Button label="Agree and continue" disabled onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Agree and continue' })).toBeDisabled();
  });

  it('Checkbox, Switch, Radio and ChoiceChip report their state', async () => {
    const onChange = jest.fn();
    await render(
      <>
        <Checkbox label="I consent" checked={false} onChange={onChange} testID="cb" />
        <Switch label="Same-gender pods only" value onChange={onChange} />
        <Radio label="I felt unsafe" selected onPress={onChange} />
        <ChoiceChip label="10 km" selected={false} onPress={onChange} />
      </>,
    );
    expect(screen.getByTestId('cb')).not.toBeChecked();
    await fireEvent.press(screen.getByTestId('cb'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch', { name: 'Same-gender pods only' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'I felt unsafe' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '10 km' })).not.toBeChecked();
  });

  it('StepHeader says the step and goes back', async () => {
    const onBack = jest.fn();
    await render(<StepHeader step={2} total={6} onBack={onBack} />);
    expect(screen.getByText('Step 2 of 6')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('TextField: label, optional suffix, counter, helper and error', async () => {
    await render(<TextField label="About me" optional showCount maxLength={140} value="Hello" helper="Shown to confirmed pod members." error="Too long" />);
    expect(screen.getByLabelText('About me')).toBeOnTheScreen();
    expect(screen.getByText('(optional)', { exact: false })).toBeOnTheScreen();
    expect(screen.getByText('5 / 140')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent('Too long');
  });

  it('Chip: the lock is announced and the remove cross has its own label', async () => {
    const onRemove = jest.fn();
    await render(<Chip label="gravid" private privateLabel="Private" onRemove={onRemove} removeLabel="Remove gravid" />);
    expect(screen.getByLabelText('Private')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove gravid' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('SegmentedControl and ListSection rows', async () => {
    const onChange = jest.fn();
    const onPress = jest.fn();
    await render(
      <>
        <SegmentedControl accessibilityLabel="Language" value="en" onChange={onChange} options={[{ value: 'da', label: 'Dansk' }, { value: 'en', label: 'English' }]} />
        <ListSection title="What you've agreed to">
          <ListRow label="Private interests" detail="1 interest, consent given" onPress={onPress} />
        </ListSection>
      </>,
    );
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Dansk' }));
    expect(onChange).toHaveBeenCalledWith('da');
    await fireEvent.press(screen.getByRole('link', { name: /Private interests/ }));
    expect(onPress).toHaveBeenCalled();
  });

  it('Button: the danger variant is an outline with a decorative trash icon and the word as its label', async () => {
    const onPress = jest.fn();
    await render(<Button variant="danger" size="sm" label="Remove & withdraw" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove & withdraw' }));
    expect(onPress).toHaveBeenCalled();
    await render(<Button variant="link" label="Why this pod?" onPress={onPress} />);
    expect(screen.getByRole('link', { name: 'Why this pod?' })).toBeOnTheScreen();
  });

  it('AddField: one labelled input and a separate Add button', async () => {
    const onAdd = jest.fn();
    await render(<AddField label="Add an interest" placeholder="In your own words" value="løb" addLabel="Add" onAdd={onAdd} />);
    expect(screen.getByLabelText('Add an interest')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('Chip kinds: pod, private (lock announced), unsettled, clash; star and remove are labelled', async () => {
    const onRemove = jest.fn();
    await render(
      <>
        <Chip label="brætspil" color="tomat" starred starredLabel="Main interest" onRemove={onRemove} removeLabel="Remove brætspil" />
        <Chip label="gravid" kind="private" privateLabel="Private" />
        <Chip label="brætspilsaften" kind="unsettled" />
        <Chip label="climbing" kind="clash" />
        <ChipButton label="+ løb" accessibilityLabel="Add løb" onPress={jest.fn()} />
      </>,
    );
    expect(screen.getByLabelText('Main interest')).toBeOnTheScreen();
    expect(screen.getByLabelText('Private')).toBeOnTheScreen();
    expect(screen.getByText('løb')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove brætspil' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('Badges, quiet status and notes render their words', async () => {
    await render(
      <>
        <Badge tone="needsYou" label="Answer by Sat 18:00" />
        <Badge tone="unread" label="3 new" />
        <StatusText icon="clock" label="Hasn't confirmed" />
        <Note tone="needsYou" alert>
          Did you mean brætspil?
        </Note>
        <Note tone="safety">In danger right now? Call 112.</Note>
      </>,
    );
    expect(screen.getByText('Answer by Sat 18:00')).toBeOnTheScreen();
    expect(screen.getByText('3 new')).toBeOnTheScreen();
    expect(screen.getByText("Hasn't confirmed")).toBeOnTheScreen();
    expect(screen.getByText('Did you mean brætspil?')).toBeOnTheScreen();
    expect(screen.getByText('In danger right now? Call 112.')).toBeOnTheScreen();
  });

  it('pod pieces: band header, hero card, seats (hidden), poster field, marks, avatars, option card', async () => {
    const onBack = jest.fn();
    const onPick = jest.fn();
    await render(
      <>
        <PodBand title="brætspil" subtitle="5 people near Aarhus C" color="tomat" onBack={onBack} />
        <PodBand title="gravid" color={null} />
        <HeroCard color="tomat" name="brætspil" eyebrow="A pod around" pillRight={<Badge tone="needsYou" label="Answer by Sat 18:00" />}>
          <SeatRow total={5} lit={2} color="tomat" youLabel="You" needed={4} neededLabel="4 needed" testID="seats" />
        </HeroCard>
        <PosterField>
          <PodMark variant="poster" ground="skov" size={128} />
        </PosterField>
        <PodMark variant="badge" color="private" />
        <PodMark size={20} />
        <Logo />
        <Avatar name="Mette" color="tomat" />
        <Avatar name="Sofie" color="tomat" pending />
        <Avatar you youLabel="You" size={44} />
        <OptionCard selected onPress={onPick} accessibilityLabel="[Board game café]">
          <StatusText label="Selected" />
        </OptionCard>
      </>,
    );
    // The band's Title and the hero card's Display L name are both headers.
    expect(screen.getAllByRole('header', { name: 'brætspil' })).toHaveLength(2);
    expect(screen.getByLabelText('Private')).toBeOnTheScreen();
    expect(screen.queryByText('4 needed')).toBeNull();
    expect(screen.getByText('4 needed', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Friendpod' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: '[Board game café]' })).toBeChecked();
  });

  it('renders every icon; icons are hidden unless labelled', async () => {
    await render(
      <>
        {(Object.keys(ICONS) as (keyof typeof ICONS)[]).map((name) => (
          <Icon key={name} name={name} testID={`icon-${name}`} />
        ))}
        <Icon name="lock" accessibilityLabel="Private" />
      </>,
    );
    for (const name of Object.keys(ICONS)) expect(screen.getByTestId(`icon-${name}`, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('icon-lock')).toBeNull();
    expect(screen.getByLabelText('Private')).toBeOnTheScreen();
  });
});
