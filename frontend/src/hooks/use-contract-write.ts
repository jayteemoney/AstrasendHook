"use client";

import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useReadContract,
  useAccount,
  usePublicClient,
} from "wagmi";
import {
  getContracts,
  astraSendHookAbi,
  erc20Abi,
} from "@/config/contracts";

export function useCreateRemittance() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const { address } = useAccount();
  const contracts = getContracts(chainId);

  const create = (
    recipient: `0x${string}`,
    targetAmount: bigint,
    expiresAt: bigint,
    purposeHash: `0x${string}`,
    autoRelease: boolean
  ) => {
    if (address) {
      writeContract({
        address: contracts.astraSendHook,
        abi: astraSendHookAbi,
        functionName: "createRemittance",
        args: [recipient, targetAmount, expiresAt, purposeHash, autoRelease],
        account: address,
        chainId,
      });
    }
  };

  return { create, hash, receipt, isPending, isConfirming, isSuccess, error, reset };
}

export function useCreateRemittanceByPhone() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const { address } = useAccount();
  const contracts = getContracts(chainId);

  const createByPhone = (
    recipientPhoneHash: `0x${string}`,
    targetAmount: bigint,
    expiresAt: bigint,
    purposeHash: `0x${string}`,
    autoRelease: boolean
  ) => {
    if (address) {
      writeContract({
        address: contracts.astraSendHook,
        abi: astraSendHookAbi,
        functionName: "createRemittanceByPhone",
        args: [recipientPhoneHash, targetAmount, expiresAt, purposeHash, autoRelease],
        account: address,
        chainId,
      });
    }
  };

  return { createByPhone, hash, receipt, isPending, isConfirming, isSuccess, error, reset };
}

export function useContributeDirectly() {
  const { writeContract, data: hash, isPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const { address } = useAccount();
  const contracts = getContracts(chainId);
  const publicClient = usePublicClient({ chainId });
  const [simError, setSimError] = useState<Error | null>(null);

  // Poll until the RPC node has the remittance in state (handles propagation lag).
  const waitForRemittanceVisible = async (remittanceId: bigint, maxMs = 15_000): Promise<boolean> => {
    if (!publicClient) return false;
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      try {
        const remit = await publicClient.readContract({
          address: contracts.astraSendHook,
          abi: astraSendHookAbi,
          functionName: "getRemittance",
          args: [remittanceId],
        }) as { id: bigint };
        if (remit?.id && remit.id !== 0n) return true;
      } catch { /* node not ready yet */ }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    return false;
  };

  const contribute = async (remittanceId: bigint, amount: bigint, waitForNode?: boolean) => {
    if (!address || !publicClient) return;
    setSimError(null);

    if (waitForNode) {
      // After auto-create: poll until the RPC node has synced the new remittance
      // before attempting the write (avoids gas estimation reverting on stale state).
      const visible = await waitForRemittanceVisible(remittanceId);
      if (!visible) {
        setSimError(new Error("RemittanceNotFound"));
        return;
      }
    }

    try {
      // Simulate first — surfaces the actual revert reason (compliance, balance, etc.)
      await publicClient.simulateContract({
        address: contracts.astraSendHook,
        abi: astraSendHookAbi,
        functionName: "contributeDirectly",
        args: [remittanceId, amount],
        account: address,
      });
    } catch (err) {
      setSimError(err as Error);
      return;
    }

    writeContract({
      address: contracts.astraSendHook,
      abi: astraSendHookAbi,
      functionName: "contributeDirectly",
      args: [remittanceId, amount],
      account: address,
      chainId,
    });
  };

  const error = simError ?? writeError;
  const reset = () => { setSimError(null); resetWrite(); };

  return { contribute, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useReleaseRemittance() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const { address } = useAccount();
  const contracts = getContracts(chainId);

  const release = (remittanceId: bigint) => {
    if (address) {
      writeContract({
        address: contracts.astraSendHook,
        abi: astraSendHookAbi,
        functionName: "releaseRemittance",
        args: [remittanceId],
        account: address,
        chainId,
      });
    }
  };

  return { release, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useCancelRemittance() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const { address } = useAccount();
  const contracts = getContracts(chainId);

  const cancel = (remittanceId: bigint) => {
    if (address) {
      writeContract({
        address: contracts.astraSendHook,
        abi: astraSendHookAbi,
        functionName: "cancelRemittance",
        args: [remittanceId],
        account: address,
        chainId,
      });
    }
  };

  return { cancel, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useClaimExpiredRefund() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const { address } = useAccount();
  const contracts = getContracts(chainId);

  const claim = (remittanceId: bigint) => {
    if (address) {
      writeContract({
        address: contracts.astraSendHook,
        abi: astraSendHookAbi,
        functionName: "claimExpiredRefund",
        args: [remittanceId],
        account: address,
        chainId,
      });
    }
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useApproveUSDT() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const { address } = useAccount();
  const contracts = getContracts(chainId);

  const approve = (amount: bigint) => {
    if (address) {
      writeContract({
        address: contracts.usdt,
        abi: erc20Abi,
        functionName: "approve",
        args: [contracts.astraSendHook, amount],
        account: address,
        chainId,
      });
    }
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useMintTestUSDT() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const { address } = useAccount();
  const contracts = getContracts(chainId);

  const mint = (amount: bigint) => {
    if (address) {
      writeContract({
        address: contracts.usdt,
        abi: erc20Abi,
        functionName: "mint",
        args: [address, amount],
        account: address,
        chainId,
      });
    }
  };

  return { mint, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useUSDTBalance(address: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.usdt,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useUSDTAllowance(owner: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.usdt,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner ? [owner, contracts.astraSendHook] : undefined,
    query: { enabled: !!owner },
  });
}
