import { describe, expect, it } from 'vitest';

import { buttonVariants } from './button';
import { cn } from './lib/utils';

describe('ui class utilities', () => {
  it('provides stable accessible button variants', () => {
    const classes = buttonVariants({ variant: 'secondary', size: 'lg' });

    expect(classes).toContain('border-border');
    expect(classes).toContain('h-12');
    expect(classes).toContain('focus-visible:ring-2');
  });

  it('merges conflicting utility classes', () => {
    expect(cn('px-2', 'px-4', false)).toBe('px-4');
  });
});
