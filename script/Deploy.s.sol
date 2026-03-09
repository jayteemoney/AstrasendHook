// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script, console } from "forge-std/Script.sol";
import { IPoolManager } from "v4-core/src/interfaces/IPoolManager.sol";
import { Hooks } from "v4-core/src/libraries/Hooks.sol";
import { HookMiner } from "v4-periphery/src/utils/HookMiner.sol";

import { AstraSendHook } from "../src/AstraSendHook.sol";
import { AllowlistCompliance } from "../src/compliance/AllowlistCompliance.sol";
import { WorldcoinCompliance } from "../src/compliance/WorldcoinCompliance.sol";
import { PhoneNumberResolver } from "../src/compliance/PhoneNumberResolver.sol";
import { ICompliance } from "../src/interfaces/ICompliance.sol";
import { IPhoneNumberResolver } from "../src/interfaces/IPhoneNumberResolver.sol";
import { IWorldID } from "../src/interfaces/IWorldID.sol";

/// @title DeployAstraSendHook
/// @notice Deployment script for AstraSendHook and supporting contracts
/// @dev Run with: forge script script/Deploy.s.sol:DeployAstraSendHook --rpc-url <RPC_URL> --broadcast
contract DeployAstraSendHook is Script {
    /// @dev Foundry's deterministic CREATE2 deployer used during broadcast
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // ============ Deployment Configuration ============

    // Base Mainnet PoolManager
    address constant BASE_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;

    // Base Sepolia PoolManager
    address constant BASE_SEPOLIA_POOL_MANAGER = 0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829;

    // Unichain Mainnet PoolManager
    address constant UNICHAIN_POOL_MANAGER = 0x1F98400000000000000000000000000000000004;

    // Unichain Sepolia PoolManager
    address constant UNICHAIN_SEPOLIA_POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;

    // USDT on Base
    address constant BASE_USDT = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2;

    // USDC on Base (alternative stablecoin)
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    // World ID Router on Optimism (used for World ID verification)
    // Note: World ID is not natively on Base; bridge integration or Optimism deployment required
    address constant OPTIMISM_WORLD_ID_ROUTER = 0x57f928158C3EE7CDad1e4D8642503c4D0201f611;

    // ============ Deployment State ============

    ICompliance public compliance;
    PhoneNumberResolver public phoneResolver;
    AstraSendHook public hook;

    // ============ Main Deployment Function ============

    function run() external virtual {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeCollector = vm.envOr("FEE_COLLECTOR", vm.addr(deployerPrivateKey));

        // Determine network and set pool manager
        address poolManager;
        address supportedToken;

        uint256 chainId = block.chainid;
        if (chainId == 8453) {
            // Base Mainnet
            poolManager = BASE_POOL_MANAGER;
            supportedToken = BASE_USDT;
            console.log("Deploying to Base Mainnet");
        } else if (chainId == 84532) {
            // Base Sepolia
            poolManager = BASE_SEPOLIA_POOL_MANAGER;
            supportedToken = vm.envOr("SUPPORTED_TOKEN", address(0));
            require(supportedToken != address(0), "Set SUPPORTED_TOKEN for testnet");
            console.log("Deploying to Base Sepolia");
        } else if (chainId == 130) {
            // Unichain Mainnet
            poolManager = UNICHAIN_POOL_MANAGER;
            supportedToken = vm.envAddress("SUPPORTED_TOKEN");
            console.log("Deploying to Unichain Mainnet");
        } else if (chainId == 1301) {
            // Unichain Sepolia
            poolManager = UNICHAIN_SEPOLIA_POOL_MANAGER;
            supportedToken = vm.envOr("SUPPORTED_TOKEN", address(0));
            require(supportedToken != address(0), "Set SUPPORTED_TOKEN for testnet");
            console.log("Deploying to Unichain Sepolia");
        } else {
            // Local or custom network
            poolManager = vm.envAddress("POOL_MANAGER");
            supportedToken = vm.envAddress("SUPPORTED_TOKEN");
            console.log("Deploying to custom network:", chainId);
        }

        console.log("Pool Manager:", poolManager);
        console.log("Supported Token:", supportedToken);
        console.log("Fee Collector:", feeCollector);

        // Determine compliance type
        string memory complianceType = vm.envOr("COMPLIANCE_TYPE", string("allowlist"));

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Compliance module (allowlist or worldcoin)
        if (keccak256(bytes(complianceType)) == keccak256("worldcoin")) {
            address worldIdRouter = vm.envOr("WORLD_ID_ROUTER", OPTIMISM_WORLD_ID_ROUTER);
            string memory worldAppId = vm.envOr("WORLD_APP_ID", string("astrasend"));
            WorldcoinCompliance worldcoinCompliance = new WorldcoinCompliance(
                IWorldID(worldIdRouter),
                worldAppId
            );
            compliance = ICompliance(address(worldcoinCompliance));
            console.log("WorldcoinCompliance deployed at:", address(compliance));
        } else {
            AllowlistCompliance allowlistCompliance = new AllowlistCompliance();
            compliance = ICompliance(address(allowlistCompliance));
            console.log("AllowlistCompliance deployed at:", address(compliance));
        }

        // 2. Deploy PhoneNumberResolver
        phoneResolver = new PhoneNumberResolver();
        console.log("PhoneNumberResolver deployed at:", address(phoneResolver));

        // 3. Deploy AstraSendHook with address mining
        address deployer = vm.addr(deployerPrivateKey);
        hook = _deployHook(IPoolManager(poolManager), feeCollector, supportedToken, deployer);
        console.log("AstraSendHook deployed at:", address(hook));

        // 4. Configure compliance to accept hook
        if (keccak256(bytes(complianceType)) == keccak256("worldcoin")) {
            WorldcoinCompliance(address(compliance)).setHook(address(hook));
            console.log("WorldcoinCompliance configured with hook");
            console.log("Note: Users must verify via World ID before transacting");
        } else {
            AllowlistCompliance(address(compliance)).setHook(address(hook));
            AllowlistCompliance(address(compliance)).addToAllowlist(vm.addr(deployerPrivateKey), 0);
            console.log("AllowlistCompliance configured with hook");
            console.log("Deployer added to allowlist");
        }

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n========== DEPLOYMENT SUMMARY ==========");
        console.log("Chain ID:", chainId);
        console.log("Compliance Type:", complianceType);
        console.log("Compliance:", address(compliance));
        console.log("PhoneNumberResolver:", address(phoneResolver));
        console.log("AstraSendHook:", address(hook));
        console.log("=========================================\n");
    }

    // ============ Hook Deployment with Address Mining ============

    function _deployHook(IPoolManager poolManager, address feeCollector, address supportedToken, address initialOwner)
        internal
        returns (AstraSendHook)
    {
        // Calculate required flags for hook permissions
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
                | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_DONATE_FLAG
        );

        // Prepare constructor arguments
        bytes memory constructorArgs =
            abi.encode(poolManager, compliance, phoneResolver, feeCollector, supportedToken, initialOwner);

        // Find a valid salt that produces an address with correct flags
        console.log("Mining hook address with flags:", flags);

        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(AstraSendHook).creationCode, constructorArgs);

        console.log("Found valid hook address:", hookAddress);
        console.log("Using salt:", vm.toString(salt));

        // Deploy the hook at the computed address
        AstraSendHook newHook = new AstraSendHook{ salt: salt }(
            poolManager,
            ICompliance(address(compliance)),
            IPhoneNumberResolver(address(phoneResolver)),
            feeCollector,
            supportedToken,
            initialOwner
        );

        // Verify deployment address matches computed address
        require(address(newHook) == hookAddress, "Hook address mismatch!");

        return newHook;
    }
}

