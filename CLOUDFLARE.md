# Deploy Nia to Cloudflare Workers

This project uses Workers Builds because it includes server routes and a D1 token wallet. Do not deploy it as a static Pages project.

## 1. Create the database

In Cloudflare, open **Storage & Databases → D1 SQL database**, create a database named `nia-wallets`, and copy its database ID.

## 2. Connect GitHub

Open **Workers & Pages → Create application → Import a repository** and choose `zachfranzen123/nia`.

Use these settings:

- Worker name: `nia`
- Production branch: `main`
- Build command: `npm run build:cloudflare`
- Deploy command: `npm run deploy:cloudflare`
- Root directory: `/`

Add a build variable named `CLOUDFLARE_D1_DATABASE_ID` whose value is the `nia-wallets` database ID. This ID is configuration, not a secret.

The deploy command applies pending D1 migrations before publishing the Worker. The build also registers `nia.hizach.com` as a Worker Custom Domain. If that hostname already has a DNS record, remove the conflicting record before deploying.

## 3. Add Stripe securely

After the first Worker exists, open **nia → Settings → Variables and Secrets**. Add `STRIPE_SECRET_KEY` as a **Secret**, not a plaintext variable, and deploy the change. Start with a Stripe test-mode secret key.

Never put a Stripe key in this repository, a build variable, or a chat message.
