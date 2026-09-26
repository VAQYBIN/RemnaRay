import { z } from 'zod';

/**
 * One configuration field of a payment provider, derived from its
 * `configSchema` so the setup wizard and the console draw the same form for
 * each provider (FR-061) instead of a raw JSON box.
 */
export type ProviderField = {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'list';
  required: boolean;
  /** Masked when read back and kept when left empty on save. */
  secret: boolean;
  default?: unknown;
  format?: string;
};

const SECRET = /token|secret|password|key/i;

export function providerFields(schema: z.ZodType): ProviderField[] {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as {
    properties?: Record<string, { type?: string; default?: unknown; format?: string }>;
    required?: string[];
  };
  const required = new Set(json.required ?? []);
  return Object.entries(json.properties ?? {}).map(([key, property]) => ({
    key,
    type:
      property.type === 'array'
        ? 'list'
        : property.type === 'number' || property.type === 'integer'
          ? 'number'
          : property.type === 'boolean'
            ? 'boolean'
            : 'string',
    required: required.has(key),
    secret: SECRET.test(key),
    ...(property.default === undefined ? {} : { default: property.default }),
    ...(property.format ? { format: property.format } : {}),
  }));
}

/**
 * The configuration a console edit stores: the fields sent replace the stored
 * ones, and a secret sent empty keeps the stored value, so an administrator
 * never has to type every key again to change one field.
 */
export function mergeProviderConfig(
  stored: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...stored };
  for (const [key, value] of Object.entries(patch)) {
    if (SECRET.test(key) && (value === '' || value === null || value === undefined)) continue;
    merged[key] = value;
  }
  return merged;
}
