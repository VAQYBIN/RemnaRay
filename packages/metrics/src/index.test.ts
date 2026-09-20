import { describe, expect, it } from 'vitest';

import {
  SECTION_9_9_METRICS,
  metricsContentType,
  metricsText,
  observeHttpRequest,
  recordTlsExpiry,
  tlsCertExpirySeconds,
} from './index.js';

describe('the section 9.9 metrics', () => {
  it('exports every name the specification lists', async () => {
    const text = await metricsText();

    // The acceptance of TASK-M5-008: all of 9.9 present in `/metrics`. A
    // metric with no observations still carries its HELP and TYPE lines, so a
    // dashboard finds the series whichever process answered the scrape.
    for (const name of SECTION_9_9_METRICS) expect(text).toContain(`# TYPE ${name} `);
  });

  it('is served as Prometheus text', () => {
    expect(metricsContentType).toMatch(/^text\/plain/u);
  });

  it('counts a request and its duration under one route label', async () => {
    observeHttpRequest('/api/v1/public/config', 200, 0.012);

    const text = await metricsText();
    expect(text).toContain('rr_http_requests_total{route="/api/v1/public/config",status="200"} 1');
    expect(text).toContain(
      'rr_http_request_duration_seconds_count{route="/api/v1/public/config",status="200"} 1',
    );
  });

  it('measures the certificate in seconds from now, and reads negative once expired', async () => {
    recordTlsExpiry(new Date(Date.now() + 86_400_000));
    expect((await tlsCertExpirySeconds.get()).values[0]?.value).toBeGreaterThan(86_000);

    recordTlsExpiry(new Date(Date.now() - 3_600_000));
    expect((await tlsCertExpirySeconds.get()).values[0]?.value).toBeLessThan(0);
  });

  it('ignores a reading that has no expiry, rather than recording a zero', async () => {
    recordTlsExpiry(new Date(Date.now() + 100_000));
    const before = (await tlsCertExpirySeconds.get()).values[0]?.value;

    recordTlsExpiry(null);
    recordTlsExpiry('not a date');

    expect((await tlsCertExpirySeconds.get()).values[0]?.value).toBe(before);
  });
});
