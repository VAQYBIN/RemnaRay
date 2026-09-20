import { notFound } from 'next/navigation';

import { INTERNAL_API_URL } from '../../lib/api';
import SetupClient from './setup-client';

export const dynamic = 'force-dynamic';

/**
 * Section 17.4: once `setup.completed` is true the API answers the wizard with
 * `SETUP_ALREADY_COMPLETED` 404, and `/setup` must be a 404 as well.
 */
export default async function SetupPage() {
  let status: number;
  try {
    const response = await fetch(`${INTERNAL_API_URL}/api/setup/v1/state`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    status = response.status;
  } catch {
    status = 503;
  }
  if (status === 404) notFound();
  return <SetupClient />;
}
