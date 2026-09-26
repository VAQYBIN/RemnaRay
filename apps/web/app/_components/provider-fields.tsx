'use client';

import { z } from 'zod';

import { Input, Label } from '@remnaray/ui';

/** `ProviderField` of the API: one field of a provider's `configSchema` (FR-061). */
export const providerFieldSchema = z.object({
  key: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'list']),
  required: z.boolean(),
  secret: z.boolean(),
  default: z.unknown().optional(),
  format: z.string().optional(),
});
export type ProviderField = z.infer<typeof providerFieldSchema>;
export type ProviderValues = Record<string, string | boolean>;

/**
 * What the form starts with: a stored or default value for ordinary fields, and
 * always an empty secret — a stored secret is never sent back to the browser in
 * full, and an empty one keeps it.
 */
export function initialValues(
  fields: ProviderField[],
  stored: Record<string, unknown> = {},
): ProviderValues {
  const values: ProviderValues = {};
  for (const field of fields) {
    const value = field.secret ? undefined : (stored[field.key] ?? field.default);
    values[field.key] =
      field.type === 'boolean'
        ? value === true
        : Array.isArray(value)
          ? value.map(String).join('\n')
          : typeof value === 'string' || typeof value === 'number'
            ? String(value)
            : '';
  }
  return values;
}

/** The configuration to send: typed values, and nothing for an empty field. */
export function toConfig(fields: ProviderField[], values: ProviderValues): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === 'boolean') {
      config[field.key] = value === true;
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) continue;
    config[field.key] =
      field.type === 'number'
        ? Number(text.replace(',', '.'))
        : field.type === 'list'
          ? text
              .split(/[\n,]/u)
              .map((item) => item.trim())
              .filter(Boolean)
          : text;
  }
  return config;
}

/** True when every required field has a value (a stored secret counts). */
export function complete(
  fields: ProviderField[],
  values: ProviderValues,
  storedSecrets: string[] = [],
): boolean {
  return fields.every(
    (field) =>
      !field.required ||
      field.type === 'boolean' ||
      (typeof values[field.key] === 'string' && (values[field.key] as string).trim() !== '') ||
      (field.secret && storedSecrets.includes(field.key)),
  );
}

/**
 * The form of one provider, drawn from its fields: text, number, flag, a list
 * one item per line, and secrets as password inputs that may stay empty to keep
 * the stored value.
 */
export function ProviderFields({
  idPrefix,
  fields,
  values,
  onChange,
  label,
  hint,
  keepSecretHint,
  storedSecrets = [],
}: {
  idPrefix: string;
  fields: ProviderField[];
  values: ProviderValues;
  onChange: (values: ProviderValues) => void;
  label: (key: string) => string;
  hint: (key: string) => string | undefined;
  keepSecretHint?: string;
  storedSecrets?: string[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        const value = values[field.key];
        const note =
          field.secret && storedSecrets.includes(field.key) ? keepSecretHint : hint(field.key);
        if (field.type === 'boolean')
          return (
            <label className="flex items-center gap-2 text-sm sm:col-span-2" key={field.key}>
              <input
                checked={value === true}
                id={id}
                type="checkbox"
                onChange={(event) => {
                  onChange({ ...values, [field.key]: event.target.checked });
                }}
              />
              {label(field.key)}
            </label>
          );
        return (
          <div
            className={`flex flex-col gap-1 ${field.type === 'list' ? 'sm:col-span-2' : ''}`}
            key={field.key}
          >
            <Label htmlFor={id}>
              {label(field.key)}
              {field.required ? ' *' : ''}
            </Label>
            {field.type === 'list' ? (
              <textarea
                className="min-h-20 rounded-md border border-border bg-background p-3 font-mono text-sm"
                id={id}
                value={typeof value === 'string' ? value : ''}
                onChange={(event) => {
                  onChange({ ...values, [field.key]: event.target.value });
                }}
              />
            ) : (
              <Input
                autoComplete={field.secret ? 'new-password' : 'off'}
                id={id}
                inputMode={field.type === 'number' ? 'decimal' : undefined}
                type={field.secret ? 'password' : field.format === 'uri' ? 'url' : 'text'}
                value={typeof value === 'string' ? value : ''}
                onChange={(event) => {
                  onChange({ ...values, [field.key]: event.target.value });
                }}
              />
            )}
            {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
