import { env } from "cloudflare:workers";

const COOKIE_NAME = "nia_wallet";

function db() {
  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) throw new Error("Nia's wallet database is warming up. Try again in a moment.");
  return binding;
}

export function getWalletId(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([a-f0-9-]{36})`));
  return { id: match?.[1] ?? crypto.randomUUID(), isNew: !match };
}

export function walletCookie(request: Request, id: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}

export async function ensureWallet(id: string) {
  await db().prepare("INSERT OR IGNORE INTO wallets (id, tokens) VALUES (?, 0)").bind(id).run();
}

export async function walletSnapshot(id: string) {
  const [wallet, totals] = await db().batch([
    db().prepare("SELECT tokens FROM wallets WHERE id = ?").bind(id),
    db().prepare("SELECT COALESCE(SUM(CASE WHEN kind = 'pet' THEN 1 ELSE 0 END), 0) AS globalPets, COALESCE(SUM(CASE WHEN kind = 'treat' THEN 1 ELSE 0 END), 0) AS globalTreats FROM actions"),
  ]);
  const walletRow = wallet.results[0] as { tokens?: number } | undefined;
  const totalRow = totals.results[0] as { globalPets?: number; globalTreats?: number } | undefined;
  return {
    tokens: Number(walletRow?.tokens ?? 0),
    globalPets: Number(totalRow?.globalPets ?? 0),
    globalTreats: Number(totalRow?.globalTreats ?? 0),
  };
}

export function getDb() { return db(); }
