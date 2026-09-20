import { describe, expect, it } from 'vitest';

import { CONFIG_REVALIDATE_SECONDS } from '../lib/public-config';
import { I18N_REVALIDATE_SECONDS } from '../i18n/messages';
import { THEME_REVALIDATE_SECONDS } from '../lib/theme';

describe('AC-181: an override reaches the site within five seconds', () => {
  it('revalidates config, catalogs and theme inside the window', () => {
    expect(CONFIG_REVALIDATE_SECONDS).toBeLessThanOrEqual(5);
    expect(I18N_REVALIDATE_SECONDS).toBeLessThanOrEqual(5);
    expect(THEME_REVALIDATE_SECONDS).toBeLessThanOrEqual(5);
  });
});
