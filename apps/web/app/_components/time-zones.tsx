'use client';

import { useMemo } from 'react';

/**
 * The IANA time zones the browser knows, offered as suggestions for a time
 * zone field; the API checks the value against its own `Intl`.
 */
export function TimeZoneOptions({ id }: { id: string }) {
  const zones = useMemo(() => {
    try {
      return ['UTC', ...Intl.supportedValuesOf('timeZone').filter((zone) => zone !== 'UTC')];
    } catch {
      return ['UTC', 'Europe/Moscow'];
    }
  }, []);
  return (
    <datalist id={id}>
      {zones.map((zone) => (
        <option key={zone} value={zone} />
      ))}
    </datalist>
  );
}
