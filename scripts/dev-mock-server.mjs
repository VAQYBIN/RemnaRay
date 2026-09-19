import { env as processEnv } from 'node:process';

import { createServer } from 'node:http';

const name = processEnv.MOCK_NAME ?? 'mock';
const port = Number(processEnv.MOCK_PORT ?? 8080);

createServer((request, response) => {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  if (request.url === '/health') {
    response.writeHead(200);
    response.end(JSON.stringify({ status: 'ok', service: name }));
    return;
  }
  response.writeHead(200);
  response.end(JSON.stringify({ mock: name, method: request.method, path: request.url }));
}).listen(port, '0.0.0.0');
