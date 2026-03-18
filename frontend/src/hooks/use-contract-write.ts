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
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const { address } = useAccount();
  const contracts = getContracts(chainId);

  const contribute = (remittanceId: bigint, amount: bigint) => {
    if (address) {
      writeContract({
        address: contracts.astraSendHook,
        abi: astraSendHookAbi,
        functionName: "contributeDirectly",
        args: [remittanceId, amount],
        account: address,
        chainId,
      });
    }
  };

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
