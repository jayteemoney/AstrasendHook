"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { getContracts, phoneResolverAbi } from "@/config/contracts";

export function useResolvePhone(phoneHash: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.phoneResolver,
    abi: phoneResolverAbi,
    functionName: "resolve",
    args: phoneHash ? [phoneHash] : undefined,
    query: { enabled: !!phoneHash },
  });
}

export function useComputePhoneHash(phoneNumber: string | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.phoneResolver,
    abi: phoneResolverAbi,
    functionName: "computePhoneHash",
    args: phoneNumber ? [phoneNumber] : undefined,
    query: { enabled: !!phoneNumber && phoneNumber.length > 0 },
  });
}

export function useIsPhoneRegistered(phoneHash: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.phoneResolver,
    abi: phoneResolverAbi,
    functionName: "isRegistered",
    args: phoneHash ? [phoneHash] : undefined,
    query: { enabled: !!phoneHash },
  });
}

export function useHasPhone(wallet: `0x${string}` | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.phoneResolver,
    abi: phoneResolverAbi,
    functionName: "hasPhone",
    args: wallet ? [wallet] : undefined,
    query: { enabled: !!wallet },
  });
}

export function useResolvePhoneString(phoneNumber: string | undefined) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  return useReadContract({
    address: contracts.phoneResolver,
    abi: phoneResolverAbi,
    functionName: "resolveString",
    args: phoneNumber ? [phoneNumber] : undefined,
    query: { enabled: !!phoneNumber && phoneNumber.length > 0 },
  });
}

export function useRegisterPhoneString() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const register = (phoneNumber: string, wallet: `0x${string}`) => {
    writeContract({
      address: contracts.phoneResolver,
      abi: phoneResolverAbi,
      functionName: "registerPhoneString",
      args: [phoneNumber, wallet],
    });
  };

  return { register, hash, isPending, isConfirming, isSuccess, error, reset };
}
