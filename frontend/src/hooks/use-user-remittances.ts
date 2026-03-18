"use client";

import { useState, useEffect, useCallback } from "react";
import { useReadContract, useReadContracts, useChainId } from "wagmi";
import { getContracts, astraSendHookAbi } from "@/config/contracts";
import type { RemittanceView } from "./use-remittance";

// localStorage-backed store for remittances where user is only a contributor
function storageKey(chainId: number, address: string) {
  return `astrasend_contributed_${chainId}_${address.toLowerCase()}`;
}

export function trackContributedRemittance(
  chainId: number,
  address: string,
  remittanceId: bigint
) {
  if (typeof window === "undefined") return;
  const key = storageKey(chainId, address);
  const existing: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
  const idStr = remittanceId.toString();
  if (!existing.includes(idStr)) {
    localStorage.setItem(key, JSON.stringify([...existing, idStr]));
  }
}

function useContributedRemittanceIds(
  chainId: number,
  address: `0x${string}` | undefined
): bigint[] {
  const [ids, setIds] = useState<bigint[]>([]);

  const load = useCallback(() => {
    if (!address || typeof window === "undefined") return;
    const raw: string[] = JSON.parse(
      localStorage.getItem(storageKey(chainId, address)) ?? "[]"
    );
    setIds(raw.map((s) => BigInt(s)));
  }, [chainId, address]);

  useEffect(() => {
    load();
    // Re-sync when storage changes in another tab
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, [load]);

  return ids;
}

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
  const chainId = useChainId();
  const {
    data: createdIds,
    isLoading: loadingCreated,
  } = useCreatedRemittanceIds(address);
  const {
    data: recipientIds,
    isLoading: loadingRecipient,
  } = useRecipientRemittanceIds(address);
  const contributedIds = useContributedRemittanceIds(chainId, address);

  // Combine and deduplicate IDs (BigInt equality works with Set)
  const allIds = Array.from(
    new Map(
      [
        ...(createdIds ?? []),
        ...(recipientIds ?? []),
        ...contributedIds,
      ].map((id) => [id.toString(), id])
    ).values()
  );

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
