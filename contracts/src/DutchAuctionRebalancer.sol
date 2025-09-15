// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ILeverageManager, LeverageTokenState} from "./interfaces/ILeverageManager.sol";
import {IRebalanceAdapter} from "./interfaces/IRebalanceAdapter.sol";
import {RebalanceStatus, RebalanceType} from "./DataTypes.sol";
import {IDutchAuctionRebalancer} from "./interfaces/IDutchAuctionRebalancer.sol";
import {IMulticallExecutor} from "./interfaces/IMulticallExecutor.sol";
import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";
import {IMorpho} from "./interfaces/IMorpho.sol";

contract DutchAuctionRebalancer is IDutchAuctionRebalancer, Ownable {
    ILeverageManager public immutable leverageManager;
    IMorpho public immutable morpho;

    modifier onlyMorpho() {
        if (msg.sender != address(morpho)) revert Unauthorized();
        _;
    }

    constructor(address _owner, address _leverageManager, address _morpho) Ownable(_owner) {
        leverageManager = ILeverageManager(_leverageManager);
        morpho = IMorpho(_morpho);
    }

    /// @inheritdoc IDutchAuctionRebalancer
    function sweepToken(address token, address to) external onlyOwner {
        SafeERC20.safeTransfer(IERC20(token), to, IERC20(token).balanceOf(address(this)));
    }

    /// @inheritdoc IDutchAuctionRebalancer
    function getRebalanceStatus(address leverageToken) public view returns (RebalanceStatus status) {
        IRebalanceAdapter rebalanceAdapter =
            IRebalanceAdapter(leverageManager.getLeverageTokenRebalanceAdapter(leverageToken));

        LeverageTokenState memory leverageTokenState = leverageManager.getLeverageTokenState(leverageToken);

        // If caller can be rebalanceAdapter than it means that strategy is eligible for rebalance through dutch auction
        bool isDutchEligible =
            rebalanceAdapter.isEligibleForRebalance(leverageToken, leverageTokenState, address(rebalanceAdapter));

        // If caller can be any address than it means that strategy is eligible for rebalance also through pre-liquidation
        bool isPreLiquidationEligible =
            rebalanceAdapter.isEligibleForRebalance(leverageToken, leverageTokenState, address(this));

        if (isPreLiquidationEligible) {
            return RebalanceStatus.PRE_LIQUIDATION_ELIGIBLE;
        }

        if (isDutchEligible) {
            return RebalanceStatus.DUTCH_AUCTION_ELIGIBLE;
        }

        return RebalanceStatus.NOT_ELIGIBLE;
    }

    /// @inheritdoc IDutchAuctionRebalancer
    function previewTakeAuction(address leverageToken, uint256 amountToTake, RebalanceType rebalanceType)
        external
        view
        returns (bool isAuctionValid, uint256 newCollateralRatio)
    {
        IRebalanceAdapter rebalanceAdapter =
            IRebalanceAdapter(leverageManager.getLeverageTokenRebalanceAdapter(leverageToken));

        if (!rebalanceAdapter.isAuctionValid()) {
            return (false, 0);
        }

        address lendingAdapter = leverageManager.getLeverageTokenLendingAdapter(leverageToken);

        LeverageTokenState memory leverageTokenState = leverageManager.getLeverageTokenState(leverageToken);

        uint256 amountIn = rebalanceAdapter.getAmountIn(amountToTake);

        uint256 newCollateralInDebtAsset;
        uint256 newDebt;

        if (rebalanceType == RebalanceType.REBALANCE_DOWN) {
            newCollateralInDebtAsset = leverageTokenState.collateralInDebtAsset
                + ILendingAdapter(lendingAdapter).convertCollateralToDebtAsset(amountIn);
            newDebt = leverageTokenState.debt + amountToTake;
        } else {
            uint256 collateralToAddInDebtAsset =
                ILendingAdapter(lendingAdapter).convertCollateralToDebtAsset(amountToTake);
            newCollateralInDebtAsset = leverageTokenState.collateralInDebtAsset > collateralToAddInDebtAsset
                ? leverageTokenState.collateralInDebtAsset - collateralToAddInDebtAsset
                : 0;
            newDebt = leverageTokenState.debt > amountIn ? leverageTokenState.debt - amountIn : 0;
        }

        newCollateralRatio = newDebt > 0 ? newCollateralInDebtAsset * 1e18 / newDebt : type(uint256).max;

        return (true, newCollateralRatio);
    }

    /// @inheritdoc IDutchAuctionRebalancer
    function tryCreateAuction(address leverageToken) public {
        RebalanceStatus status = getRebalanceStatus(leverageToken);

        bool auctionCreated;
        if (status != RebalanceStatus.NOT_ELIGIBLE) {
            IRebalanceAdapter rebalanceAdapter =
                IRebalanceAdapter(leverageManager.getLeverageTokenRebalanceAdapter(leverageToken));

            bool auctionExists = rebalanceAdapter.isAuctionValid();
            if (!auctionExists) {
                rebalanceAdapter.createAuction();
                auctionCreated = true;
            }
        }

        emit TryCreateAuction(leverageToken, status, auctionCreated);
    }

    /// @inheritdoc IDutchAuctionRebalancer
    function takeAuction(
        IRebalanceAdapter rebalanceAdapter,
        uint256 amountToTake,
        IERC20 flashLoanAsset,
        IERC20 rebalanceAssetIn,
        IMulticallExecutor multicallExecutor,
        IMulticallExecutor.Call[] calldata swapCalls
    ) external onlyOwner {
        uint256 amountIn = IRebalanceAdapter(rebalanceAdapter).getAmountIn(amountToTake);

        morpho.flashLoan(
            address(flashLoanAsset),
            amountIn,
            abi.encode(
                flashLoanAsset, rebalanceAssetIn, rebalanceAdapter, amountIn, amountToTake, multicallExecutor, swapCalls
            )
        );
    }

    /// @inheritdoc IDutchAuctionRebalancer
    function onMorphoFlashLoan(uint256 flashLoanAmount, bytes calldata data) external onlyMorpho {
        (
            IERC20 assetIn,
            IERC20 assetOut,
            address rebalanceAdapter,
            uint256 amountIn,
            uint256 amountToTake,
            IMulticallExecutor multicallExecutor,
            IMulticallExecutor.Call[] memory swapCalls
        ) = abi.decode(data, (IERC20, IERC20, address, uint256, uint256, IMulticallExecutor, IMulticallExecutor.Call[]));

        SafeERC20.forceApprove(assetIn, rebalanceAdapter, amountIn);
        IRebalanceAdapter(rebalanceAdapter).take(amountToTake);

        // Transfer the taken assets to the multicall executor for swapping
        SafeERC20.safeTransfer(assetOut, address(multicallExecutor), amountToTake);

        // Execute the swap using the multicall executor. Multicall executor will sweep any remaining tokens to the sender
        // (this contract) after executing the swap calls
        IERC20[] memory tokens = new IERC20[](2);
        tokens[0] = assetIn;
        tokens[1] = assetOut;
        multicallExecutor.multicallAndSweep(swapCalls, tokens);

        // Repay flash loan from Morpho
        SafeERC20.forceApprove(assetIn, msg.sender, flashLoanAmount);
    }
}
