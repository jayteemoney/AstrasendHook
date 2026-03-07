# RemitSwapHook Makefile
# Load .env if it exists
-include .env

# ============ Build & Test ============

build:
	forge build

test:
	forge test

test-v:
	forge test -vvv

test-gas:
	forge test --gas-report

test-fuzz:
	forge test --match-test testFuzz

test-invariant:
	forge test --match-contract InvariantTest -vvv

test-coverage:
	forge coverage

fmt:
	forge fmt

fmt-check:
	forge fmt --check

clean:
	forge clean

# ============ Deploy: Base Sepolia ============

deploy-base-sepolia:
	forge script script/Deploy.s.sol:DeployToBaseSepolia \
		--rpc-url $(BASE_SEPOLIA_RPC_URL) \
		--broadcast \
		--verify \
		--etherscan-api-key $(BASESCAN_API_KEY) \
		-vvv

# ============ Deploy: Base Mainnet ============

deploy-base:
	@echo "WARNING: Deploying to Base Mainnet!"
	@echo "Press Ctrl+C to cancel..."
	@sleep 3
	forge script script/Deploy.s.sol:DeployToBase \
		--rpc-url $(BASE_RPC_URL) \
		--broadcast \
		--verify \
		--etherscan-api-key $(BASESCAN_API_KEY) \
		-vvv

# ============ Deploy: Unichain Sepolia ============

deploy-unichain-sepolia:
	forge script script/Deploy.s.sol:DeployToUnichainSepolia \
		--rpc-url $(UNICHAIN_SEPOLIA_RPC_URL) \
		--broadcast \
		--verify \
		--etherscan-api-key $(UNISCAN_API_KEY) \
		-vvv

# ============ Deploy: Unichain Mainnet ============

deploy-unichain:
	@echo "WARNING: Deploying to Unichain Mainnet!"
	@echo "Press Ctrl+C to cancel..."
	@sleep 3
	forge script script/Deploy.s.sol:DeployToUnichain \
		--rpc-url $(UNICHAIN_RPC_URL) \
		--broadcast \
		--verify \
		--etherscan-api-key $(UNISCAN_API_KEY) \
		-vvv

# ============ Demo Setup ============

setup-demo:
	forge script script/SetupDemo.s.sol:SetupDemo \
		--rpc-url $(BASE_SEPOLIA_RPC_URL) \
		--broadcast \
		-vvv

# ============ Utility ============

install:
	forge install

snapshot:
	forge snapshot

.PHONY: build test test-v test-gas test-fuzz test-invariant test-coverage \
	fmt fmt-check clean deploy-base-sepolia deploy-base \
	deploy-unichain-sepolia deploy-unichain setup-demo install snapshot
