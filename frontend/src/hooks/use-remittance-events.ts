"use client";

import { useWatchContractEvent, useChainId } from "wagmi";
import { getContracts, astraSendHookAbi } from "@/config/contracts";

interface UseRemittanceEventsOptions {
  /** Called when any relevant event fires, to trigger data refetches */
  onEvent?: () => void;
  /** Only listen for events related to this remittance ID */
  remittanceId?: bigint;
  /** Only listen for events related to this address (as creator or recipient) */
  address?: `0x${string}`;
}

/**
 * Watches on-chain AstraSendHook events in real time via WebSocket/polling.
 * Calls `onEvent` when a relevant event fires, so consumers can refetch data.
 */
export function useRemittanceEvents({
  onEvent,
  remittanceId,
  address,
}: UseRemittanceEventsOptions = {}) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  useWatchContractEvent({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    eventName: "RemittanceCreated",
    args: address
      ? { creator: address }
      : undefined,
    onLogs: () => onEvent?.(),
    enabled: !!onEvent,
  });

  useWatchContractEvent({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    eventName: "ContributionMade",
    args: remittanceId !== undefined
      ? { remittanceId }
      : undefined,
    onLogs: () => onEvent?.(),
    enabled: !!onEvent,
  });

  useWatchContractEvent({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    eventName: "RemittanceReleased",
    args: remittanceId !== undefined
      ? { remittanceId }
      : undefined,
    onLogs: () => onEvent?.(),
    enabled: !!onEvent,
  });

  useWatchContractEvent({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    eventName: "RemittanceCancelled",
    args: remittanceId !== undefined
      ? { remittanceId }
      : undefined,
    onLogs: () => onEvent?.(),
    enabled: !!onEvent,
  });

  useWatchContractEvent({
    address: contracts.astraSendHook,
    abi: astraSendHookAbi,
    eventName: "RemittanceExpired",
    args: remittanceId !== undefined
      ? { remittanceId }
      : undefined,
    onLogs: () => onEvent?.(),
    enabled: !!onEvent,
  });
}
