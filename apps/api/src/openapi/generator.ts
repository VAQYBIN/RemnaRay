import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { format } from 'prettier';

declare const __dirname: string;

const here = __dirname;
const routesPath = resolve(here, '../../openapi.routes.json');
const outputPath = resolve(here, '../../openapi.json');

async function main() {
  const routes = JSON.parse(await readFile(routesPath, 'utf8')) as {
    info?: Record<string, unknown>;
    paths: Record<string, unknown>;
    tags?: unknown;
    servers?: unknown;
  };
  const { z } = await import('zod');
  extendZodWithOpenApi(z);
  const {
    cursorPage,
    errorEnvelopeSchema,
    invoiceSchema,
    moneySchema,
    planListSchema,
    planPublicSchema,
    subscriptionStateSchema,
    userMeSchema,
  } = await import('@remnaray/domain');
  const registry = new OpenAPIRegistry();

  registry.register('Money', moneySchema);
  registry.register('ErrorEnvelope', errorEnvelopeSchema);
  registry.register('PlanPublic', planPublicSchema);
  registry.register('PlanList', planListSchema);
  registry.register('UserMe', userMeSchema);
  registry.register('SubscriptionState', subscriptionStateSchema);
  registry.register('Invoice', invoiceSchema);
  registry.register('TransactionPage', cursorPage(invoiceSchema));

  const document = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'RemnaRay API',
      version: '0.1.0',
      ...(routes.info ?? {}),
    },
  });
  Object.assign(document, { paths: routes.paths });

  await writeFile(
    outputPath,
    await format(JSON.stringify(document), { parser: 'json', printWidth: 100 }),
  );
}

void main();