/// @title MockUSDT
/// @notice Simple ERC20 for testnet deployment (no real USDT on Base Sepolia)
contract MockUSDT {
    string public name = "Mock USDT";
    string public symbol = "USDT";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/// @title DeployToBaseSepolia
/// @notice Convenience script for Base Sepolia testnet deployment
/// @dev Deploys a MockUSDT automatically since real USDT doesn't exist on testnet
/// Run with: forge script script/Deploy.s.sol:DeployToBaseSepolia --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
contract DeployToBaseSepolia is Script {
    /// @dev Foundry's deterministic CREATE2 deployer used during broadcast
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        console.log("Deploying to Base Sepolia...");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address feeCollector = vm.envOr("FEE_COLLECTOR", deployer);

        address poolManager = 0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829;

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockUSDT for testnet
        MockUSDT mockUsdt = new MockUSDT();
        console.log("MockUSDT deployed at:", address(mockUsdt));

        // Mint test tokens to deployer (1M USDT)
        mockUsdt.mint(deployer, 1_000_000 * 1e6);
        console.log("Minted 1,000,000 USDT to deployer");

        // 2. Deploy AllowlistCompliance
        AllowlistCompliance compliance = new AllowlistCompliance();
        console.log("AllowlistCompliance:", address(compliance));

        // 3. Deploy PhoneNumberResolver
        PhoneNumberResolver phoneResolver = new PhoneNumberResolver();
        console.log("PhoneNumberResolver:", address(phoneResolver));

        // 4. Deploy RemitSwapHook with address mining
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
                | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_DONATE_FLAG
        );
        bytes memory constructorArgs =
            abi.encode(poolManager, compliance, phoneResolver, feeCollector, address(mockUsdt), deployer);

        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(RemitSwapHook).creationCode, constructorArgs);

        RemitSwapHook hook = new RemitSwapHook{ salt: salt }(
            IPoolManager(poolManager),
            ICompliance(address(compliance)),
            IPhoneNumberResolver(address(phoneResolver)),
            feeCollector,
            address(mockUsdt),
            deployer
        );
        require(address(hook) == hookAddress, "Hook address mismatch");
        console.log("RemitSwapHook:", address(hook));

        // 5. Configure
        compliance.setHook(address(hook));
        compliance.addToAllowlist(deployer, 0);

        // 6. Approve hook to spend deployer's USDT
        mockUsdt.approve(address(hook), type(uint256).max);

        vm.stopBroadcast();

        console.log("\n========== BASE SEPOLIA DEPLOYMENT ==========");
        console.log("MockUSDT:           ", address(mockUsdt));
        console.log("AllowlistCompliance:", address(compliance));
        console.log("PhoneNumberResolver:", address(phoneResolver));
        console.log("RemitSwapHook:      ", address(hook));
        console.log("Fee Collector:      ", feeCollector);
        console.log("==============================================");
        console.log("\nNext steps:");
        console.log("1. Save these addresses to your .env file");
        console.log("2. Run: make setup-demo");
        console.log("3. Mint test USDT: MockUSDT.mint(address, amount)");
    }
}

