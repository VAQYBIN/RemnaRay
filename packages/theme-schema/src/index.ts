import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Expected a six-digit hex color.');
const localeText = z.object({ ru: z.string().min(1), en: z.string().min(1) });

export const themeColorsSchema = z.object({
  primary: hexColor,
  'primary-foreground': hexColor,
  secondary: hexColor,
  accent: hexColor,
  'accent-foreground': hexColor,
  background: hexColor,
  foreground: hexColor,
  surface: hexColor,
  muted: hexColor,
  'muted-foreground': hexColor,
  border: hexColor,
  ring: hexColor,
  success: hexColor,
  warning: hexColor,
  danger: hexColor,
  dark: z.object({
    background: hexColor,
    foreground: hexColor,
    surface: hexColor,
    muted: hexColor,
    'muted-foreground': hexColor,
    border: hexColor,
  }),
});

export const themeSchema = z.object({
  $schema: z.url(),
  slug: z.string().regex(/^(?:_admin|[a-z0-9]+(?:-[a-z0-9]+)*)$/),
  name: z.string().min(1),
  version: z.literal(1),
  brand: z.object({
    name: z.string().min(1),
    tagline: localeText,
  }),
  colors: themeColorsSchema,
  typography: z.object({
    sans: z.string().min(1),
    mono: z.string().min(1),
    fonts: z.array(
      z.object({
        family: z.string().min(1),
        src: z.string().min(1),
        weight: z.union([z.number().int().min(100).max(900), z.string().min(1)]),
        style: z.enum(['normal', 'italic']).default('normal'),
      }),
    ),
  }),
  radius: z.object({ sm: z.string().min(1), md: z.string().min(1), lg: z.string().min(1) }),
  assets: z.object({
    logo: z.string().min(1),
    logoDark: z.string().min(1),
    mark: z.string().min(1),
    mascot: z.object({
      default: z.string().min(1),
      empty: z.string().min(1),
      error: z.string().min(1),
      success: z.string().min(1),
    }),
    og: z.string().min(1),
    favicon: z.string().min(1),
    appleTouchIcon: z.string().min(1),
    botAvatar: z.string().min(1),
  }),
  landing: z.object({
    heroStyle: z.enum(['wave']),
    showMascot: z.boolean(),
  }),
});

export const themeTokensSchema = z.object({
  slug: z.string(),
  name: z.string(),
  version: z.literal(1),
  brand: z.object({ name: z.string().min(1), tagline: localeText }),
  colors: themeColorsSchema,
  typography: themeSchema.shape.typography,
  radius: themeSchema.shape.radius,
  landing: themeSchema.shape.landing,
  assets: z.record(z.string(), z.string()),
  etag: z.string(),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type ThemeColors = z.infer<typeof themeColorsSchema>;

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const value = hexColor.parse(hex).slice(1);
  return (
    0.2126 * channel(Number.parseInt(value.slice(0, 2), 16)) +
    0.7152 * channel(Number.parseInt(value.slice(2, 4), 16)) +
    0.0722 * channel(Number.parseInt(value.slice(4, 6), 16))
  );
}

export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastWarning = { foreground: string; background: string; ratio: number };

export function contrastWarnings(theme: Theme): ContrastWarning[] {
  const checks = [
    ['foreground', 'background'],
    ['primary-foreground', 'primary'],
    ['accent-foreground', 'accent'],
    ['muted-foreground', 'muted'],
  ] as const;

  return checks.flatMap(([foreground, background]) => {
    const ratio = contrastRatio(theme.colors[foreground], theme.colors[background]);
    return ratio < 4.5 ? [{ foreground, background, ratio }] : [];
  });
}

export type ContrastFailure = { pair: string; ratio: number };

/**
 * Section 13.5 requires AA body-text contrast in both colour schemes:
 * `foreground` on `background` (sea foam) and dark `foreground` on dark
 * `background` (deep ocean). These pairs are hard failures, unlike the
 * section 18.3 warnings.
 */
export function bodyTextContrast(theme: Theme): { light: number; dark: number } {
  return {
    light: contrastRatio(theme.colors.foreground, theme.colors.background),
    dark: contrastRatio(theme.colors.dark.foreground, theme.colors.dark.background),
  };
}

export function contrastFailures(theme: Theme): ContrastFailure[] {
  const ratios = bodyTextContrast(theme);
  return [
    { pair: 'foreground on background', ratio: ratios.light },
    { pair: 'dark.foreground on dark.background', ratio: ratios.dark },
  ].filter((entry) => entry.ratio < 4.5);
}

export function cssVariables(theme: Pick<Theme, 'colors' | 'radius'>): Record<string, string> {
  const variables: Record<string, string> = {
    '--color-primary': theme.colors.primary,
    '--color-primary-foreground': theme.colors['primary-foreground'],
    '--color-secondary': theme.colors.secondary,
    '--color-accent': theme.colors.accent,
    '--color-accent-foreground': theme.colors['accent-foreground'],
    '--color-background': theme.colors.background,
    '--color-foreground': theme.colors.foreground,
    '--color-surface': theme.colors.surface,
    '--color-muted': theme.colors.muted,
    '--color-muted-foreground': theme.colors['muted-foreground'],
    '--color-border': theme.colors.border,
    '--color-ring': theme.colors.ring,
    '--color-success': theme.colors.success,
    '--color-warning': theme.colors.warning,
    '--color-danger': theme.colors.danger,
    '--radius-sm': theme.radius.sm,
    '--radius-md': theme.radius.md,
    '--radius-lg': theme.radius.lg,
  };

  for (const [key, value] of Object.entries(theme.colors.dark)) {
    variables[`--color-dark-${key}`] = value;
  }

  return variables;
}
