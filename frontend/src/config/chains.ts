import { baseSepolia, base, unichain, unichainSepolia } from "wagmi/chains";

export const supportedChains = [
  baseSepolia,
  base,
  unichainSepolia,
  unichain,
] as const;

export const defaultChain = baseSepolia;
