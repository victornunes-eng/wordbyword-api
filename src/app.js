import { generateWords, demoWords } from './words.js';

export function createHandler({ env = process.env, provider = generateWords, now = Date.now } = {}) {
  const origins = new Set((env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(value => value.trim()).filter(Boolean));
  const limits = new Map();
  let cached = null;
  let expiresAt = 0;
  let pending = null;
  const mode = env.WORD_PROVIDER || 'openai';
  return async function handler(req, res) {
    const origin = req.headers.origin;
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (origin && origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const send = (status, body, extra = {}) => { res.writeHead(status, { ...headers, ...extra }); res.end(body === null ? undefined : JSON.stringify(body)); };
    if (origin && !origins.has(origin)) return send(403, { error: 'Origem não permitida.' });
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'OPTIONS') return send(204, null, { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
    if (req.method !== 'GET') return send(405, { error: 'Método não permitido.' }, { Allow: 'GET, OPTIONS' });
    if (pathname === '/health') return send(200, { status: 'ok', provider: mode, configured: mode === 'demo' || Boolean(env.OPENAI_API_KEY) });
    if (pathname !== '/ask') return send(404, { error: 'Rota não encontrada.' });
    const timestamp = now();
    // Remove entradas vencidas e limita o tamanho para evitar crescimento ilimitado.
    for (const [key, value] of limits) if (value.reset <= timestamp) limits.delete(key);
    const forwarded = req.headers['x-forwarded-for'];
    const ip = env.TRUST_PROXY === '1' && typeof forwarded === 'string' ? forwarded.split(',').at(-1).trim() : req.socket.remoteAddress || 'unknown';
    if (!limits.has(ip) && limits.size >= 10000) return send(503, { error: 'Serviço ocupado. Tente novamente.' });
    const entry = limits.get(ip) || { count: 0, reset: timestamp + 60000 };
    entry.count++; limits.set(ip, entry);
    if (entry.count > 10) return send(429, { error: 'Limite de consultas atingido. Aguarde um minuto.' }, { 'Retry-After': String(Math.max(1, Math.ceil((entry.reset - timestamp) / 1000))) });
    if (mode === 'demo') return send(200, demoWords, { 'X-Word-Provider': 'demo' });
    if (mode !== 'openai' || !env.OPENAI_API_KEY) return send(503, { error: 'Serviço de palavras ainda não configurado.' });
    try {
      if (!cached || expiresAt <= timestamp) {
        // Compartilha a chamada em andamento para evitar cobranças duplicadas.
        if (!pending) pending = provider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || 'gpt-4o-mini' })
          .then(words => { cached = words; expiresAt = now() + 15000; return words; })
          .finally(() => { pending = null; });
        await pending;
      }
      return send(200, cached, { 'X-Word-Provider': 'openai' });
    } catch {
      return send(502, { error: 'Não foi possível consultar o serviço de palavras. Tente novamente.' });
    }
  };
}
