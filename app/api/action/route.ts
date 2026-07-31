import { ensureWallet, getDb, getWalletId, walletCookie, walletSnapshot } from "../_lib/wallet";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { kind?: string };
    if (payload.kind !== "pet" && payload.kind !== "treat") {
      return Response.json({ error: "Choose pet or treat" }, { status: 400 });
    }
    const wallet = getWalletId(request);
    const cost = payload.kind === "pet" ? 1 : 3;
    await ensureWallet(wallet.id);
    const updated = await getDb()
      .prepare("UPDATE wallets SET tokens = tokens - ? WHERE id = ? AND tokens >= ? RETURNING tokens")
      .bind(cost, wallet.id, cost)
      .first<{ tokens: number }>();
    if (!updated) return Response.json({ error: "Not enough Nia tokens" }, { status: 402 });
    try {
      await getDb().prepare("INSERT INTO actions (wallet_id, kind, cost) VALUES (?, ?, ?)").bind(wallet.id, payload.kind, cost).run();
    } catch (error) {
      await getDb().prepare("UPDATE wallets SET tokens = tokens + ? WHERE id = ?").bind(cost, wallet.id).run();
      throw error;
    }
    const response = Response.json({ wallet: await walletSnapshot(wallet.id) });
    if (wallet.isNew) response.headers.set("set-cookie", walletCookie(request, wallet.id));
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Nia is briefly unavailable" }, { status: 500 });
  }
}