/// @title DeployToUnichainSepolia
/// @notice Convenience script for Unichain Sepolia testnet deployment
/// @dev Run with: forge script script/Deploy.s.sol:DeployToUnichainSepolia --rpc-url $UNICHAIN_SEPOLIA_RPC_URL --broadcast
contract DeployToUnichainSepolia is Script {
    /// @dev Foundry's deterministic CREATE2 deployer used during broadcast
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        console.log("Deploying to Unichain Sepolia...");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address feeCollector = vm.envOr("FEE_COLLECTOR", deployer);

        address poolManager = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockUSDT for testnet
        MockUSDT mockUsdt = new MockUSDT();
        console.log("MockUSDT deployed at:", address(mockUsdt));

        // Mint test tokens to deployer (1M USDT)
        mockUsdt.mint(deployer, 1_000_000 * 1e6);
        console.log("Minted 1,000,000 USDT to deployer");

        // 2. Deploy AllowlistCompliance
        AllowlistCompliance compliance = new AllowlistCompliance();
        console.log("AllowlistCompliance:", address(compliance));

        // 3. Deploy PhoneNumberResolver
        PhoneNumberResolver phoneResolver = new PhoneNumberResolver();
        console.log("PhoneNumberResolver:", address(phoneResolver));

        // 4. Deploy RemitSwapHook with address mining
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
                | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_DONATE_FLAG
        );
        bytes memory constructorArgs =
            abi.encode(poolManager, compliance, phoneResolver, feeCollector, address(mockUsdt), deployer);

        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(RemitSwapHook).creationCode, constructorArgs);

        RemitSwapHook hook = new RemitSwapHook{ salt: salt }(
            IPoolManager(poolManager),
            ICompliance(address(compliance)),
            IPhoneNumberResolver(address(phoneResolver)),
            feeCollector,
            address(mockUsdt),
            deployer
        );
        require(address(hook) == hookAddress, "Hook address mismatch");
        console.log("RemitSwapHook:", address(hook));

        // 5. Configure
        compliance.setHook(address(hook));
        compliance.addToAllowlist(deployer, 0);

        // 6. Approve hook to spend deployer's USDT
        mockUsdt.approve(address(hook), type(uint256).max);

        vm.stopBroadcast();

        console.log("\n========== UNICHAIN SEPOLIA DEPLOYMENT ==========");
        console.log("MockUSDT:           ", address(mockUsdt));
        console.log("AllowlistCompliance:", address(compliance));
        console.log("PhoneNumberResolver:", address(phoneResolver));
        console.log("RemitSwapHook:      ", address(hook));
        console.log("Fee Collector:      ", feeCollector);
        console.log("=================================================");
    }
}

