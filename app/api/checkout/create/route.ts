import { env } from "cloudflare:workers";
import { ensureWallet, getWalletId, walletCookie } from "../../_lib/wallet";

const packs = {
  "snack-pack": { tokens: 15, amount: 299, name: "15 Nia Tokens" },
  "good-girl-pack": { tokens: 40, amount: 499, name: "40 Nia Tokens" },
  "nia-whale": { tokens: 100, amount: 799, name: "100 Nia Tokens" },
} as const;

export async function POST(request: Request) {
  try {
    const { packId } = await request.json() as { packId?: keyof typeof packs };
    const pack = packId ? packs[packId] : undefined;
    if (!pack) return Response.json({ error: "Unknown token pack" }, { status: 400 });
    const secret = (env as unknown as { STRIPE_SECRET_KEY?: string }).STRIPE_SECRET_KEY;
    if (!secret) return Response.json({ error: "The token shop is not connected yet" }, { status: 503 });

    const wallet = getWalletId(request);
    await ensureWallet(wallet.id);
    const origin = new URL(request.url).origin;
    const body = new URLSearchParams({
      mode: "payment",
      client_reference_id: wallet.id,
      success_url: `${origin}/?checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(pack.amount),
      "line_items[0][price_data][product_data][name]": pack.name,
      "line_items[0][price_data][product_data][description]": "Digital credits for pets and treats on nia.hizach.com",
      "metadata[wallet_id]": wallet.id,
      "metadata[tokens]": String(pack.tokens),
      "metadata[pack_id]": packId!,
      "payment_intent_data[metadata][wallet_id]": wallet.id,
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/x-www-form-urlencoded",
        "stripe-version": "2026-02-25.clover",
      },
      body,
    });
    const session = await stripeResponse.json() as { url?: string; error?: { message?: string } };
    if (!stripeResponse.ok || !session.url) throw new Error(session.error?.message || "Could not open secure checkout");
    const response = Response.json({ url: session.url });
    if (wallet.isNew) response.headers.set("set-cookie", walletCookie(request, wallet.id));
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Checkout unavailable" }, { status: 500 });
  }
}
