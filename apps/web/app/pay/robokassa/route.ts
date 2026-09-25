import { routing } from '../../../i18n/routing';

/** An invoice id is a UUID; anything else never becomes part of the redirect. */
const INVOICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Section 11.3.4: Robokassa sends the payer back to the SuccessURL and the
 * FailURL of the store's technical settings, not to a page per invoice, and
 * appends `OutSum`, `InvId`, `SignatureValue`, `Culture` and the `Shp_*`
 * parameters (docs.robokassa.ru, "notifications and redirects"), by GET or
 * POST as configured. Both are set to `https://<domain>/pay/robokassa`, and
 * this turns them into `/<locale>/pay/<id>` from `Shp_inv`, the invoice id.
 * It is only a redirect, never a source of payment (11.3.4), so the
 * signature is not needed: the page reads the invoice's status from the API.
 */
function land(params: URLSearchParams): Response {
  const culture = params.get('Culture')?.toLowerCase();
  const locale = routing.locales.find((item) => item === culture) ?? routing.defaultLocale;
  const invoice = params.get('Shp_inv');
  // 303: a POST return is followed by a GET of the page. The Location is
  // relative, so the visitor stays on the origin they came through.
  return new Response(null, {
    status: 303,
    headers: {
      location:
        invoice && INVOICE_ID.test(invoice) ? `/${locale}/pay/${invoice}` : `/${locale}/account`,
    },
  });
}

export function GET(request: Request): Response {
  return land(new URL(request.url).searchParams);
}

export async function POST(request: Request): Promise<Response> {
  return land(new URLSearchParams(await request.text()));
}
