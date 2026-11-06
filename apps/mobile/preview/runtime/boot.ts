/**
 * Preview entry: metro.cjs resolves the first import of expo-router's entry (`@expo/metro-runtime`) to this file on
 * web, so the scenario is installed before the app's root layout and its Firebase setup evaluate. Then the real
 * runtime loads and expo-router starts as usual.
 */
import './install';
import '@expo/metro-runtime';
