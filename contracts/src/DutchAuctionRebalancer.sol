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
    function createAuction(address leverageToken) public {
        RebalanceStatus status = getRebalanceStatus(leverageToken);

        if (status != RebalanceStatus.NOT_ELIGIBLE) {
            IRebalanceAdapter rebalanceAdapter =
                IRebalanceAdapter(leverageManager.getLeverageTokenRebalanceAdapter(leverageToken));

            bool auctionExists = rebalanceAdapter.isAuctionValid();
            if (!auctionExists) {
                rebalanceAdapter.createAuction();
                emit AuctionCreated(leverageToken, status);
            } else {
                revert AuctionAlreadyExists();
            }
        } else {
            revert IneligibleForRebalance();
        }
    }

    /// @inheritdoc IDutchAuctionRebalancer
    function takeAuction(
        IRebalanceAdapter rebalanceAdapter,
        IERC20 rebalanceAssetIn,
        IERC20 rebalanceAssetOut,
        uint256 amountToTake,
        IMulticallExecutor multicallExecutor,
        IMulticallExecutor.Call[] calldata swapCalls
    ) external onlyOwner {
        uint256 amountIn = IRebalanceAdapter(rebalanceAdapter).getAmountIn(amountToTake);

        morpho.flashLoan(
            address(rebalanceAssetIn),
            amountIn,
            abi.encode(
                rebalanceAdapter,
                rebalanceAssetIn,
                rebalanceAssetOut,
                amountIn,
                amountToTake,
                multicallExecutor,
                swapCalls
            )
        );
    }

    /// @inheritdoc IDutchAuctionRebalancer
    function onMorphoFlashLoan(uint256 flashLoanAmount, bytes calldata data) external onlyMorpho {
        (
            IRebalanceAdapter rebalanceAdapter,
            IERC20 flashLoanAsset,
            IERC20 rebalanceAssetOut,
            uint256 amountIn,
            uint256 amountToTake,
            IMulticallExecutor multicallExecutor,
            IMulticallExecutor.Call[] memory swapCalls
        ) = abi.decode(
            data,
            (
                IRebalanceAdapter,
                IERC20,
                IERC20,
                uint256,
                uint256,
                IMulticallExecutor,
                IMulticallExecutor.Call[]
            )
        );

        IERC20[] memory tokens = new IERC20[](2);
        tokens[0] = flashLoanAsset;
        tokens[1] = rebalanceAssetOut;

        // Participate in the auction to rebalance
        SafeERC20.forceApprove(flashLoanAsset, address(rebalanceAdapter), amountIn);
        rebalanceAdapter.take(amountToTake);

        // Execute the swap using the MulticallExecutor. MulticallExecutor will sweep any remaining tokens to this contract
        // after executing the swap calls
        if (swapCalls.length > 0) {
            SafeERC20.safeTransfer(rebalanceAssetOut, address(multicallExecutor), amountToTake);
            multicallExecutor.multicallAndSweep(swapCalls, tokens);
        }

        // Repay flash loan from Morpho
        SafeERC20.forceApprove(flashLoanAsset, msg.sender, flashLoanAmount);
    }
}
