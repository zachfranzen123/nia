import { env } from "cloudflare:workers";
import { ensureWallet, getDb, getWalletId, walletCookie, walletSnapshot } from "../../_lib/wallet";

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json() as { sessionId?: string };
    if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return Response.json({ error: "Invalid checkout session" }, { status: 400 });
    const secret = (env as unknown as { STRIPE_SECRET_KEY?: string }).STRIPE_SECRET_KEY;
    if (!secret) return Response.json({ error: "The token shop is not connected yet" }, { status: 503 });
    const wallet = getWalletId(request);
    await ensureWallet(wallet.id);

    const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { authorization: `Bearer ${secret}`, "stripe-version": "2026-02-25.clover" },
    });
    const session = await stripeResponse.json() as {
      payment_status?: string; status?: string; client_reference_id?: string;
      amount_total?: number; metadata?: { tokens?: string; wallet_id?: string };
      error?: { message?: string };
    };
    if (!stripeResponse.ok) throw new Error(session.error?.message || "Could not verify payment");
    if (session.payment_status !== "paid" || session.status !== "complete") throw new Error("Payment is not complete");
    if (session.client_reference_id !== wallet.id || session.metadata?.wallet_id !== wallet.id) throw new Error("This checkout belongs to another wallet");
    const tokens = Number(session.metadata?.tokens);
    if (![10, 25, 50].includes(tokens)) throw new Error("Invalid token amount");

    const payment = await getDb().prepare("INSERT OR IGNORE INTO payments (session_id, wallet_id, tokens, amount_cents) VALUES (?, ?, ?, ?)")
      .bind(sessionId, wallet.id, tokens, Number(session.amount_total ?? 0)).run();
    const added = Number(payment.meta.changes ?? 0) > 0 ? tokens : 0;
    if (added) await getDb().prepare("UPDATE wallets SET tokens = tokens + ? WHERE id = ?").bind(added, wallet.id).run();
    const response = Response.json({ added, wallet: await walletSnapshot(wallet.id) });
    if (wallet.isNew) response.headers.set("set-cookie", walletCookie(request, wallet.id));
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not credit tokens" }, { status: 500 });
  }
}
