import { readFile, writeFile } from "node:fs/promises";

const configPath = new URL("../dist/server/wrangler.json", import.meta.url);
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();

if (!databaseId || !/^[0-9a-f-]{36}$/i.test(databaseId)) {
  throw new Error(
    "CLOUDFLARE_D1_DATABASE_ID must contain the UUID shown for the nia-wallets D1 database."
  );
}

const config = JSON.parse(await readFile(configPath, "utf8"));

config.name = "nia";
config.topLevelName = "nia";
config.compatibility_date = "2026-07-31";
config.compatibility_flags = ["nodejs_compat"];
config.d1_databases = [
  {
    binding: "DB",
    database_name: "nia-wallets",
    database_id: databaseId,
    migrations_dir: "../../migrations",
  },
];
config.routes = [{ pattern: "nia.hizach.com", custom_domain: true }];
config.observability = {
  enabled: true,
  logs: { head_sampling_rate: 1 },
};

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log("Prepared Cloudflare Worker build for nia.hizach.com");
