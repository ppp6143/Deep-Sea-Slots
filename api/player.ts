import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

type PlayerState = {
  version: number;
  coins: number;
  bonusEntries: number;
  updatedAt: number;
};

const COOKIE_KEY = 'dss_state';
const STATE_VERSION = 3;
const DEFAULT_STATE: PlayerState = { version: STATE_VERSION, coins: 100, bonusEntries: 0, updatedAt: Date.now() };
const MAX_COINS = 9_999_999;
const MAX_DELTA_PER_WRITE = 5_000;
const SECRET = process.env.DSS_STATE_SECRET || 'deepseaslots-dev-secret';

function sign(raw: string): string {
  return crypto.createHmac('sha256', SECRET).update(raw).digest('base64url');
}

function encodeState(state: PlayerState): string {
  const raw = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  return `${raw}.${sign(raw)}`;
}

function decodeState(token: string | undefined): PlayerState | null {
  if (!token) return null;
  const [raw, sig] = token.split('.');
  if (!raw || !sig) return null;
  if (sign(raw) !== sig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<PlayerState>;
    if (!Number.isFinite(parsed.version) || Math.floor(parsed.version as number) !== STATE_VERSION) return null;
    if (!Number.isFinite(parsed.coins) || !Number.isFinite(parsed.bonusEntries)) return null;
    return {
      version: STATE_VERSION,
      coins: Math.max(0, Math.min(MAX_COINS, Math.floor(parsed.coins ?? 0))),
      bonusEntries: Math.max(0, Math.floor(parsed.bonusEntries ?? 0)),
      updatedAt: Number.isFinite(parsed.updatedAt) ? Math.floor(parsed.updatedAt as number) : Date.now(),
    };
  } catch {
    return null;
  }
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return acc;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    acc[k] = decodeURIComponent(v);
    return acc;
  }, {});
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function setStateCookie(res: ServerResponse, state: PlayerState): void {
  const token = encodeState(state);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const cookies = parseCookies(req);
  const current = decodeState(cookies[COOKIE_KEY]) ?? { ...DEFAULT_STATE };

  if (req.method === 'GET') {
    setStateCookie(res, current);
    sendJson(res, 200, { coins: current.coins, bonusEntries: current.bonusEntries });
    return;
  }

  if (req.method === 'POST') {
    const body = (await readBody(req)) as { coins?: number; bonusEntries?: number } | null;
    if (!body || !Number.isFinite(body.coins) || !Number.isFinite(body.bonusEntries)) {
      sendJson(res, 400, { error: 'invalid_payload' });
      return;
    }

    const nextCoins = Math.max(0, Math.min(MAX_COINS, Math.floor(body.coins)));
    const nextBonusEntries = Math.max(0, Math.floor(body.bonusEntries));

    if (Math.abs(nextCoins - current.coins) > MAX_DELTA_PER_WRITE) {
      sendJson(res, 400, { error: 'suspicious_delta' });
      return;
    }

    if (nextBonusEntries < current.bonusEntries || nextBonusEntries - current.bonusEntries > 1) {
      sendJson(res, 400, { error: 'invalid_bonus_entries' });
      return;
    }

    const next: PlayerState = {
      version: STATE_VERSION,
      coins: nextCoins,
      bonusEntries: nextBonusEntries,
      updatedAt: Date.now(),
    };

    setStateCookie(res, next);
    sendJson(res, 200, { coins: next.coins, bonusEntries: next.bonusEntries });
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  sendJson(res, 405, { error: 'method_not_allowed' });
}
