"use client";

import { useReadContract, useReadContracts, useChainId } from "wagmi";
import { getContracts, astraSendHookAbi } from "@/config/contracts";
import type { RemittanceView } from "./use-remittance";

export function useCreatedRemittanceIds(address: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    functionName: "getRemittancesByCreator",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useRecipientRemittanceIds(address: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    functionName: "getRemittancesForRecipient",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useRemittancesBatch(ids: readonly bigint[] | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const calls = (ids ?? []).map((id) => ({
    address: contracts.astraSendHook as `0x${string}`,
    abi: astraSendHookAbi,
    functionName: "getRemittance" as const,
    args: [id] as const,
  }));

  return useReadContracts({
    contracts: calls,
    query: { enabled: !!ids && ids.length > 0 },
  });
}

export function useUserRemittances(address: `0x${string}` | undefined) {
  const {
    data: createdIds,
    isLoading: loadingCreated,
  } = useCreatedRemittanceIds(address);
  const {
    data: recipientIds,
    isLoading: loadingRecipient,
  } = useRecipientRemittanceIds(address);

  // Combine and deduplicate IDs
  const allIds = [
    ...(createdIds ?? []),
    ...(recipientIds ?? []),
  ].filter((id, index, arr) => arr.indexOf(id) === index);

  const { data: results, isLoading: loadingDetails } =
    useRemittancesBatch(allIds);

  const remittances: RemittanceView[] = (results ?? [])
    .filter((r) => r.status === "success" && r.result)
    .map((r) => r.result as unknown as RemittanceView)
    .sort((a, b) => Number(b.createdAt - a.createdAt));

  return {
    remittances,
    createdIds: createdIds ?? [],
    recipientIds: recipientIds ?? [],
    isLoading: loadingCreated || loadingRecipient || loadingDetails,
  };
}
