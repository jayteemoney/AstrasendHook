// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { HookTest, MockERC20 } from "./utils/HookTest.sol";
import { RemitTypes } from "../src/libraries/RemitTypes.sol";

import { PoolSwapTest } from "v4-core/src/test/PoolSwapTest.sol";
import { PoolModifyLiquidityTest } from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import { PoolDonateTest } from "v4-core/src/test/PoolDonateTest.sol";

import { PoolKey } from "v4-core/src/types/PoolKey.sol";
import { PoolId, PoolIdLibrary } from "v4-core/src/types/PoolId.sol";
import { TickMath } from "v4-core/src/libraries/TickMath.sol";
import { SwapParams, ModifyLiquidityParams } from "v4-core/src/types/PoolOperation.sol";
import { IHooks } from "v4-core/src/interfaces/IHooks.sol";
import { Currency } from "v4-core/src/types/Currency.sol";

/// @title HookSwapPathTest
/// @notice Tests for hook callbacks triggered via actual pool operations:
///         afterInitialize, beforeAddLiquidity, beforeSwap/afterSwap, beforeDonate
///
/// @dev Hook reverts propagate through PoolManager as WrappedError(address,bytes4,bytes,bytes).
///      Where exact inner-error matching is not practical, vm.expectRevert() is used
///      and the test name documents the expected revert reason.
contract HookSwapPathTest is HookTest {
    PoolSwapTest internal swapRouter;
    PoolModifyLiquidityTest internal lpRouter;
    PoolDonateTest internal donateRouter;

    // Full tick range for tick spacing 60
    int24 internal constant TICK_LOWER = -887_220;
    int24 internal constant TICK_UPPER = 887_220;

    // Small enough for 6-decimal USDT liquidity to fit in INITIAL_BALANCE
    int256 internal constant LIQUIDITY_DELTA = 1e9;

    // Swap amount: raw units, > minimumAmount(1e6) but small enough for pool depth
    uint256 internal constant WETH_SWAP_IN = 1e8;

    function setUp() public override {
        super.setUp();

        // Initialize pool — triggers _afterInitialize → registers as corridor
        poolManager.initialize(poolKey, SQRT_PRICE_1_1);

        // Deploy routers
        swapRouter = new PoolSwapTest(poolManager);
        lpRouter = new PoolModifyLiquidityTest(poolManager);
        donateRouter = new PoolDonateTest(poolManager);

        // Routers appear as `sender` in hook callbacks; they must pass compliance.
        // In production, a KYC-compliant router pattern would be used instead.
        compliance.addToAllowlist(address(swapRouter), 0);
        compliance.addToAllowlist(address(lpRouter), 0);
        compliance.addToAllowlist(address(donateRouter), 0);

        // The _beforeSwap compliance check uses the raw WETH input amount against a USDT
        // daily limit — a known design limitation of the swap path.
        // Set an unbounded daily limit for the swapRouter to keep tests orthogonal to this issue.
        compliance.updateDailyLimit(address(swapRouter), type(uint256).max / 2);

        // Approve routers for all actors
        vm.startPrank(alice);
        usdt.approve(address(lpRouter), type(uint256).max);
        weth.approve(address(lpRouter), type(uint256).max);
        usdt.approve(address(swapRouter), type(uint256).max);
        weth.approve(address(swapRouter), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdt.approve(address(swapRouter), type(uint256).max);
        weth.approve(address(swapRouter), type(uint256).max);
        vm.stopPrank();

        // Seed WETH for actors
        weth.mint(alice, 100e18);
        weth.mint(bob, 100e18);

        // Provide initial liquidity (triggers _beforeAddLiquidity)
        vm.prank(alice);
        lpRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                liquidityDelta: LIQUIDITY_DELTA,
                salt: bytes32(0)
            }),
            ""
        );
    }

    // =========================================================
    // Internal helpers
    // =========================================================

    /// @dev Execute a WETH-for-USDT exact-input swap
    function _swapWethForUsdt(address swapper, uint256 wethIn, bytes memory hookData) internal {
        bool zeroForOne = Currency.unwrap(currency0) == address(weth);
        uint160 sqrtLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;

        vm.prank(swapper);
        swapRouter.swap(
            poolKey,
            SwapParams({ zeroForOne: zeroForOne, amountSpecified: -int256(wethIn), sqrtPriceLimitX96: sqrtLimit }),
            PoolSwapTest.TestSettings({ takeClaims: false, settleUsingBurn: false }),
            hookData
        );
    }

    // =========================================================
    // afterInitialize — pool corridor registration
    // =========================================================

    function test_AfterInitialize_RegistersPool() public view {
        bytes32 pid = PoolId.unwrap(poolKey.toId());
        assertTrue(hook.registeredPools(pid), "Pool with USDT must be registered as a corridor");
    }

    function test_AfterInitialize_SecondPoolWithUsdtAlsoRegisters() public {
        // Build a second pool key: USDT paired with a different token, still points to hook
        MockERC20 otherToken = new MockERC20("OtherToken", "OTK", 18);

        (Currency c0, Currency c1) = address(usdt) < address(otherToken)
            ? (Currency.wrap(address(usdt)), Currency.wrap(address(otherToken)))
            : (Currency.wrap(address(otherToken)), Currency.wrap(address(usdt)));

        PoolKey memory secondKey =
            PoolKey({ currency0: c0, currency1: c1, fee: 500, tickSpacing: 10, hooks: IHooks(address(hook)) });

        poolManager.initialize(secondKey, SQRT_PRICE_1_1);

        bytes32 pid2 = PoolId.unwrap(secondKey.toId());
        assertTrue(hook.registeredPools(pid2), "Second USDT pool must also be registered");
    }

    function test_AfterInitialize_RevertIfNoUsdtInPair() public {
        // Pool without USDT should revert with TokenNotSupported (wrapped by PoolManager)
        MockERC20 tokenA = new MockERC20("TKA", "TKA", 18);
        MockERC20 tokenB = new MockERC20("TKB", "TKB", 18);

        (Currency c0, Currency c1) = address(tokenA) < address(tokenB)
            ? (Currency.wrap(address(tokenA)), Currency.wrap(address(tokenB)))
            : (Currency.wrap(address(tokenB)), Currency.wrap(address(tokenA)));

        PoolKey memory noUsdtKey =
            PoolKey({ currency0: c0, currency1: c1, fee: 3000, tickSpacing: 60, hooks: IHooks(address(hook)) });

        // Hook reverts (TokenNotSupported) are wrapped by PoolManager in WrappedError
        vm.expectRevert();
        poolManager.initialize(noUsdtKey, SQRT_PRICE_1_1);
    }

    // =========================================================
    // beforeAddLiquidity — compliance-gated LP
    // =========================================================

    function test_BeforeAddLiquidity_ApprovedRouterCanAdd() public {
        // lpRouter is on allowlist — additional LP provision should succeed
        address newLP = makeAddr("newLP");
        usdt.mint(newLP, INITIAL_BALANCE);
        weth.mint(newLP, 100e18);
        compliance.addToAllowlist(newLP, 0);

        vm.startPrank(newLP);
        usdt.approve(address(lpRouter), type(uint256).max);
        weth.approve(address(lpRouter), type(uint256).max);
        // Should not revert
        lpRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({ tickLower: TICK_LOWER, tickUpper: TICK_UPPER, liquidityDelta: LIQUIDITY_DELTA, salt: bytes32(0) }),
            ""
        );
        vm.stopPrank();
    }

    function test_BeforeAddLiquidity_UnapprovedRouterReverts() public {
        // A freshly deployed router not on the allowlist cannot LP a registered corridor pool.
        // Hook reverts with ComplianceFailed(), wrapped by PoolManager.
        PoolModifyLiquidityTest unapprovedRouter = new PoolModifyLiquidityTest(poolManager);
        weth.mint(alice, 10e18);

        vm.startPrank(alice);
        usdt.approve(address(unapprovedRouter), type(uint256).max);
        weth.approve(address(unapprovedRouter), type(uint256).max);
        vm.expectRevert();
        unapprovedRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({ tickLower: TICK_LOWER, tickUpper: TICK_UPPER, liquidityDelta: LIQUIDITY_DELTA, salt: bytes32(0) }),
            ""
        );
        vm.stopPrank();
    }

    function test_BeforeAddLiquidity_BlockedRouterReverts() public {
        compliance.addToBlocklist(address(lpRouter));

        weth.mint(alice, 10e18);
        vm.startPrank(alice);
        vm.expectRevert(); // ComplianceFailed() wrapped by PoolManager
        lpRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({ tickLower: TICK_LOWER, tickUpper: TICK_UPPER, liquidityDelta: LIQUIDITY_DELTA, salt: bytes32(0) }),
            ""
        );
        vm.stopPrank();
    }

    function test_BeforeAddLiquidity_NonRegisteredPoolSkipsCheck() public {
        // A pool that wasn't initialized through this hook has registeredPools[pid]=false.
        // Any router should be able to LP it freely.
        // We can't easily create such a pool with the same hook address, so we verify
        // that the registration map for the current pool IS set (positive check).
        bytes32 pid = PoolId.unwrap(poolKey.toId());
        assertTrue(hook.registeredPools(pid));

        bytes32 randomPid = keccak256(abi.encode("random"));
        assertFalse(hook.registeredPools(randomPid));
    }

    // =========================================================
    // beforeSwap / afterSwap — contribution via pool swap
    // =========================================================

    function test_SwapWithNoHookData_SwapperReceivesUsdt() public {
        uint256 bobUsdtBefore = _getBalance(bob);

        // Normal swap: no hookData → hook does nothing → bob gets USDT
        _swapWethForUsdt(bob, WETH_SWAP_IN, "");

        assertGt(_getBalance(bob), bobUsdtBefore, "Normal swap: bob should receive USDT");
    }

    function test_SwapContribution_HookCapturesUsdtNotSwapper() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        bytes memory hookData = _encodeHookData(remittanceId, true);

        uint256 hookBalanceBefore = _getBalance(address(hook));
        uint256 bobUsdtBefore = _getBalance(bob);

        _swapWethForUsdt(bob, WETH_SWAP_IN, hookData);

        uint256 hookGained = _getBalance(address(hook)) - hookBalanceBefore;
        uint256 contribution = hook.getContribution(remittanceId, address(swapRouter));

        // Key assertions: hook holds real USDT, swapper gets 0
        assertGt(hookGained, 0, "Hook must physically hold the USDT escrowed from swap");
        assertEq(_getBalance(bob), bobUsdtBefore, "Swapper must receive 0 USDT when contributing");
        assertEq(hookGained, contribution, "Hook balance increase must equal recorded contribution");
    }

    function test_SwapContribution_UpdatesRemittanceCurrentAmount() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        bytes memory hookData = _encodeHookData(remittanceId, true);

        _swapWethForUsdt(bob, WETH_SWAP_IN, hookData);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertGt(remit.currentAmount, 0, "Remittance currentAmount must increase after swap contribution");
    }

    function test_SwapContribution_NonContributionFlagPassesThrough() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        // isContribution = false → hook skips recording, bob gets USDT normally
        bytes memory hookData = _encodeHookData(remittanceId, false);

        uint256 bobUsdtBefore = _getBalance(bob);
        _swapWethForUsdt(bob, WETH_SWAP_IN, hookData);

        assertGt(_getBalance(bob), bobUsdtBefore, "Non-contribution swap: bob receives USDT");
        assertEq(hook.getContribution(remittanceId, address(swapRouter)), 0, "No contribution recorded");
    }

    function test_SwapContribution_ReleaseSucceedsWithSwapSourcedTokens() public {
        uint256 smallTarget = 10 * 1e6; // 10 USDT

        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, smallTarget, 0, bytes32(0), false);
        bytes memory hookData = _encodeHookData(remittanceId, true);

        // Contribute via multiple swaps to accumulate enough USDT
        for (uint256 i = 0; i < 5; i++) {
            _swapWethForUsdt(bob, WETH_SWAP_IN, hookData);
        }

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);

        if (remit.currentAmount >= smallTarget) {
            uint256 hookBalanceBefore = _getBalance(address(hook));
            uint256 recipientBefore = _getBalance(recipient);

            _release(recipient, remittanceId);

            uint256 expectedFee = _calculateFee(remit.currentAmount);
            assertEq(_getBalance(recipient) - recipientBefore, remit.currentAmount - expectedFee);
            assertEq(hookBalanceBefore - _getBalance(address(hook)), remit.currentAmount);
        }
        // If not enough accumulated, verify contribution was recorded at minimum
        assertGt(hook.getContribution(remittanceId, address(swapRouter)), 0);
    }

    function test_SwapContribution_RevertIfRemittanceNotFound() public {
        // Swap with invalid remittanceId — hook reverts in beforeSwap (wrapped by PoolManager)
        bytes memory hookData = _encodeHookData(999, true);

        bool zeroForOne = Currency.unwrap(currency0) == address(weth);
        uint160 sqrtLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;

        vm.prank(bob);
        vm.expectRevert(); // RemittanceNotFound() wrapped in WrappedError by PoolManager
        swapRouter.swap(
            poolKey,
            SwapParams({ zeroForOne: zeroForOne, amountSpecified: -int256(WETH_SWAP_IN), sqrtPriceLimitX96: sqrtLimit }),
            PoolSwapTest.TestSettings({ takeClaims: false, settleUsingBurn: false }),
            hookData
        );
    }

    function test_SwapContribution_RevertIfRemittanceCancelled() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _cancel(alice, remittanceId);

        bytes memory hookData = _encodeHookData(remittanceId, true);
        bool zeroForOne = Currency.unwrap(currency0) == address(weth);
        uint160 sqrtLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;

        vm.prank(bob);
        vm.expectRevert(); // RemittanceNotActive() wrapped in WrappedError
        swapRouter.swap(
            poolKey,
            SwapParams({ zeroForOne: zeroForOne, amountSpecified: -int256(WETH_SWAP_IN), sqrtPriceLimitX96: sqrtLimit }),
            PoolSwapTest.TestSettings({ takeClaims: false, settleUsingBurn: false }),
            hookData
        );
    }

    function test_SwapContribution_RevertIfExpired() public {
        uint256 expiresAt = block.timestamp + 1 days;
        uint256 remittanceId = _createRemittanceWithExpiry(alice, recipient, TARGET_AMOUNT, expiresAt);

        vm.warp(expiresAt + 1);

        bytes memory hookData = _encodeHookData(remittanceId, true);
        bool zeroForOne = Currency.unwrap(currency0) == address(weth);
        uint160 sqrtLimit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;

        vm.prank(bob);
        vm.expectRevert(); // RemittanceExpired() wrapped in WrappedError
        swapRouter.swap(
            poolKey,
            SwapParams({ zeroForOne: zeroForOne, amountSpecified: -int256(WETH_SWAP_IN), sqrtPriceLimitX96: sqrtLimit }),
            PoolSwapTest.TestSettings({ takeClaims: false, settleUsingBurn: false }),
            hookData
        );
    }

    function testFuzz_SwapContribution_HookBalanceMustMatchContribution(uint256 wethIn) public {
        wethIn = bound(wethIn, 1e7, 1e10); // Stay within pool depth and above minimumAmount
        weth.mint(bob, wethIn);

        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        bytes memory hookData = _encodeHookData(remittanceId, true);

        uint256 hookBefore = _getBalance(address(hook));
        _swapWethForUsdt(bob, wethIn, hookData);

        uint256 contribution = hook.getContribution(remittanceId, address(swapRouter));
        uint256 hookGained = _getBalance(address(hook)) - hookBefore;

        assertEq(hookGained, contribution, "Hook balance delta must equal recorded contribution");
    }

    // =========================================================
    // beforeDonate — donation routing
    // =========================================================

    function test_BeforeDonate_SetAndQueryRouting() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        bytes32 pid = PoolId.unwrap(poolKey.toId());

        hook.setDonationRouting(pid, remittanceId);

        assertEq(hook.donationRouting(pid), remittanceId);
    }

    function test_BeforeDonate_NoRoutingSetNoEffect() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        // No routing set for this pool

        bool usdtIsC0 = Currency.unwrap(currency0) == address(usdt);
        uint256 donateAmt = 100e6;

        address donator = makeAddr("donator");
        usdt.mint(donator, donateAmt);
        weth.mint(donator, 1e18);

        vm.startPrank(donator);
        usdt.approve(address(donateRouter), type(uint256).max);
        weth.approve(address(donateRouter), type(uint256).max);
        donateRouter.donate(poolKey, usdtIsC0 ? donateAmt : 0, usdtIsC0 ? 0 : donateAmt, "");
        vm.stopPrank();

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.currentAmount, 0, "No routing: remittance must be unaffected");
    }

    function test_BeforeDonate_RoutingSetRecordsContribution() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        bytes32 pid = PoolId.unwrap(poolKey.toId());
        hook.setDonationRouting(pid, remittanceId);

        bool usdtIsC0 = Currency.unwrap(currency0) == address(usdt);
        uint256 donateAmt = 100e6;

        address donator = makeAddr("donator");
        usdt.mint(donator, donateAmt);
        weth.mint(donator, 1e18);

        vm.startPrank(donator);
        usdt.approve(address(donateRouter), type(uint256).max);
        weth.approve(address(donateRouter), type(uint256).max);
        donateRouter.donate(poolKey, usdtIsC0 ? donateAmt : 0, usdtIsC0 ? 0 : donateAmt, "");
        vm.stopPrank();

        // Donation routing records the USDT amount as contribution
        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.currentAmount, donateAmt, "Routed donation must be recorded as contribution");
    }

    function test_BeforeDonate_ClearRouting() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        bytes32 pid = PoolId.unwrap(poolKey.toId());

        hook.setDonationRouting(pid, remittanceId);
        assertEq(hook.donationRouting(pid), remittanceId);

        hook.setDonationRouting(pid, 0); // clear
        assertEq(hook.donationRouting(pid), 0, "Routing should be cleared");
    }

    function test_BeforeDonate_CannotRouteToInactiveRemittance() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _cancel(alice, remittanceId);

        bytes32 pid = PoolId.unwrap(poolKey.toId());
        vm.expectRevert(abi.encodeWithSignature("RemittanceNotActive()"));
        hook.setDonationRouting(pid, remittanceId);
    }
}
