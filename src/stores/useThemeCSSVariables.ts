import { useEffect } from 'react';
import { useThemeStore } from './themeStore';
import type { Theme } from '../types';

/**
 * Converts a theme to CSS variable declarations
 */
function themeToCSSVariables(theme: Theme): string {
  const cssVars = [
    `--theme-background: ${theme.background}`,
    `--theme-text-color: ${theme.textColor}`,
    `--theme-accent-color: ${theme.accentColor}`,
    `--theme-highlight-color: ${theme.highlightColor}`,
    `--theme-card-thanks: ${theme.cardColors.thanks}`,
    `--theme-card-rebuttal: ${theme.cardColors.rebuttal}`,
    `--theme-card-interaction: ${theme.cardColors.interaction}`,
    `--theme-card-ad: ${theme.cardColors.ad}`,
    `--theme-card-praise: ${theme.cardColors.praise}`,
    `--theme-card-opening: ${theme.cardColors.opening}`,
    `--theme-card-closing: ${theme.cardColors.closing}`,
    `--theme-card-lottery: ${theme.cardColors.lottery}`,
    `--theme-card-crisis: ${theme.cardColors.crisis}`,
    `--theme-is-dark: ${theme.isDark ? '1' : '0'}`,
  ];
  return cssVars.join('; ');
}

/**
 * Hook that applies the active theme's CSS variables to the document root
 */
export function useThemeCSSVariables() {
  const activeTheme = useThemeStore((state) => state.getActiveTheme());

  useEffect(() => {
    if (!activeTheme) return;

    const root = document.documentElement;
    root.style.cssText = themeToCSSVariables(activeTheme);

    // Also set data attribute for theme-specific CSS selectors
    root.setAttribute('data-theme', activeTheme.id);

    return () => {
      root.removeAttribute('data-theme');
    };
  }, [activeTheme]);
}
