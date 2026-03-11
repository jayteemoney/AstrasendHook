"use client";

import { useReadContract, useChainId } from "wagmi";
import { getContracts, complianceAbi } from "@/config/contracts";

export function useComplianceStatus(address: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.compliance,
    abi: complianceAbi,
    functionName: "getComplianceStatus",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useRemainingDailyLimit(address: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.compliance,
    abi: complianceAbi,
    functionName: "getRemainingDailyLimit",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useIsBlocked(address: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.compliance,
    abi: complianceAbi,
    functionName: "isBlocked",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useIsCompliant(
  sender: `0x${string}` | undefined,
  recipient: `0x${string}` | undefined,
  amount: bigint | undefined
) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.compliance,
    abi: complianceAbi,
    functionName: "isCompliant",
    args:
      sender && recipient && amount !== undefined
        ? [sender, recipient, amount]
        : undefined,
    query: {
      enabled: !!sender && !!recipient && amount !== undefined && amount > 0n,
    },
  });
}
