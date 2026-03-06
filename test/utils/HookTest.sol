// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Test } from "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

import { IPoolManager } from "v4-core/src/interfaces/IPoolManager.sol";
import { PoolManager } from "v4-core/src/PoolManager.sol";
import { PoolKey } from "v4-core/src/types/PoolKey.sol";
import { PoolId, PoolIdLibrary } from "v4-core/src/types/PoolId.sol";
import { Currency, CurrencyLibrary } from "v4-core/src/types/Currency.sol";
import { IHooks } from "v4-core/src/interfaces/IHooks.sol";
import { Hooks } from "v4-core/src/libraries/Hooks.sol";
import { TickMath } from "v4-core/src/libraries/TickMath.sol";
import { HookMiner } from "v4-periphery/src/utils/HookMiner.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { RemitSwapHook } from "../../src/RemitSwapHook.sol";
import { AllowlistCompliance } from "../../src/compliance/AllowlistCompliance.sol";
import { PhoneNumberResolver } from "../../src/compliance/PhoneNumberResolver.sol";
import { ICompliance } from "../../src/interfaces/ICompliance.sol";
import { IPhoneNumberResolver } from "../../src/interfaces/IPhoneNumberResolver.sol";
import { RemitTypes } from "../../src/libraries/RemitTypes.sol";

/// @title MockERC20
/// @notice Simple ERC20 token for testing (represents USDT)
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/// @title HookTest
/// @notice Base test contract for RemitSwapHook tests
abstract contract HookTest is Test {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    // ============ Constants ============

    uint256 internal constant INITIAL_BALANCE = 1_000_000 * 1e6; // 1M USDT
    uint256 internal constant TARGET_AMOUNT = 1_000 * 1e6; // 1,000 USDT
    uint256 internal constant CONTRIBUTION_AMOUNT = 100 * 1e6; // 100 USDT
    uint256 internal constant DEFAULT_DAILY_LIMIT = 10_000 * 1e6; // 10,000 USDT
    uint256 internal constant PLATFORM_FEE_BPS = 50; // 0.5%

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // sqrt(1) * 2^96

    // ============ Contracts ============

    IPoolManager internal poolManager;
    RemitSwapHook internal hook;
    AllowlistCompliance internal compliance;
    PhoneNumberResolver internal phoneResolver;

    MockERC20 internal usdt;
    MockERC20 internal weth;

    Currency internal currency0;
    Currency internal currency1;
    PoolKey internal poolKey;
    PoolId internal poolId;

    // ============ Test Addresses ============

    address internal alice;
    address internal bob;
    address internal charlie;
    address internal recipient;
    address internal feeCollector;
    address internal deployer;

    // ============ Setup ============

    function setUp() public virtual {
        // Create test addresses
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        recipient = makeAddr("recipient");
        feeCollector = makeAddr("feeCollector");
        deployer = address(this);

        // Deploy pool manager
        poolManager = new PoolManager(deployer);

        // Deploy tokens
        usdt = new MockERC20("Tether USD", "USDT", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);

        // Sort currencies
        if (address(usdt) < address(weth)) {
            currency0 = Currency.wrap(address(usdt));
            currency1 = Currency.wrap(address(weth));
        } else {
            currency0 = Currency.wrap(address(weth));
            currency1 = Currency.wrap(address(usdt));
        }

        // Deploy compliance
        compliance = new AllowlistCompliance();

        // Deploy phone resolver
        phoneResolver = new PhoneNumberResolver();

        // Deploy hook
        hook = _deployHook();

        // Wire up compliance
        compliance.setHook(address(hook));

        // Setup pool key
        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000, // 0.3%
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        poolId = poolKey.toId();

        // Fund test accounts
        _fundAccount(alice, INITIAL_BALANCE);
        _fundAccount(bob, INITIAL_BALANCE);
        _fundAccount(charlie, INITIAL_BALANCE);
        _fundAccount(recipient, 0); // Recipient starts with no funds

        // Add to allowlist
        compliance.addToAllowlist(alice, 0);
        compliance.addToAllowlist(bob, 0);
        compliance.addToAllowlist(charlie, 0);
        compliance.addToAllowlist(recipient, 0);

        // Approve hook for spending
        _approveHook(alice);
        _approveHook(bob);
        _approveHook(charlie);
    }

    // ============ Internal Helper Functions ============

    /// @notice Deploy the hook with the correct address encoding
    function _deployHook() internal returns (RemitSwapHook) {
        // Calculate the flags we need
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
                | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_DONATE_FLAG
        );

        // Prepare constructor arguments
        bytes memory constructorArgs =
            abi.encode(poolManager, compliance, phoneResolver, feeCollector, address(usdt), deployer);

        // Find a valid salt
        (address hookAddress, bytes32 salt) =
            HookMiner.find(deployer, flags, type(RemitSwapHook).creationCode, constructorArgs);

        // Deploy the hook
        RemitSwapHook newHook = new RemitSwapHook{ salt: salt }(
            poolManager,
            ICompliance(address(compliance)),
            IPhoneNumberResolver(address(phoneResolver)),
            feeCollector,
            address(usdt),
            deployer
        );

        require(address(newHook) == hookAddress, "Hook address mismatch");

        return newHook;
    }

    /// @notice Fund an account with USDT
    function _fundAccount(address account, uint256 amount) internal {
        usdt.mint(account, amount);
    }

    /// @notice Approve hook to spend USDT
    function _approveHook(address account) internal {
        vm.prank(account);
        usdt.approve(address(hook), type(uint256).max);
    }

    /// @notice Create a remittance for testing
    function _createRemittance(address creator, address to, uint256 targetAmount)
        internal
        returns (uint256 remittanceId)
    {
        vm.prank(creator);
        remittanceId = hook.createRemittance(to, targetAmount, 0, bytes32(0), true);
    }

    /// @notice Create a remittance with expiry
    function _createRemittanceWithExpiry(address creator, address to, uint256 targetAmount, uint256 expiresAt)
        internal
        returns (uint256 remittanceId)
    {
        vm.prank(creator);
        remittanceId = hook.createRemittance(to, targetAmount, expiresAt, bytes32(0), true);
    }

    /// @notice Contribute directly to a remittance
    function _contribute(address contributor, uint256 remittanceId, uint256 amount) internal {
        vm.prank(contributor);
        hook.contributeDirectly(remittanceId, amount);
    }

    /// @notice Release a remittance
    function _release(address caller, uint256 remittanceId) internal {
        vm.prank(caller);
        hook.releaseRemittance(remittanceId);
    }

    /// @notice Cancel a remittance
    function _cancel(address caller, uint256 remittanceId) internal {
        vm.prank(caller);
        hook.cancelRemittance(remittanceId);
    }

    /// @notice Get USDT balance
    function _getBalance(address account) internal view returns (uint256) {
        return usdt.balanceOf(account);
    }

    /// @notice Encode hook data for contribution
    function _encodeHookData(uint256 remittanceId, bool isContribution) internal pure returns (bytes memory) {
        return abi.encode(RemitTypes.RemitHookData({ remittanceId: remittanceId, isContribution: isContribution }));
    }

    /// @notice Compute phone hash
    function _computePhoneHash(string memory phoneNumber) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(phoneNumber));
    }

    /// @notice Register a phone number
    function _registerPhone(string memory phoneNumber, address wallet) internal {
        phoneResolver.registerPhoneString(phoneNumber, wallet);
    }

    /// @notice Calculate expected fee
    function _calculateFee(uint256 amount) internal pure returns (uint256) {
        return (amount * PLATFORM_FEE_BPS) / 10_000;
    }
}
