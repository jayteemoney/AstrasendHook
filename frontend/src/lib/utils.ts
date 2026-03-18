import { formatUnits, parseUnits, type Address, BaseError, ContractFunctionRevertedError } from "viem";

// USDT has 6 decimals
export const USDT_DECIMALS = 6;

export function formatUSDT(amount: bigint): string {
  return formatUnits(amount, USDT_DECIMALS);
}

export function parseUSDT(amount: string): bigint {
  return parseUnits(amount, USDT_DECIMALS);
}

export function formatUSDTDisplay(amount: bigint): string {
  const formatted = formatUSDT(amount);
  const num = parseFloat(formatted);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function shortenAddress(address: Address | string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export enum RemittanceStatus {
  Active = 0,
  Released = 1,
  Cancelled = 2,
  Expired = 3,
}

export function getStatusLabel(status: number): string {
  switch (status) {
    case RemittanceStatus.Active:
      return "Active";
    case RemittanceStatus.Released:
      return "Released";
    case RemittanceStatus.Cancelled:
      return "Cancelled";
    case RemittanceStatus.Expired:
      return "Expired";
    default:
      return "Unknown";
  }
}

export function getStatusColor(status: number): string {
  switch (status) {
    case RemittanceStatus.Active:
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case RemittanceStatus.Released:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case RemittanceStatus.Cancelled:
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case RemittanceStatus.Expired:
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    default:
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400";
  }
}

export function timeAgo(timestamp: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(Number(timestamp) * 1000).toLocaleDateString();
}

export function timeUntil(timestamp: bigint): string {
  if (timestamp === 0n) return "No expiry";
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(timestamp) - now;

  if (diff <= 0) return "Expired";
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
  return `${Math.floor(diff / 86400)}d left`;
}

export function progressPercent(current: bigint, target: bigint): number {
  if (target === 0n) return 0;
  const pct = Number((current * 10000n) / target) / 100;
  return Math.min(pct, 100);
}

const EXPLORER_URLS: Record<number, string> = {
  84532: "https://sepolia.basescan.org",
  8453: "https://basescan.org",
  1301: "https://sepolia.uniscan.xyz",
  130: "https://uniscan.xyz",
};

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const base = EXPLORER_URLS[chainId] ?? EXPLORER_URLS[84532];
  return `${base}/tx/${txHash}`;
}

// Maps contract custom error names to user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  InvalidRecipient: "Invalid recipient address.",
  InvalidAmount: "Amount is invalid or below the minimum.",
  InvalidExpiry: "Expiry date must be in the future.",
  SelfRemittance: "You cannot send a remittance to yourself.",
  RemittanceNotFound: "This remittance does not exist.",
  RemittanceNotActive: "This remittance is no longer active.",
  RemittanceExpired: "This remittance has expired.",
  RemittanceNotExpired: "This remittance has not expired yet.",
  TargetNotMet: "The target amount has not been reached.",
  OnlyCreator: "Only the remittance creator can do this.",
  OnlyRecipient: "Only the recipient can do this.",
  ComplianceFailed: "Your wallet is not authorized to transact. You may not be on the allowlist, or this transfer exceeds your daily limit.",
  RecipientCannotContribute: "The recipient cannot contribute to their own remittance.",
  NoContribution: "You have no contribution to claim.",
  InvalidHookData: "Invalid transaction data.",
  PhoneNotRegistered: "This phone number is not registered. The recipient must register first.",
  InvalidFee: "Invalid fee configuration.",
  InvalidAddress: "Invalid address provided.",
  TokenNotSupported: "This token is not supported.",
  MaxContributorsReached: "Maximum number of contributors reached for this remittance.",
  PoolNotRegistered: "This pool is not registered as a remittance corridor.",
  NotAuthorized: "You are not authorized for this action.",
  AlreadyOnAllowlist: "This address is already on the allowlist.",
  NotOnAllowlist: "This address is not on the allowlist.",
  AlreadyBlocked: "This address is already blocked.",
  NotBlocked: "This address is not blocked.",
  InvalidWallet: "Invalid wallet address.",
  PhoneAlreadyRegistered: "This phone number is already registered.",
  WalletAlreadyHasPhone: "This wallet already has a phone number registered.",
  LengthMismatch: "Array lengths do not match.",
};

export function decodeContractError(error: any): string {
  const msg = error?.message || String(error);

  if (msg.includes("User rejected") || msg.includes("UserDenied") || msg.includes("4001")) {
    return "Transaction was rejected in your wallet.";
  }

  // Handle "account not authorized" error (EIP-1193 4100)
  if (msg.includes("not been authorized") || msg.includes("not authorized") || msg.includes("4100")) {
    return "Wallet account not authorized. Please make sure your wallet is connected and you have selected the correct account.";
  }

  // Walk the viem error chain to find a ContractFunctionRevertedError
  if (error instanceof BaseError) {
    const revertError = error.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      if (errorName && ERROR_MESSAGES[errorName]) {
        return ERROR_MESSAGES[errorName];
      }
      if (errorName) {
        return `Transaction failed: ${errorName}`;
      }
    }
  }

  // Fallback: try to extract a reason from the message
  if (msg.includes("insufficient funds")) return "Insufficient funds for gas.";
  if (msg.includes("exceeds balance")) return "Token balance too low.";

  // Base/OP-Stack chains return a gas-estimation error when a tx reverts without
  // a decoded reason (e.g. ComplianceFailed on AllowlistCompliance for non-allowlisted wallets).
  // Surface a clear message instead of the raw RPC noise.
  if (msg.includes("exceeds maximum per-transaction gas limit") || msg.includes("gas limit")) {
    return "Transaction failed during gas estimation — the contract rejected your request. Your wallet may not be authorized (compliance check failed), or you may have insufficient USDT balance or allowance.";
  }

  return msg.length > 200 ? msg.slice(0, 200) + "..." : msg;
}
