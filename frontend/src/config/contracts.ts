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

export const astraSendHookAbi = [
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
  {
    type: "event",
    name: "RemittanceExpired",
    inputs: [
      { name: "remittanceId", type: "uint256", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false },
    ],
  },
  // Admin Events
  {
    type: "event",
    name: "ComplianceContractUpdated",
    inputs: [
      { name: "oldCompliance", type: "address", indexed: true },
      { name: "newCompliance", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PhoneResolverUpdated",
    inputs: [
      { name: "oldResolver", type: "address", indexed: true },
      { name: "newResolver", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "FeeCollectorUpdated",
    inputs: [
      { name: "oldCollector", type: "address", indexed: true },
      { name: "newCollector", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PlatformFeeUpdated",
    inputs: [
      { name: "oldFeeBps", type: "uint256", indexed: false },
      { name: "newFeeBps", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AutoReleaseToggled",
    inputs: [{ name: "enabled", type: "bool", indexed: false }],
  },
  // Custom Errors
  { type: "error", name: "InvalidRecipient", inputs: [] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvalidExpiry", inputs: [] },
  { type: "error", name: "SelfRemittance", inputs: [] },
  { type: "error", name: "RemittanceNotFound", inputs: [] },
  { type: "error", name: "RemittanceNotActive", inputs: [] },
  { type: "error", name: "RemittanceExpired", inputs: [] },
  { type: "error", name: "RemittanceNotExpired", inputs: [] },
  { type: "error", name: "TargetNotMet", inputs: [] },
  { type: "error", name: "OnlyCreator", inputs: [] },
  { type: "error", name: "OnlyRecipient", inputs: [] },
  { type: "error", name: "ComplianceFailed", inputs: [] },
  { type: "error", name: "RecipientCannotContribute", inputs: [] },
  { type: "error", name: "NoContribution", inputs: [] },
  { type: "error", name: "InvalidHookData", inputs: [] },
  { type: "error", name: "PhoneNotRegistered", inputs: [] },
  { type: "error", name: "InvalidFee", inputs: [] },
  { type: "error", name: "InvalidAddress", inputs: [] },
  { type: "error", name: "TokenNotSupported", inputs: [] },
  { type: "error", name: "MaxContributorsReached", inputs: [] },
  { type: "error", name: "PoolNotRegistered", inputs: [] },
  // Hook view functions
  {
    type: "function",
    name: "registeredPools",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "donationRouting",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_CONTRIBUTORS",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_PLATFORM_FEE_BPS",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "compliance",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "phoneResolver",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "userCreatedRemittances",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "userRecipientRemittances",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // Admin functions
  {
    type: "function",
    name: "setAutoRelease",
    inputs: [{ name: "enabled", type: "bool" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setCompliance",
    inputs: [{ name: "newCompliance", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setDonationRouting",
    inputs: [
      { name: "pid", type: "bytes32" },
      { name: "remittanceId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFeeCollector",
    inputs: [{ name: "newCollector", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPhoneResolver",
    inputs: [{ name: "newResolver", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPlatformFee",
    inputs: [{ name: "newFeeBps", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Hook events
  {
    type: "event",
    name: "PoolRegistered",
    inputs: [
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
      { name: "fee", type: "uint24", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DonationRouted",
    inputs: [
      { name: "remittanceId", type: "uint256", indexed: true },
      { name: "donor", type: "address", indexed: true },
      { name: "amount0", type: "uint256", indexed: false },
      { name: "amount1", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ComplianceGatedLP",
    inputs: [
      { name: "provider", type: "address", indexed: true },
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "allowed", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      { name: "previousOwner", type: "address", indexed: true },
      { name: "newOwner", type: "address", indexed: true },
    ],
  },
  // Additional errors from compiled ABI
  { type: "error", name: "HookNotImplemented", inputs: [] },
  { type: "error", name: "NotPoolManager", inputs: [] },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address" }],
  },
  { type: "error", name: "ReentrancyGuardReentrantCall", inputs: [] },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [{ name: "token", type: "address" }],
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
  // Admin role management (owner only)
  {
    type: "function",
    name: "addAdmin",
    inputs: [{ name: "admin", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeAdmin",
    inputs: [{ name: "admin", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "admins",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  // Owner-only config functions
  {
    type: "function",
    name: "setHook",
    inputs: [{ name: "_hook", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setDefaultDailyLimit",
    inputs: [{ name: "newLimit", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setMinimumAmount",
    inputs: [{ name: "newMinimum", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateDailyLimit",
    inputs: [
      { name: "account", type: "address" },
      { name: "newLimit", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Admin operational functions (owner or admin)
  {
    type: "function",
    name: "addToBlocklist",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeFromBlocklist",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // View state variables
  {
    type: "function",
    name: "hook",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "defaultDailyLimit",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "minimumAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "blocklist",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "customDailyLimits",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // Events
  {
    type: "event",
    name: "AdminAdded",
    inputs: [{ name: "admin", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "AdminRemoved",
    inputs: [{ name: "admin", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "AddedToBlocklist",
    inputs: [{ name: "account", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "RemovedFromBlocklist",
    inputs: [{ name: "account", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "DailyLimitUpdated",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "newLimit", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DefaultDailyLimitUpdated",
    inputs: [
      { name: "oldLimit", type: "uint256", indexed: false },
      { name: "newLimit", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MinimumAmountUpdated",
    inputs: [
      { name: "oldAmount", type: "uint256", indexed: false },
      { name: "newAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "HookUpdated",
    inputs: [
      { name: "oldHook", type: "address", indexed: true },
      { name: "newHook", type: "address", indexed: true },
    ],
  },
  // Compliance Errors
  { type: "error", name: "NotAuthorized", inputs: [] },
  { type: "error", name: "InvalidAddress", inputs: [] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "AlreadyBlocked", inputs: [] },
  { type: "error", name: "NotBlocked", inputs: [] },
] as const;

export const phoneResolverAbi = [
  // View functions
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
  {
    type: "function",
    name: "getPhoneHash",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "resolveString",
    inputs: [{ name: "phoneNumber", type: "string" }],
    outputs: [{ name: "wallet", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "admins",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  // User self-registration (caller must be the wallet being registered)
  {
    type: "function",
    name: "registerPhoneString",
    inputs: [
      { name: "phoneNumber", type: "string" },
      { name: "wallet", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateMyWallet",
    inputs: [{ name: "newWallet", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unregisterMyPhone",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Admin functions
  {
    type: "function",
    name: "addAdmin",
    inputs: [{ name: "admin", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeAdmin",
    inputs: [{ name: "admin", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "registerPhone",
    inputs: [
      { name: "phoneHash", type: "bytes32" },
      { name: "wallet", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "batchRegister",
    inputs: [
      { name: "phoneHashes", type: "bytes32[]" },
      { name: "wallets", type: "address[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updatePhoneWallet",
    inputs: [
      { name: "phoneHash", type: "bytes32" },
      { name: "newWallet", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unregisterPhone",
    inputs: [{ name: "phoneHash", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Events
  {
    type: "event",
    name: "PhoneRegistered",
    inputs: [
      { name: "phoneHash", type: "bytes32", indexed: true },
      { name: "wallet", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PhoneUnregistered",
    inputs: [
      { name: "phoneHash", type: "bytes32", indexed: true },
      { name: "wallet", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PhoneUpdated",
    inputs: [
      { name: "phoneHash", type: "bytes32", indexed: true },
      { name: "oldWallet", type: "address", indexed: true },
      { name: "newWallet", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "AdminAdded",
    inputs: [{ name: "admin", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "AdminRemoved",
    inputs: [{ name: "admin", type: "address", indexed: true }],
  },
  // Errors
  { type: "error", name: "InvalidWallet", inputs: [] },
  { type: "error", name: "PhoneAlreadyRegistered", inputs: [] },
  { type: "error", name: "PhoneNotRegistered", inputs: [] },
  { type: "error", name: "WalletAlreadyHasPhone", inputs: [] },
  { type: "error", name: "LengthMismatch", inputs: [] },
  { type: "error", name: "NotAuthorized", inputs: [] },
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
