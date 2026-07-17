import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "@wagmi/connectors";
import { monad, monadTestnet } from "./chain";

// Needed for mobile browser users with no extension — WalletConnect's modal
// handles QR pairing and same-device deep links into whatever wallet they have.
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// This config module gets evaluated during SSR too (wagmi's `ssr: true`
// hydrates it client-side after), where `window` doesn't exist — fall back
// to a placeholder there since WalletConnect only checks this against the
// real origin once it actually runs in the browser.
const appUrl = typeof window !== "undefined" ? window.location.origin : "https://meridian.watch";

export const wagmiConfig = createConfig({
  chains: [monad, monadTestnet],
  connectors: [
    injected(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: "Meridian",
              description:
                "The chain is too fast for a second thought. Meridian is that thought, running before you sign.",
              url: appUrl,
              icons: [`${appUrl}/icon-512.png`],
            },
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: {
    [monad.id]: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL),
    [monadTestnet.id]: http(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL),
  },
  ssr: true,
});
