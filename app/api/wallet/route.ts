import { ensureWallet, getWalletId, walletCookie, walletSnapshot } from "../_lib/wallet";

export async function GET(request: Request) {
  try {
    const wallet = getWalletId(request);
    await ensureWallet(wallet.id);
    const response = Response.json(await walletSnapshot(wallet.id));
    if (wallet.isNew) response.headers.set("set-cookie", walletCookie(request, wallet.id));
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Wallet unavailable" }, { status: 503 });
  }
}
