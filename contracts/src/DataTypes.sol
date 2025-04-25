// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

struct LeverageTokenState {
    uint256 collateralInDebtAsset;
    uint256 debt;
    uint256 equity;
    uint256 collateralRatio;
}

struct SwapData {
    SwapType swapType;
    bytes swapParams;
}

enum RebalanceStatus {
    NOT_ELIGIBLE,
    DUTCH_AUCTION_ELIGIBLE,
    PRE_LIQUIDATION_ELIGIBLE
}

enum SwapType {
    EXACT_INPUT_SWAP_ADAPTER,
    EXACT_OUTPUT_SWAP_ADAPTER,
    LIFI_SWAP
}

enum RebalanceType {
    REBALANCE_DOWN,
    REBALANCE_UP
}
