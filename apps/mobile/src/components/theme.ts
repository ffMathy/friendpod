import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    surface: '#F0F0F3',
    border: '#D9D9E0',
    primary: '#208AEF',
    onPrimary: '#FFFFFF',
    danger: '#C62828',
    disabled: '#B0B4BA',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#B0B4BA',
    background: '#000000',
    surface: '#212225',
    border: '#3A3D42',
    primary: '#4BA3F5',
    onPrimary: '#000000',
    danger: '#EF6C6C',
    disabled: '#5A5E66',
  },
} as const;

export type Palette = { readonly [K in keyof typeof Colors.light]: string };

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export function usePalette(): Palette {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
