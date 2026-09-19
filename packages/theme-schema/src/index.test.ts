import { describe, expect, it } from 'vitest';

import manta from '../../../themes/manta/theme.json' with { type: 'json' };

import { contrastRatio, contrastWarnings, cssVariables, themeSchema } from './index.js';

describe('theme schema', () => {
  it('accepts the complete manta theme and emits runtime variables', () => {
    const theme = themeSchema.parse(manta);
    const variables = cssVariables(theme);

    expect(theme.slug).toBe('manta');
    expect(variables['--color-primary']).toBe('#0EA5A4');
    expect(variables['--color-dark-background']).toBe('#0B1F3B');
  });

  it('calculates WCAG contrast and reports below-AA pairs as warnings', () => {
    expect(contrastRatio('#0B1F3B', '#E6F7F9')).toBeGreaterThan(4.5);
    const warnings = contrastWarnings(themeSchema.parse(manta));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.foreground).toBe('primary-foreground');
    expect(warnings[0]?.ratio).toBeGreaterThan(3);
  });

  it('rejects malformed theme colors and slugs', () => {
    expect(() => themeSchema.parse({ ...manta, slug: 'Manta Theme' })).toThrow();
    expect(() =>
      themeSchema.parse({ ...manta, colors: { ...manta.colors, primary: 'teal' } }),
    ).toThrow();
  });
});
