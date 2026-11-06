import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useContext } from 'react';

/**
 * True when the screen is drawn inside the tab navigator, so the bottom tab bar (with Me active) is on screen. The tab
 * view provides its bar height to every screen below it, nested stacks included; outside the tabs there is none.
 * Privacy (storyboard 5.3) drops its back chevron only then: without the tab bar the chevron is the way back.
 */
export function useInTabs(): boolean {
  return useContext(BottomTabBarHeightContext) !== undefined;
}
