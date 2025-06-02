# include .env file and export its env vars
# (-include to ignore error if it does not exist)
-include .env

.PHONY: test clean

# Build & test
build                   :; forge build
coverage                :; forge coverage
coverage-export         :; forge coverage --report lcov && genhtml lcov.info -o report --rc derive_function_end_line=0
gas                     :; forge test --gas-report
gas-check               :; forge snapshot --check --tolerance 1
snapshot                :; forge snapshot
clean                   :; forge clean
fmt                     :; forge fmt
test                    :; forge test -vvvv --gas-report

# Deploy
deploy-rebalancer-tenderly		:; forge script script/DeployRebalancer.s.sol:DeployRebalancer --force --rpc-url tenderly --slow --broadcast -vvvv --verify --verifier-url ${TENDERLY_VERIFIER_URL} --etherscan-api-key ${TENDERLY_VERIFIER_KEY}

deploy-rebalancer-base		:; forge script script/DeployRebalancer.s.sol:DeployRebalancer --force --rpc-url base --slow --broadcast -vvvv --verify --verifier-url ${BASE_VERIFIER_URL} --etherscan-api-key ${BASE_VERIFIER_KEY}
