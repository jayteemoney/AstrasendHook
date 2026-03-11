"use client";

import { useReadContract } from "wagmi";
import { useChainId } from "wagmi";
import { getContracts, astraSendHookAbi } from "@/config/contracts";

export interface RemittanceView {
  id: bigint;
  creator: `0x${string}`;
  recipient: `0x${string}`;
  token: `0x${string}`;
  targetAmount: bigint;
  currentAmount: bigint;
  platformFeeBps: bigint;
  createdAt: bigint;
  expiresAt: bigint;
  purposeHash: `0x${string}`;
  status: number;
  autoRelease: boolean;
  contributorList: readonly `0x${string}`[];
}

export function useRemittance(remittanceId: bigint | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    functionName: "getRemittance",
    args: remittanceId !== undefined ? [remittanceId] : undefined,
    query: {
      enabled: remittanceId !== undefined && remittanceId > 0n,
    },
  });
}

export function useContribution(
  remittanceId: bigint | undefined,
  contributor: `0x${string}` | undefined
) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    functionName: "getContribution",
    args:
      remittanceId !== undefined && contributor
        ? [remittanceId, contributor]
        : undefined,
    query: {
      enabled:
        remittanceId !== undefined && remittanceId > 0n && !!contributor,
    },
  });
}

export function usePlatformFee() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    functionName: "platformFeeBps",
  });
}

export function useAutoReleaseEnabled() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    functionName: "autoReleaseEnabled",
  });
}

export function useNextRemittanceId() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    functionName: "nextRemittanceId",
  });
}
