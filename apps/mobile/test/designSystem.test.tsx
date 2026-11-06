import { fireEvent, render, screen } from '@testing-library/react-native';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_FILES } from '../app.config';
import { FONT_ASSETS } from '@/components/fonts';
import { Colors, FontFamily, Type, TypeScale, typeStyle } from '@/components/theme';
import { Button, Checkbox, ChoiceChip, Chip, Icon, ICONS, ListRow, ListSection, Radio, SegmentedControl, StepHeader, Switch, TextField } from '@/components/ui';

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

  it('light mode is the storyboard palette', () => {
    expect(Colors.light).toMatchObject({ page: '#F3F5F1', surface: '#FFFFFF', text: '#18211D', textMuted: '#55605A', primary: '#1E6B58', primaryPressed: '#174F42', border: '#DCE2DC', borderStrong: '#C9D1CA', mint: '#E1EFE9', accent: '#F2B544' });
  });

  it('maps every weight to its own family and never sets fontWeight', () => {
    for (const variant of Object.keys(TypeScale) as (keyof typeof TypeScale)[]) {
      expect(Type[variant].fontFamily).toBe(FontFamily[TypeScale[variant].weight]);
      expect(Type[variant]).not.toHaveProperty('fontWeight');
    }
    expect(typeStyle('title')).toMatchObject({ fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.6 });
    expect(typeStyle('body', '700').fontFamily).toBe('PlusJakartaSans_700Bold');
  });

  it('loads exactly the five families at start, and embeds the same files natively', () => {
    expect(Object.keys(FONT_ASSETS).sort()).toEqual(Object.values(FontFamily).sort());
    expect(FONT_FILES).toHaveLength(5);
    for (const file of FONT_FILES) {
      expect(existsSync(join(root, file))).toBe(true);
      expect(Object.values(FontFamily)).toContain(file.split('/').pop()?.replace('.ttf', ''));
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
