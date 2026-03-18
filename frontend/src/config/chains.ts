import { baseSepolia, unichainSepolia } from "wagmi/chains";

export const supportedChains = [baseSepolia, unichainSepolia] as const;

export const defaultChain = baseSepolia;
