// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";

enum StakeType {
    NONE,
    ETHERFI_ETH_WEETH // Staking ETH to receive weETH
}

struct LeverageTokenState {
    uint256 collateralInDebtAsset;
    uint256 debt;
    uint256 equity;
    uint256 collateralRatio;
}

struct LIFISwap {
    address to;
    bytes data;
    uint256 value;
}

struct StakeContext {
    StakeType stakeType;
    address stakeTo;
    address assetIn;
    uint256 amountIn;
}

struct SwapData {
    SwapType swapType;
    ISwapAdapter.SwapContext swapContext;
    LIFISwap lifiSwap;
}

enum RebalanceStatus {
    NOT_ELIGIBLE,
    DUTCH_AUCTION_ELIGIBLE,
    PRE_LIQUIDATION_ELIGIBLE
}

enum SwapType {
    NONE,
    EXACT_INPUT_SWAP_ADAPTER,
    EXACT_OUTPUT_SWAP_ADAPTER,
    LIFI_SWAP
}

enum RebalanceType {
    REBALANCE_DOWN,
    REBALANCE_UP
}
