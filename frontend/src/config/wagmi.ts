import { getDefaultConfig } from "connectkit";
import { createConfig, http } from "wagmi";
import { baseSepolia, unichainSepolia } from "wagmi/chains";

export const config = createConfig(
  getDefaultConfig({
    chains: [baseSepolia, unichainSepolia],
    transports: {
      [baseSepolia.id]: http(
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
      ),
      [unichainSepolia.id]: http(
        process.env.NEXT_PUBLIC_UNICHAIN_SEPOLIA_RPC_URL ||
          "https://sepolia.unichain.org"
      ),
    },
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    appName: "AstraSend",
    appDescription:
      "Low-cost, compliant cross-border remittances powered by Uniswap v4",
    appUrl: "https://astrasend.xyz",
  })
);
