import { render, renderHook, screen, within } from '@testing-library/react-native';
import { StatusBar, StyleSheet, Text } from 'react-native';
import { useSystemBarStyle } from '@/components/navigation';
import { AvatarFillGreen, AvatarFills, avatarFill, StatusBarStyles } from '@/components/theme';
import { Avatar, AvatarStack, Loading, Screen } from '@/components/ui';

afterEach(() => jest.restoreAllMocks());

describe('status bar follows the scheme', () => {
  it('uses dark icons on the light ground and light icons on the dark one', () => {
    expect(StatusBarStyles).toEqual({ light: 'dark-content', dark: 'light-content' });
  });

  it('sets the app-wide default from the root', async () => {
    const setBarStyle = jest.spyOn(StatusBar, 'setBarStyle');
    await renderHook(() => useSystemBarStyle());
    expect(setBarStyle).toHaveBeenCalledWith('dark-content', true);
  });

  it('a Screen and a Loading placeholder hold the style while mounted and give it back on unmount', async () => {
    const push = jest.spyOn(StatusBar, 'pushStackEntry');
    const pop = jest.spyOn(StatusBar, 'popStackEntry');
    const view = await render(
      <Screen>
        <Text>Body</Text>
      </Screen>,
    );
    expect(push).toHaveBeenCalledWith({ barStyle: 'dark-content', animated: true });
    await view.unmount();
    expect(pop).toHaveBeenCalledTimes(1);

    push.mockClear();
    await render(<Loading label="Loading" />);
    expect(push).toHaveBeenCalledWith({ barStyle: 'dark-content', animated: true });
  });

  it('applies the entry again after the Android splash screen has gone', async () => {
    jest.useFakeTimers();
    try {
      const replace = jest.spyOn(StatusBar, 'replaceStackEntry');
      await render(
        <Screen>
          <Text>Body</Text>
        </Screen>,
      );
      expect(replace).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2000);
      expect(replace).toHaveBeenCalledWith(expect.anything(), { barStyle: 'dark-content', animated: true });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Avatar colour', () => {
  const bg = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID, { includeHiddenElements: true }).props.style).backgroundColor as string;

  it('takes the colour the caller passes (a member’s pod colour) and hashes one without it', async () => {
    const podColour = AvatarFills[2];
    const hashed = avatarFill('u-sofie');
    const other = AvatarFills.find((f) => f.bg !== hashed.bg) ?? AvatarFills[0];
    await render(
      <>
        <Avatar testID="given" name="Sofie" uid="u-sofie" fill={other} />
        <Avatar testID="hashed" name="Sofie" uid="u-sofie" />
        <Avatar testID="you" name="Anna" you label="You" fill={podColour} />
      </>,
    );
    expect(bg('given')).toBe(other.bg);
    expect(bg('hashed')).toBe(hashed.bg);
    // The viewer stays the ink "You" circle whatever fill is passed.
    expect(bg('you')).not.toBe(podColour.bg);
    const given = within(screen.getByTestId('given', { includeHiddenElements: true }));
    expect(given.getByText('S', { includeHiddenElements: true })).toHaveStyle({ color: other.fg });
  });

  it('passes each member’s colour through an AvatarStack', async () => {
    // The green fill is the only one with a white initial: pick whichever the hash would not give.
    const fill = avatarFill('u-emil').bg === AvatarFillGreen.bg ? AvatarFills[0] : AvatarFillGreen;
    await render(<AvatarStack members={[{ key: 'a', name: 'Emil', uid: 'u-emil', fill }]} />);
    expect(screen.getByText('E', { includeHiddenElements: true })).toHaveStyle({ color: fill.fg });
  });
});
