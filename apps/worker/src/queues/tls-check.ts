import { connect } from 'node:tls';

export type CertificateStatus = {
  host: string;
  reachable: boolean;
  expiresAt: string | null;
  daysLeft: number | null;
  error?: string;
};

/**
 * Section 19.2: `maintenance.tls-check` opens the connection from the worker,
 * so it sees exactly what a visitor's browser would be served. A certificate
 * that is already invalid still has to be readable — that is the case the
 * check exists for — so verification is deliberately not enforced here.
 */
export function certificateStatus(
  host: string,
  port = 443,
  timeoutMs = 10_000,
): Promise<CertificateStatus> {
  return new Promise((resolve) => {
    const finish = (status: Omit<CertificateStatus, 'host'>) => {
      socket.destroy();
      resolve({ host, ...status });
    };
    // RFC 6066 forbids an IP literal as the SNI name, and Node warns about it.
    const servername = /^[\d.]+$|:/u.test(host) ? undefined : host;
    const socket = connect(
      {
        host,
        port,
        rejectUnauthorized: false,
        timeout: timeoutMs,
        ...(servername ? { servername } : {}),
      },
      () => {
        const certificate = socket.getPeerCertificate();
        const validTo = certificate.valid_to ? Date.parse(certificate.valid_to) : Number.NaN;
        if (Number.isNaN(validTo)) {
          finish({ reachable: true, expiresAt: null, daysLeft: null, error: 'NO_CERTIFICATE' });
          return;
        }
        finish({
          reachable: true,
          expiresAt: new Date(validTo).toISOString(),
          daysLeft: Math.floor((validTo - Date.now()) / 86_400_000),
        });
      },
    );
    socket.on('timeout', () => {
      finish({ reachable: false, expiresAt: null, daysLeft: null, error: 'TIMEOUT' });
    });
    socket.on('error', (error: Error) => {
      finish({
        reachable: false,
        expiresAt: null,
        daysLeft: null,
        error: error.message.slice(0, 200),
      });
    });
  });
}

/** The section 19.2 threshold: an alert fourteen days before expiry. */
export const TLS_ALERT_DAYS = 14;
