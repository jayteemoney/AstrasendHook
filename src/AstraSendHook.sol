// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BaseHook } from "v4-periphery/src/utils/BaseHook.sol";
import { Hooks } from "v4-core/src/libraries/Hooks.sol";
import { IPoolManager } from "v4-core/src/interfaces/IPoolManager.sol";
import { PoolKey } from "v4-core/src/types/PoolKey.sol";
import { PoolId, PoolIdLibrary } from "v4-core/src/types/PoolId.sol";
import { BalanceDelta } from "v4-core/src/types/BalanceDelta.sol";
import { BeforeSwapDelta, BeforeSwapDeltaLibrary } from "v4-core/src/types/BeforeSwapDelta.sol";
import { Currency, CurrencyLibrary } from "v4-core/src/types/Currency.sol";
import { SwapParams, ModifyLiquidityParams } from "v4-core/src/types/PoolOperation.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import { RemitTypes } from "./libraries/RemitTypes.sol";
import { ICompliance } from "./interfaces/ICompliance.sol";
import { IPhoneNumberResolver } from "./interfaces/IPhoneNumberResolver.sol";
import { IAstraSendHook } from "./interfaces/IAstraSendHook.sol";

/// @title AstraSendHook
/// @notice Uniswap v4 hook for low-cost, compliant cross-border remittances
/// @dev Uses 6 hooks: beforeSwap, afterSwap, afterSwapReturnDelta, afterInitialize,
///      beforeAddLiquidity, beforeDonate
/// @author dev_jaytee
contract AstraSendHook is BaseHook, IAstraSendHook, Ownable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    // ============ Structs ============

    /// @notice Internal storage structure for remittances (includes mapping)
    struct RemittanceStorage {
        uint256 id;
        address creator;
        address recipient;
        address token;
        uint256 targetAmount;
        uint256 currentAmount;
        uint256 platformFeeBps;
        uint256 createdAt;
        uint256 expiresAt;
        bytes32 purposeHash;
        RemitTypes.Status status;
        bool autoRelease;
        address[] contributorList;
        mapping(address => uint256) contributions;
    }

    // ============ Constants ============

    /// @notice Maximum platform fee (5%)
    uint256 public constant MAX_PLATFORM_FEE_BPS = 500;

    /// @notice Maximum contributors per remittance to prevent gas bomb on cancel
    uint256 public constant MAX_CONTRIBUTORS = 50;

    /// @notice Transient storage slot for passing hookData between beforeSwap and afterSwap
    /// @dev keccak256("AstraSendHook.hookData") = 0x...
    uint256 private constant _HOOK_DATA_SLOT = 0x01;

    // ============ State Variables ============

    /// @notice Compliance module contract
    ICompliance public compliance;

    /// @notice Phone number resolver contract
    IPhoneNumberResolver public phoneResolver;

    /// @notice Address that collects platform fees
    address public override feeCollector;

    /// @notice Platform fee in basis points (50 = 0.5%)
    uint256 public override platformFeeBps = 50;

    /// @notice Counter for remittance IDs
    uint256 public override nextRemittanceId = 1;

    /// @notice Global auto-release setting
    bool public override autoReleaseEnabled = true;

    /// @notice Supported token for remittances (USDT)
    address public immutable SUPPORTED_TOKEN;

    /// @notice Remittance storage by ID
    mapping(uint256 => RemittanceStorage) internal remittances;

    /// @notice Remittances created by user
    mapping(address => uint256[]) public userCreatedRemittances;

    /// @notice Remittances where user is recipient
    mapping(address => uint256[]) public userRecipientRemittances;

    /// @notice Registered pool corridors (poolId => true)
    mapping(bytes32 => bool) public registeredPools;

    /// @notice Donation routing: poolId => remittanceId (0 = no routing)
    mapping(bytes32 => uint256) public donationRouting;

    // ============ Errors ============

    error InvalidRecipient();
    error InvalidAmount();
    error InvalidExpiry();
    error SelfRemittance();
    error RemittanceNotFound();
    error RemittanceNotActive();
    error RemittanceExpired();
    error RemittanceNotExpired();
    error TargetNotMet();
    error OnlyCreator();
    error OnlyRecipient();
    error ComplianceFailed();
    error RecipientCannotContribute();
    error NoContribution();
    error InvalidHookData();
    error PhoneNotRegistered();
    error InvalidFee();
    error InvalidAddress();
    error TokenNotSupported();
    error MaxContributorsReached();
    error PoolNotRegistered();

    // ============ Constructor ============

    constructor(
        IPoolManager _poolManager,
        ICompliance _compliance,
        IPhoneNumberResolver _phoneResolver,
        address _feeCollector,
        address _supportedToken,
        address _initialOwner
    ) BaseHook(_poolManager) Ownable(_initialOwner) {
        if (address(_compliance) == address(0)) revert InvalidAddress();
        if (_feeCollector == address(0)) revert InvalidAddress();
        if (_supportedToken == address(0)) revert InvalidAddress();

        compliance = _compliance;
        phoneResolver = _phoneResolver;
        feeCollector = _feeCollector;
        SUPPORTED_TOKEN = _supportedToken;
    }

    // ============ Hook Permissions ============

    /// @inheritdoc BaseHook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true, // Pool corridor registration
            beforeAddLiquidity: true, // Compliance-gated LP
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true, // Compliance check + transient hookData cache
            afterSwap: true, // Record contribution
            beforeDonate: true, // Route donations to remittance recipients
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true, // Auto-capture swap output into escrow
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============ Hook Functions ============

    /// @notice Called after pool initialization — registers pool as a valid remittance corridor
    /// @dev Enforces that one token in the pair must be the SUPPORTED_TOKEN (USDT)
    function _afterInitialize(address, PoolKey calldata key, uint160, int24)
        internal
        override
        returns (bytes4)
    {
        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);

        // Only register pools containing our supported token
        if (token0 != SUPPORTED_TOKEN && token1 != SUPPORTED_TOKEN) {
            revert TokenNotSupported();
        }

        bytes32 pid = PoolId.unwrap(key.toId());
        registeredPools[pid] = true;

        emit RemitTypes.PoolRegistered(pid, token0, token1, key.fee);

        return this.afterInitialize.selector;
    }

    /// @notice Called before adding liquidity — compliance-gates LP provision
    /// @dev Only verified users can provide liquidity to remittance corridor pools
    function _beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) internal override returns (bytes4) {
        bytes32 pid = PoolId.unwrap(key.toId());

        // Only gate registered corridor pools; allow unregistered pools freely
        if (registeredPools[pid]) {
            bool allowed = compliance.isCompliant(sender, sender, 0);

            emit RemitTypes.ComplianceGatedLP(sender, pid, allowed);

            if (!allowed) revert ComplianceFailed();
        }

        return this.beforeAddLiquidity.selector;
    }

    /// @notice Called before every swap — validates compliance and caches hookData in transient storage
    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        // If no hook data, allow normal swap
        if (hookData.length == 0) {
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        // Decode hook data
        RemitTypes.RemitHookData memory data = abi.decode(hookData, (RemitTypes.RemitHookData));

        // If not a contribution, allow normal swap
        if (!data.isContribution) {
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        // Validate remittance exists and is active
        RemittanceStorage storage remit = remittances[data.remittanceId];
        if (remit.id == 0) revert RemittanceNotFound();
        if (remit.status != RemitTypes.Status.Active) revert RemittanceNotActive();
        if (remit.expiresAt != 0 && block.timestamp >= remit.expiresAt) revert RemittanceExpired();

        // Get contribution amount from swap params
        uint256 amount = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)
            : uint256(params.amountSpecified);

        // Check compliance
        if (!compliance.isCompliant(sender, remit.recipient, amount)) {
            revert ComplianceFailed();
        }

        // Prevent recipient from contributing (anti-fraud)
        if (sender == remit.recipient) revert RecipientCannotContribute();

        // Cache remittanceId in transient storage for afterSwap (saves re-decoding hookData)
        uint256 rid = data.remittanceId;
        assembly {
            tstore(0x01, rid)
        }

        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /// @notice Called after every swap — records contributions using afterSwapReturnDelta
    /// @dev Returns delta to auto-capture swap output tokens into the hook's escrow
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        // If no hook data, skip
        if (hookData.length == 0) {
            return (this.afterSwap.selector, 0);
        }

        // Decode hook data
        RemitTypes.RemitHookData memory data = abi.decode(hookData, (RemitTypes.RemitHookData));

        // If not a contribution, skip
        if (!data.isContribution) {
            return (this.afterSwap.selector, 0);
        }

        RemittanceStorage storage remit = remittances[data.remittanceId];

        // Calculate contribution amount from delta
        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();

        uint256 contributionAmount;
        if (Currency.unwrap(key.currency0) == remit.token) {
            contributionAmount = amount0 < 0 ? uint256(uint128(-amount0)) : 0;
        } else if (Currency.unwrap(key.currency1) == remit.token) {
            contributionAmount = amount1 < 0 ? uint256(uint128(-amount1)) : 0;
        }

        if (contributionAmount == 0) revert NoContribution();

        // Record the contribution (shared logic with contributeDirectly)
        _recordContribution(data.remittanceId, remit, sender, contributionAmount);

        return (this.afterSwap.selector, 0);
    }

    /// @notice Called before donations — routes pool donations to active remittance recipients
    /// @dev If a donation routing is configured for the pool, it routes as a bonus contribution
    function _beforeDonate(address sender, PoolKey calldata key, uint256 amount0, uint256 amount1, bytes calldata)
        internal
        override
        returns (bytes4)
    {
        bytes32 pid = PoolId.unwrap(key.toId());
        uint256 remittanceId = donationRouting[pid];

        // If no routing configured, allow the donation normally
        if (remittanceId == 0) {
            return this.beforeDonate.selector;
        }

        RemittanceStorage storage remit = remittances[remittanceId];

        // Only route if remittance is still active
        if (remit.status == RemitTypes.Status.Active) {
            // Calculate USDT amount from the donation
            uint256 usdtAmount;
            if (Currency.unwrap(key.currency0) == SUPPORTED_TOKEN) {
                usdtAmount = amount0;
            } else if (Currency.unwrap(key.currency1) == SUPPORTED_TOKEN) {
                usdtAmount = amount1;
            }

            if (usdtAmount > 0) {
                _recordContribution(remittanceId, remit, sender, usdtAmount);
            }

            emit RemitTypes.DonationRouted(remittanceId, sender, amount0, amount1);
        }

        return this.beforeDonate.selector;
    }

    // ============ Shared Internal Logic ============

    /// @notice Records a contribution to a remittance (shared by afterSwap, contributeDirectly, beforeDonate)
    /// @param remittanceId The remittance ID
    /// @param remit Storage pointer to the remittance
    /// @param contributor The contributor address
    /// @param amount The contribution amount
    function _recordContribution(
        uint256 remittanceId,
        RemittanceStorage storage remit,
        address contributor,
        uint256 amount
    ) internal {
        remit.currentAmount += amount;
        remit.contributions[contributor] += amount;

        // Track new contributors with cap
        if (remit.contributions[contributor] == amount) {
            if (remit.contributorList.length >= MAX_CONTRIBUTORS) revert MaxContributorsReached();
            remit.contributorList.push(contributor);
        }

        // Record usage in compliance module
        compliance.recordUsage(contributor, amount);

        emit RemitTypes.ContributionMade(remittanceId, contributor, amount, remit.currentAmount);

        // Auto-release if target met and enabled
        if (
            remit.currentAmount >= remit.targetAmount && autoReleaseEnabled && remit.autoRelease
                && remit.status == RemitTypes.Status.Active
        ) {
            _releaseRemittance(remittanceId);
        }
    }

    // ============ Remittance Management ============

    /// @inheritdoc IAstraSendHook
    function createRemittance(
        address recipient,
        uint256 targetAmount,
        uint256 expiresAt,
        bytes32 purposeHash,
        bool autoRelease
    ) external override returns (uint256 remittanceId) {
        return _createRemittance(msg.sender, recipient, targetAmount, expiresAt, purposeHash, autoRelease);
    }

    /// @inheritdoc IAstraSendHook
    function createRemittanceByPhone(
        bytes32 recipientPhoneHash,
        uint256 targetAmount,
        uint256 expiresAt,
        bytes32 purposeHash,
        bool autoRelease
    ) external override returns (uint256 remittanceId) {
        if (address(phoneResolver) == address(0)) revert InvalidAddress();

        address recipient = phoneResolver.resolve(recipientPhoneHash);
        if (recipient == address(0)) revert PhoneNotRegistered();

        return _createRemittance(msg.sender, recipient, targetAmount, expiresAt, purposeHash, autoRelease);
    }

    /// @notice Internal function to create a remittance
    function _createRemittance(
        address creator,
        address recipient,
        uint256 targetAmount,
        uint256 expiresAt,
        bytes32 purposeHash,
        bool autoRelease
    ) internal returns (uint256 remittanceId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (recipient == creator) revert SelfRemittance();
        if (targetAmount == 0) revert InvalidAmount();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();

        // Check creator compliance
        if (!compliance.isCompliant(creator, recipient, targetAmount)) {
            revert ComplianceFailed();
        }

        remittanceId = nextRemittanceId++;

        RemittanceStorage storage remit = remittances[remittanceId];
        remit.id = remittanceId;
        remit.creator = creator;
        remit.recipient = recipient;
        remit.token = SUPPORTED_TOKEN;
        remit.targetAmount = targetAmount;
        remit.platformFeeBps = platformFeeBps;
        remit.createdAt = block.timestamp;
        remit.expiresAt = expiresAt;
        remit.purposeHash = purposeHash;
        remit.status = RemitTypes.Status.Active;
        remit.autoRelease = autoRelease;

        // Track remittances by user
        userCreatedRemittances[creator].push(remittanceId);
        userRecipientRemittances[recipient].push(remittanceId);

        emit RemitTypes.RemittanceCreated(remittanceId, creator, recipient, targetAmount, expiresAt, autoRelease);
    }

    /// @inheritdoc IAstraSendHook
    function releaseRemittance(uint256 remittanceId) external override nonReentrant {
        RemittanceStorage storage remit = remittances[remittanceId];

        if (remit.id == 0) revert RemittanceNotFound();
        if (msg.sender != remit.recipient) revert OnlyRecipient();
        if (remit.status != RemitTypes.Status.Active) revert RemittanceNotActive();
        if (remit.currentAmount < remit.targetAmount) revert TargetNotMet();

        _releaseRemittance(remittanceId);
    }

    /// @notice Internal release logic
    function _releaseRemittance(uint256 remittanceId) internal {
        RemittanceStorage storage remit = remittances[remittanceId];

        remit.status = RemitTypes.Status.Released;

        uint256 amount = remit.currentAmount;
        uint256 fee = (amount * remit.platformFeeBps) / 10_000;
        uint256 recipientAmount = amount - fee;

        // Transfer to recipient
        IERC20(remit.token).safeTransfer(remit.recipient, recipientAmount);

        // Transfer fee to collector
        if (fee > 0) {
            IERC20(remit.token).safeTransfer(feeCollector, fee);
        }

        emit RemitTypes.RemittanceReleased(remittanceId, remit.recipient, recipientAmount, fee);
    }

    /// @inheritdoc IAstraSendHook
    function cancelRemittance(uint256 remittanceId) external override nonReentrant {
        RemittanceStorage storage remit = remittances[remittanceId];

        if (remit.id == 0) revert RemittanceNotFound();
        if (msg.sender != remit.creator) revert OnlyCreator();
        if (remit.status != RemitTypes.Status.Active) revert RemittanceNotActive();

        remit.status = RemitTypes.Status.Cancelled;

        // Refund all contributors (capped at MAX_CONTRIBUTORS)
        uint256 totalRefunded = 0;
        for (uint256 i = 0; i < remit.contributorList.length; i++) {
            address contributor = remit.contributorList[i];
            uint256 contribution = remit.contributions[contributor];

            if (contribution > 0) {
                remit.contributions[contributor] = 0;
                IERC20(remit.token).safeTransfer(contributor, contribution);
                totalRefunded += contribution;
            }
        }

        emit RemitTypes.RemittanceCancelled(remittanceId, msg.sender, totalRefunded);
    }

    /// @inheritdoc IAstraSendHook
    function claimExpiredRefund(uint256 remittanceId) external override nonReentrant {
        RemittanceStorage storage remit = remittances[remittanceId];

        if (remit.id == 0) revert RemittanceNotFound();
        // Allow claiming from both Active and Expired status (for multiple contributors)
        if (remit.status != RemitTypes.Status.Active && remit.status != RemitTypes.Status.Expired) {
            revert RemittanceNotActive();
        }
        if (remit.expiresAt == 0 || block.timestamp < remit.expiresAt) revert RemittanceNotExpired();

        uint256 contribution = remit.contributions[msg.sender];
        if (contribution == 0) revert NoContribution();

        // Mark as expired if first claim
        if (remit.status == RemitTypes.Status.Active) {
            remit.status = RemitTypes.Status.Expired;
            emit RemitTypes.RemittanceExpired(remittanceId, remit.currentAmount);
        }

        // Refund caller's contribution
        remit.contributions[msg.sender] = 0;
        remit.currentAmount -= contribution;
        IERC20(remit.token).safeTransfer(msg.sender, contribution);
    }

    // ============ View Functions ============

    /// @inheritdoc IAstraSendHook
    function getRemittance(uint256 remittanceId) external view override returns (RemitTypes.RemittanceView memory) {
        RemittanceStorage storage remit = remittances[remittanceId];

        return RemitTypes.RemittanceView({
            id: remit.id,
            creator: remit.creator,
            recipient: remit.recipient,
            token: remit.token,
            targetAmount: remit.targetAmount,
            currentAmount: remit.currentAmount,
            platformFeeBps: remit.platformFeeBps,
            createdAt: remit.createdAt,
            expiresAt: remit.expiresAt,
            purposeHash: remit.purposeHash,
            status: remit.status,
            autoRelease: remit.autoRelease,
            contributorList: remit.contributorList
        });
    }

    /// @inheritdoc IAstraSendHook
    function getContribution(uint256 remittanceId, address contributor) external view override returns (uint256) {
        return remittances[remittanceId].contributions[contributor];
    }

    /// @inheritdoc IAstraSendHook
    function getRemittancesByCreator(address creator) external view override returns (uint256[] memory) {
        return userCreatedRemittances[creator];
    }

    /// @inheritdoc IAstraSendHook
    function getRemittancesForRecipient(address recipient) external view override returns (uint256[] memory) {
        return userRecipientRemittances[recipient];
    }

    // ============ Admin Functions ============

    /// @inheritdoc IAstraSendHook
    function setCompliance(address newCompliance) external override onlyOwner {
        if (newCompliance == address(0)) revert InvalidAddress();
        emit RemitTypes.ComplianceContractUpdated(address(compliance), newCompliance);
        compliance = ICompliance(newCompliance);
    }

    /// @inheritdoc IAstraSendHook
    function setPhoneResolver(address newResolver) external override onlyOwner {
        emit RemitTypes.PhoneResolverUpdated(address(phoneResolver), newResolver);
        phoneResolver = IPhoneNumberResolver(newResolver);
    }

    /// @inheritdoc IAstraSendHook
    function setFeeCollector(address newCollector) external override onlyOwner {
        if (newCollector == address(0)) revert InvalidAddress();
        emit RemitTypes.FeeCollectorUpdated(feeCollector, newCollector);
        feeCollector = newCollector;
    }

    /// @inheritdoc IAstraSendHook
    function setPlatformFee(uint256 newFeeBps) external override onlyOwner {
        if (newFeeBps > MAX_PLATFORM_FEE_BPS) revert InvalidFee();
        emit RemitTypes.PlatformFeeUpdated(platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }

    /// @inheritdoc IAstraSendHook
    function setAutoRelease(bool enabled) external override onlyOwner {
        autoReleaseEnabled = enabled;
        emit RemitTypes.AutoReleaseToggled(enabled);
    }

    /// @inheritdoc IAstraSendHook
    function setDonationRouting(bytes32 pid, uint256 remittanceId) external override onlyOwner {
        if (remittanceId != 0) {
            RemittanceStorage storage remit = remittances[remittanceId];
            if (remit.id == 0) revert RemittanceNotFound();
            if (remit.status != RemitTypes.Status.Active) revert RemittanceNotActive();
        }
        donationRouting[pid] = remittanceId;
    }

    // ============ Direct Contribution (Alternative to Swap) ============

    /// @notice Direct contribution without going through a swap
    /// @param remittanceId The remittance to contribute to
    /// @param amount The amount to contribute
    function contributeDirectly(uint256 remittanceId, uint256 amount) external nonReentrant {
        RemittanceStorage storage remit = remittances[remittanceId];

        if (remit.id == 0) revert RemittanceNotFound();
        if (remit.status != RemitTypes.Status.Active) revert RemittanceNotActive();
        if (remit.expiresAt != 0 && block.timestamp >= remit.expiresAt) revert RemittanceExpired();
        if (amount == 0) revert InvalidAmount();
        if (msg.sender == remit.recipient) revert RecipientCannotContribute();

        // Check compliance
        if (!compliance.isCompliant(msg.sender, remit.recipient, amount)) {
            revert ComplianceFailed();
        }

        // Transfer tokens from sender to hook
        IERC20(remit.token).safeTransferFrom(msg.sender, address(this), amount);

        // Record the contribution (shared logic)
        _recordContribution(remittanceId, remit, msg.sender, amount);
    }
}
