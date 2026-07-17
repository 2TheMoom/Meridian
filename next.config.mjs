const isDev = process.env.NODE_ENV !== "production";

const supabaseOrigin = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const supabaseWsOrigin = supabaseOrigin.replace(/^https:/, "wss:");

// WalletConnect/Reown relay + verify + explorer API endpoints used by RainbowKit's
// connectors, and MetaMask/Coinbase SDK endpoints. Necessary for wallet connect and
// SIWE flows to work — trim this list if you drop connectors, don't add to it
// speculatively.
const walletConnectOrigins = [
  "https://*.walletconnect.com",
  "https://*.walletconnect.org",
  "wss://*.walletconnect.com",
  "wss://*.walletconnect.org",
  "https://*.reown.com",
  "wss://*.reown.com",
  "https://explorer-api.walletconnect.com",
  "https://api.web3modal.org",
];

const connectSrc = [
  "'self'",
  supabaseOrigin,
  supabaseWsOrigin,
  process.env.NEXT_PUBLIC_MONAD_RPC_URL,
  process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL,
  ...walletConnectOrigins,
].filter(Boolean);

const csp = [
  `default-src 'self'`,
  // 'unsafe-eval'/'wasm-unsafe-eval' were previously dev-only. Production
  // shipped with strict `script-src 'self'` and the wallet-connect UI
  // silently failed to render — a known, widely-reported wagmi/RainbowKit
  // + strict-CSP interaction (their connector dependency chain hits
  // eval/WASM-compile paths this policy was blocking). Not narrowable
  // without vendoring/patching their dependencies.
  // 'unsafe-inline' is required too: Next's App Router streams RSC/hydration
  // payloads via inline <script> tags with no nonce plumbing in place, and
  // without this the browser blocks them outright — client JS never
  // hydrates, so the whole page (not just wallet connect) is inert.
  `script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: https:`,
  `font-src 'self' data:`,
  `connect-src ${connectSrc.join(" ")}`,
  `frame-src https://*.walletconnect.com https://*.walletconnect.org https://verify.walletconnect.com`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
]
  .join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
