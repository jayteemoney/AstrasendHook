import { type Address } from "viem";

// Contract addresses per chain
// Update these after deployment
export const CONTRACT_ADDRESSES: Record<
  number,
  {
    astraSendHook: Address;
    compliance: Address;
    phoneResolver: Address;
    usdt: Address;
  }
> = {
  // Base Sepolia (testnet)
  84532: {
    astraSendHook: "0x90C4eDCF58d203d924C5cAdd8c8A07bc01e798e4" as Address,
    compliance: "0xAC4038cD8EF3Bf8a37b4D910A6007A56167226AE" as Address,
    phoneResolver: "0x7A4C3e1Cc3b7F70E2f7BeF4bf343270c17643544" as Address,
    usdt: "0x778b10BA47EbFFA50a9368fB72b39Aa55B21C00E" as Address,
  },
  // Base Mainnet
  8453: {
    astraSendHook: "0x0000000000000000000000000000000000000000" as Address,
    compliance: "0x0000000000000000000000000000000000000000" as Address,
    phoneResolver: "0x0000000000000000000000000000000000000000" as Address,
    usdt: "0x0000000000000000000000000000000000000000" as Address,
  },
  // Unichain Sepolia (testnet)
  1301: {
    astraSendHook: "0xbC37002Ad169c6f3b39319eECAd65a7364eEd8e4" as Address,
    compliance: "0x61583daD9B340FF50eb6CcA6232Da15B0850946F" as Address,
    phoneResolver: "0x012D911Dbc11232472A6AAF6b51E29A0C5929cC5" as Address,
    usdt: "0x6F491FaBdEc72fD14e9E014f50B2ffF61C508bf1" as Address,
  },
  // Unichain Mainnet
  130: {
    astraSendHook: "0x0000000000000000000000000000000000000000" as Address,
    compliance: "0x0000000000000000000000000000000000000000" as Address,
    phoneResolver: "0x0000000000000000000000000000000000000000" as Address,
    usdt: "0x0000000000000000000000000000000000000000" as Address,
  },
};

export function getContracts(chainId: number) {
  return CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[84532];
}

// ============ ABIs ============

export const remitSwapHookAbi = [
  // Remittance Management
  {
    type: "function",
    name: "createRemittance",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "targetAmount", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
      { name: "purposeHash", type: "bytes32" },
      { name: "autoRelease", type: "bool" },
    ],
    outputs: [{ name: "remittanceId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createRemittanceByPhone",
    inputs: [
      { name: "recipientPhoneHash", type: "bytes32" },
      { name: "targetAmount", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
      { name: "purposeHash", type: "bytes32" },
      { name: "autoRelease", type: "bool" },
    ],
    outputs: [{ name: "remittanceId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "contributeDirectly",
    inputs: [
      { name: "remittanceId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "releaseRemittance",
    inputs: [{ name: "remittanceId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelRemittance",
    inputs: [{ name: "remittanceId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimExpiredRefund",
    inputs: [{ name: "remittanceId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // View Functions
  {
    type: "function",
    name: "getRemittance",
    inputs: [{ name: "remittanceId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "recipient", type: "address" },
          { name: "token", type: "address" },
          { name: "targetAmount", type: "uint256" },
          { name: "currentAmount", type: "uint256" },
          { name: "platformFeeBps", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "purposeHash", type: "bytes32" },
          { name: "status", type: "uint8" },
          { name: "autoRelease", type: "bool" },
          { name: "contributorList", type: "address[]" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getContribution",
    inputs: [
      { name: "remittanceId", type: "uint256" },
      { name: "contributor", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRemittancesByCreator",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRemittancesForRecipient",
    inputs: [{ name: "recipient", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextRemittanceId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "platformFeeBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feeCollector",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "autoReleaseEnabled",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "SUPPORTED_TOKEN",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  // Events
  {
    type: "event",
    name: "RemittanceCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "targetAmount", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint256", indexed: false },
      { name: "autoRelease", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ContributionMade",
    inputs: [
      { name: "remittanceId", type: "uint256", indexed: true },
      { name: "contributor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newTotal", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RemittanceReleased",
    inputs: [
      { name: "remittanceId", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RemittanceCancelled",
    inputs: [
      { name: "remittanceId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "refundedAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const complianceAbi = [
  {
    type: "function",
    name: "isCompliant",
    inputs: [
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getComplianceStatus",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "isAllowed", type: "bool" },
      { name: "dailyUsed", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isBlocked",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRemainingDailyLimit",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const phoneResolverAbi = [
  {
    type: "function",
    name: "resolve",
    inputs: [{ name: "phoneHash", type: "bytes32" }],
    outputs: [{ name: "wallet", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "computePhoneHash",
    inputs: [{ name: "phoneNumber", type: "string" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "isRegistered",
    inputs: [{ name: "phoneHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasPhone",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;
