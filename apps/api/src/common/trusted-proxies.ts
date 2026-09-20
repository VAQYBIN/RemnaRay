/**
 * Section 21.7: `X-Forwarded-*` is only believed when the immediate peer is in
 * `RR_TRUSTED_PROXIES`. Fastify takes a comma-separated list of IPs and CIDRs
 * and refuses the headers from anyone else, so a client talking to the origin
 * directly cannot claim another address.
 */
export function trustedProxies(value = process.env.RR_TRUSTED_PROXIES): string | false {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  // `false` is Fastify's "trust nobody", which is the safe answer when the
  // deployment has not said which proxy sits in front of it.
  return entries.length > 0 ? entries.join(',') : false;
}
