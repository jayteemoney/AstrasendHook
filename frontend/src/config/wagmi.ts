import { getDefaultConfig } from "connectkit";
import { createConfig, http } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";

export const config = createConfig(
  getDefaultConfig({
    chains: [baseSepolia, base],
    transports: {
      [baseSepolia.id]: http(
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
      ),
      [base.id]: http(
        process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"
      ),
    },
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    appName: "RemitSwap",
    appDescription:
      "Low-cost, compliant cross-border remittances powered by Uniswap v4",
    appUrl: "https://remitswap.xyz",
  })
);
