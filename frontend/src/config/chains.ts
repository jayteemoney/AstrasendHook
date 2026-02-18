import { baseSepolia, base } from "wagmi/chains";

export const supportedChains = [baseSepolia, base] as const;

export const defaultChain = baseSepolia;
