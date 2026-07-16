import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { monad, monadTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Meridian",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [monad, monadTestnet],
  ssr: true,
});
