"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useReadContract,
  useAccount,
} from "wagmi";
import {
  getContracts,
  remitSwapHookAbi,
  erc20Abi,
} from "@/config/contracts";

export function useCreateRemittance() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const create = (
    recipient: `0x${string}`,
    targetAmount: bigint,
    expiresAt: bigint,
    purposeHash: `0x${string}`,
    autoRelease: boolean
  ) => {
    writeContract({
      address: contracts.remitSwapHook,
      abi: remitSwapHookAbi,
      functionName: "createRemittance",
      args: [recipient, targetAmount, expiresAt, purposeHash, autoRelease],
    });
  };

  return { create, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useContributeDirectly() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const contribute = (remittanceId: bigint, amount: bigint) => {
    writeContract({
      address: contracts.remitSwapHook,
      abi: remitSwapHookAbi,
      functionName: "contributeDirectly",
      args: [remittanceId, amount],
    });
  };

  return { contribute, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useReleaseRemittance() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const release = (remittanceId: bigint) => {
    writeContract({
      address: contracts.remitSwapHook,
      abi: remitSwapHookAbi,
      functionName: "releaseRemittance",
      args: [remittanceId],
    });
  };

  return { release, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useCancelRemittance() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const cancel = (remittanceId: bigint) => {
    writeContract({
      address: contracts.remitSwapHook,
      abi: remitSwapHookAbi,
      functionName: "cancelRemittance",
      args: [remittanceId],
    });
  };

  return { cancel, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useClaimExpiredRefund() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const claim = (remittanceId: bigint) => {
    writeContract({
      address: contracts.remitSwapHook,
      abi: remitSwapHookAbi,
      functionName: "claimExpiredRefund",
      args: [remittanceId],
    });
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useApproveUSDT() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const approve = (amount: bigint) => {
    writeContract({
      address: contracts.usdt,
      abi: erc20Abi,
      functionName: "approve",
      args: [contracts.remitSwapHook, amount],
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error, reset };
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
    args: owner ? [owner, contracts.remitSwapHook] : undefined,
    query: { enabled: !!owner },
  });
}
