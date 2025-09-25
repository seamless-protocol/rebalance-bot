// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

struct LeverageTokenState {
    uint256 collateralInDebtAsset;
    uint256 debt;
    uint256 equity;
    uint256 collateralRatio;
}

enum RebalanceStatus {
    NOT_ELIGIBLE,
    DUTCH_AUCTION_ELIGIBLE,
    PRE_LIQUIDATION_ELIGIBLE
}

enum RebalanceType {
    REBALANCE_DOWN,
    REBALANCE_UP
}

enum ActionType {
    AddCollateral,
    RemoveCollateral,
    Borrow,
    Repay
}

struct RebalanceAction {
    ActionType actionType;
    uint256 amount;
}
