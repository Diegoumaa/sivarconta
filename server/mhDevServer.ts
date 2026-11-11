// Local verification only. No environment values, headers, bodies, JWTs or JWS are logged.
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import endpoint from '../api/mh-test-emission.js';

const api = createHttpServer(async (incoming, outgoing) => {
  try {
    if (incoming.url !== '/api/mh-test-emission') { outgoing.writeHead(404); outgoing.end(); return; }
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 2000) { outgoing.writeHead(413); outgoing.end(); return; }
      chunks.push(Buffer.from(chunk));
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
    const response = await endpoint.fetch(new Request('http://127.0.0.1:3001/api/mh-test-emission', {
      method: incoming.method || 'GET', headers,
      body: incoming.method === 'GET' || incoming.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    }));
    outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(503); outgoing.end('{"error":"No se pudo confirmar el estado. Consulta este mismo documento."}'); }
});
api.listen(3001, '127.0.0.1');
const vite = await createViteServer({ server: { host: '127.0.0.1', port: 3000, strictPort: true }, logLevel: 'warn' });
await vite.listen();
console.log('SIVAR FACT local: http://127.0.0.1:3000 · MH 00 · claves solo en este proceso.');
const close = async () => { await vite.close(); api.close(); process.exit(); };
process.on('SIGINT', close); process.on('SIGTERM', close);