/// @title DeployToUnichain
/// @notice Convenience script for Unichain mainnet deployment
/// @dev Run with: forge script script/Deploy.s.sol:DeployToUnichain --rpc-url unichain --broadcast
contract DeployToUnichain is Script {
    /// @dev Foundry's deterministic CREATE2 deployer used during broadcast
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        console.log("!!! WARNING: Deploying to Unichain Mainnet !!!");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeCollector = vm.envOr("FEE_COLLECTOR", vm.addr(deployerPrivateKey));

        address poolManager = 0x1F98400000000000000000000000000000000004;
        address supportedToken = vm.envAddress("SUPPORTED_TOKEN");

        console.log("Pool Manager:", poolManager);
        console.log("Supported Token:", supportedToken);
        console.log("Fee Collector:", feeCollector);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy contracts
        AllowlistCompliance compliance = new AllowlistCompliance();
        console.log("AllowlistCompliance:", address(compliance));

        PhoneNumberResolver phoneResolver = new PhoneNumberResolver();
        console.log("PhoneNumberResolver:", address(phoneResolver));

        // Deploy hook with address mining
        address deployer = vm.addr(deployerPrivateKey);
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
                | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_DONATE_FLAG
        );
        bytes memory constructorArgs =
            abi.encode(poolManager, compliance, phoneResolver, feeCollector, supportedToken, deployer);

        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(RemitSwapHook).creationCode, constructorArgs);

        RemitSwapHook hook = new RemitSwapHook{ salt: salt }(
            IPoolManager(poolManager),
            ICompliance(address(compliance)),
            IPhoneNumberResolver(address(phoneResolver)),
            feeCollector,
            supportedToken,
            deployer
        );
        require(address(hook) == hookAddress, "Hook address mismatch");
        console.log("RemitSwapHook:", address(hook));

        // Configure
        compliance.setHook(address(hook));
        compliance.addToAllowlist(deployer, 0);

        vm.stopBroadcast();

        console.log("\n=== Unichain Deployment Complete ===");
    }
}

/// @title DeployToBase
/// @notice Convenience script for Base mainnet deployment
/// @dev Run with: forge script script/Deploy.s.sol:DeployToBase --rpc-url base --broadcast
contract DeployToBase is Script {
    /// @dev Foundry's deterministic CREATE2 deployer used during broadcast
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        console.log("!!! WARNING: Deploying to Base Mainnet !!!");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeCollector = vm.envOr("FEE_COLLECTOR", vm.addr(deployerPrivateKey));

        address poolManager = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
        address supportedToken = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2; // USDT on Base

        console.log("Pool Manager:", poolManager);
        console.log("Supported Token:", supportedToken);
        console.log("Fee Collector:", feeCollector);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy contracts
        AllowlistCompliance compliance = new AllowlistCompliance();
        console.log("AllowlistCompliance:", address(compliance));

        PhoneNumberResolver phoneResolver = new PhoneNumberResolver();
        console.log("PhoneNumberResolver:", address(phoneResolver));

        // Deploy hook with address mining
        address deployer = vm.addr(deployerPrivateKey);
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
                | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_DONATE_FLAG
        );
        bytes memory constructorArgs =
            abi.encode(poolManager, compliance, phoneResolver, feeCollector, supportedToken, deployer);

        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(RemitSwapHook).creationCode, constructorArgs);

        RemitSwapHook hook = new RemitSwapHook{ salt: salt }(
            IPoolManager(poolManager),
            ICompliance(address(compliance)),
            IPhoneNumberResolver(address(phoneResolver)),
            feeCollector,
            supportedToken,
            deployer
        );
        require(address(hook) == hookAddress, "Hook address mismatch");
        console.log("RemitSwapHook:", address(hook));

        // Configure
        compliance.setHook(address(hook));
        compliance.addToAllowlist(deployer, 0);

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
    }
}
