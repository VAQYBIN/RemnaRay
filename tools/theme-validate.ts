import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  bodyTextContrast,
  contrastFailures,
  contrastWarnings,
  themeSchema,
} from '../packages/theme-schema/src/index.js';

const themeDirectory = resolve(process.argv[2] ?? 'themes/manta');
const themePath = resolve(themeDirectory, 'theme.json');

if (!existsSync(themePath)) {
  console.error(`Theme manifest not found: ${themePath}`);
  process.exitCode = 1;
} else {
  try {
    const theme = themeSchema.parse(JSON.parse(readFileSync(themePath, 'utf8')));
    const files = [
      theme.assets.logo,
      theme.assets.logoDark,
      theme.assets.mark,
      theme.assets.mascot.default,
      theme.assets.mascot.empty,
      theme.assets.mascot.error,
      theme.assets.mascot.success,
      theme.assets.og,
      theme.assets.favicon,
      theme.assets.appleTouchIcon,
      theme.assets.botAvatar,
    ];
    const missing = files.filter((file) => !existsSync(resolve(themeDirectory, file)));
    if (missing.length > 0) {
      throw new Error(`Missing theme assets: ${missing.join(', ')}`);
    }

    const failures = contrastFailures(theme);
    if (failures.length > 0) {
      throw new Error(
        `Body text contrast below AA: ${failures
          .map((failure) => `${failure.pair} is ${failure.ratio.toFixed(2)}:1`)
          .join(', ')}`,
      );
    }

    const ratios = bodyTextContrast(theme);
    const warnings = contrastWarnings(theme);
    console.log(
      `Body text contrast: light ${ratios.light.toFixed(2)}:1, dark ${ratios.dark.toFixed(2)}:1 (AA 4.5:1).`,
    );
    console.log(
      `Validated theme ${theme.slug} (${String(readdirSync(themeDirectory).length)} top-level entries).`,
    );
    for (const warning of warnings) {
      console.warn(
        `Contrast warning: ${warning.foreground} on ${warning.background} is ${warning.ratio.toFixed(2)}:1 (AA requires 4.5:1).`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
