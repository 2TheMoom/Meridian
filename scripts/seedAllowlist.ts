import { isAddress } from "viem";
import { createServiceRoleSupabaseClient } from "../src/lib/supabase/server";

/**
 * Seeds the `allowlist` table from monad-crypto/protocols — the source spec
 * section 5 refers to as "Monad's official protocols repo". Schema confirmed
 * against the repo's own README + protocols-{network}.json on 2026-07-16:
 * https://github.com/monad-crypto/protocols
 */
const SOURCE_BASE = "https://raw.githubusercontent.com/monad-crypto/protocols/main";

type ProtocolEntry = {
  name: string;
  description?: string;
  live: boolean;
  categories: string[];
  addresses: Record<string, string>;
};

type ProtocolsFile = Record<string, ProtocolEntry>;

type Network = "mainnet" | "testnet";
const NETWORKS: { network: Network; chainId: number }[] = [
  { network: "mainnet", chainId: 143 },
  { network: "testnet", chainId: 10143 },
];

const BATCH_SIZE = 500;

async function fetchProtocols(network: Network): Promise<ProtocolsFile> {
  const res = await fetch(`${SOURCE_BASE}/protocols-${network}.json`);
  if (!res.ok) {
    throw new Error(`failed to fetch protocols-${network}.json: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

type AllowlistRow = {
  address: string;
  chain_id: number;
  name: string;
  category: string | null;
  source: string;
};

function toAllowlistRows(protocols: ProtocolsFile, chainId: number, includeNonLive: boolean): AllowlistRow[] {
  const rows: AllowlistRow[] = [];

  for (const protocol of Object.values(protocols)) {
    if (!includeNonLive && !protocol.live) continue;

    const category = protocol.categories?.[0] ?? null;
    for (const address of Object.values(protocol.addresses ?? {})) {
      // strict: false — only validates 40-hex-char format, not EIP-55 checksum
      // casing. The source repo's addresses aren't consistently checksummed,
      // and we lowercase everything before storing anyway, so a checksum
      // mismatch here isn't a real defect, just inconsistent casing upstream.
      if (!isAddress(address, { strict: false })) {
        console.warn(`  skipping malformed address for "${protocol.name}": ${address}`);
        continue;
      }
      rows.push({
        address: address.toLowerCase(),
        chain_id: chainId,
        name: protocol.name,
        category,
        source: "monad-protocols-repo",
      });
    }
  }

  return rows;
}

async function main() {
  const includeNonLive = process.argv.includes("--include-non-live");
  const supabase = createServiceRoleSupabaseClient();

  let totalUpserted = 0;

  for (const { network, chainId } of NETWORKS) {
    console.log(`fetching ${network} protocols...`);
    const protocols = await fetchProtocols(network);
    const rows = toAllowlistRows(protocols, chainId, includeNonLive);

    // A protocol occasionally lists the same address under two labels
    // (proxy + implementation aliases, etc.) — dedupe within this batch so
    // the upsert doesn't choke on a duplicate (address, chain_id) key.
    const byKey = new Map(rows.map((row) => [`${row.address}:${row.chain_id}`, row]));
    const deduped = [...byKey.values()];

    console.log(
      `  ${Object.keys(protocols).length} protocols (${includeNonLive ? "incl. non-live" : "live only"}) -> ${deduped.length} unique addresses`,
    );

    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      const batch = deduped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("allowlist").upsert(batch, { onConflict: "address,chain_id" });
      if (error) throw new Error(`upsert failed for ${network} batch starting at ${i}: ${error.message}`);
      totalUpserted += batch.length;
    }
  }

  console.log(`done — upserted ${totalUpserted} allowlist rows across ${NETWORKS.length} networks`);
}

main().catch((err) => {
  console.error("allowlist seeding failed:", err);
  process.exit(1);
});
