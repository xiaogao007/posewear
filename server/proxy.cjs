const http = require('node:http');
const dns = require('node:dns');
const { BlockList, isIP } = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { AsyncLocalStorage } = require('node:async_hooks');
const { Agent, fetch: upstreamFetch } = require('undici');

const privateV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
]) privateV4.addSubnet(address, prefix, 'ipv4');
const publicV6 = new BlockList();
publicV6.addSubnet('2000::', 3, 'ipv6');
const reservedV6 = new BlockList();
reservedV6.addSubnet('2001:db8::', 32, 'ipv6');
reservedV6.addSubnet('2002::', 16, 'ipv6');

function isPublicAddress(address) {
  const family = isIP(address);
  return family === 4 ? !privateV4.check(address, 'ipv4') :
    family === 6 && publicV6.check(address, 'ipv6') && !reservedV6.check(address, 'ipv6');
}

// Pin each outgoing connection to DNS answers that were checked before connecting.
function publicLookup(hostname, options, callback) {
  const settings = typeof options === 'number' ? { family: options } : options || {};
  dns.lookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) {
      return callback(new Error('Private or reserved destination is not allowed'));
    }
    const candidates = settings.family ? addresses.filter(item => item.family === settings.family) : addresses;
    if (!candidates.length) return callback(new Error('No public address for the requested family'));
    if (settings.all) return callback(null, candidates);
    callback(null, candidates[0].address, candidates[0].family);
  });
}

const dispatcher = new Agent({
  connect: { lookup: publicLookup, timeout: 15000 },
  autoSelectFamily: true,
  autoSelectFamilyAttemptTimeout: 250,
  connections: 8,
  headersTimeout: 190000,
  bodyTimeout: 190000,
  maxResponseSize: 128 * 1024 * 1024,
});
const requestScope = new AsyncLocalStorage();
async function publicFetch(input, init = {}) {
  const target = new URL(input);
  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  if (target.protocol !== 'https:' || target.username || target.password ||
      (target.port && target.port !== '443') || (isIP(hostname) && !isPublicAddress(hostname))) {
    throw new Error('Only public HTTPS destinations are allowed');
  }
  const signals = [AbortSignal.timeout(190000), init.signal, requestScope.getStore()?.signal].filter(Boolean);
  return upstreamFetch(target, {
    ...init,
    dispatcher,
    redirect: 'manual',
    ...(init.body ? { duplex: 'half' } : {}),
    signal: AbortSignal.any(signals),
  });
}

async function startServer() {
  globalThis.fetch = publicFetch;
  const source = fs.readFileSync(path.join(__dirname, '../functions/api/proxy.js'));
  const { onRequest } = await import('data:text/javascript;base64,' + source.toString('base64'));
  const maxBody = 64 * 1024 * 1024;
  const server = http.createServer({ requestTimeout: 210000, headersTimeout: 20000 }, async (incoming, outgoing) => {
    if (incoming.url === '/healthz') {
      outgoing.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return outgoing.end('{"status":"ok","service":"posewear-proxy"}');
    }
    const controller = new AbortController();
    incoming.on('aborted', () => controller.abort());
    outgoing.on('close', () => { if (!outgoing.writableFinished) controller.abort(); });
    try {
      const url = new URL(incoming.url, 'http://' + (incoming.headers.host || 'localhost'));
      if (url.pathname !== '/api/proxy') {
        outgoing.writeHead(404);
        return outgoing.end('Not found');
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > maxBody) throw Object.assign(new Error('Request body too large'), { status: 413 });
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      for (const key of ['connection', 'keep-alive', 'proxy-authorization', 'proxy-authenticate', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'expect']) headers.delete(key);
      // Only Caddy on loopback may supply the visitor address; overwrite any client CF header.
      headers.set('cf-connecting-ip', incoming.headers['x-real-ip'] || incoming.socket.remoteAddress || 'unknown');
      const method = incoming.method || 'GET';
      const request = new Request(url, {
        method,
        headers,
        signal: controller.signal,
        ...(['GET', 'HEAD'].includes(method) ? {} : { body: Buffer.concat(chunks) }),
      });
      const response = await requestScope.run({ signal: controller.signal }, () => onRequest({
        request,
        waitUntil: promise => promise.catch(() => {}),
      }));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing);
      else outgoing.end();
    } catch (error) {
      if (outgoing.headersSent) outgoing.destroy();
      else {
        outgoing.writeHead(error.status || 502, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        outgoing.end(JSON.stringify({ error: { message: error.status === 413 ? 'Request body too large' : 'Proxy request failed' } }));
      }
    }
  });
  const port = Number(process.env.PORT || 8790);
  server.listen(port, '127.0.0.1', () => console.log(`PoseWear proxy listening on 127.0.0.1:${port}`));
  const shutdown = () => {
    server.close(() => dispatcher.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}

module.exports = { isPublicAddress, publicLookup, startServer };
if (require.main === module) startServer().catch(() => { console.error('PoseWear proxy could not start'); process.exit(1); });
