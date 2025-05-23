// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ILeverageManager, LeverageTokenState} from "./interfaces/ILeverageManager.sol";
import {IRebalanceAdapter} from "./interfaces/IRebalanceAdapter.sol";
import {RebalanceStatus, StakeContext, StakeType, SwapData, SwapType, RebalanceType} from "./DataTypes.sol";
import {IEtherFiL2ModeSyncPool} from "./interfaces/IEtherFiL2ModeSyncPool.sol";
import {IDutchAuctionRebalancer} from "./interfaces/IDutchAuctionRebalancer.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";
import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";
import {IMorpho} from "./interfaces/IMorpho.sol";
import {IWETH9} from "./interfaces/IWETH9.sol";

contract DutchAuctionRebalancer is IDutchAuctionRebalancer, Ownable {
    /// @notice The ETH address per the EtherFi L2 Mode Sync Pool contract
    address internal constant ETHERFI_ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    ILeverageManager public immutable leverageManager;
    ISwapAdapter public immutable swapAdapter;
    IMorpho public immutable morpho;
    IWETH9 public immutable weth;

    modifier onlyMorpho() {
        if (msg.sender != address(morpho)) revert Unauthorized();
        _;
    }

    constructor(address _owner, address _leverageManager, address _swapAdapter, address _morpho, address _weth)
        Ownable(_owner)
    {
        leverageManager = ILeverageManager(_leverageManager);
        swapAdapter = ISwapAdapter(_swapAdapter);
        morpho = IMorpho(_morpho);
        weth = IWETH9(_weth);
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
        address leverageToken,
        uint256 amountToTake,
        RebalanceType rebalanceType,
        SwapData memory swapData,
        StakeContext memory stakeContext
    ) external {
        address rebalanceAdapter = leverageManager.getLeverageTokenRebalanceAdapter(leverageToken);
        address lendingAdapter = leverageManager.getLeverageTokenLendingAdapter(leverageToken);

        address assetIn;
        address assetOut;
        uint256 amountIn;

        {
            address collateralAsset = ILendingAdapter(lendingAdapter).getCollateralAsset();
            address debtAsset = ILendingAdapter(lendingAdapter).getDebtAsset();

            assetIn = rebalanceType == RebalanceType.REBALANCE_DOWN ? collateralAsset : debtAsset;
            assetOut = rebalanceType == RebalanceType.REBALANCE_DOWN ? debtAsset : collateralAsset;
            amountIn = IRebalanceAdapter(rebalanceAdapter).getAmountIn(amountToTake);
        }

        address flashLoanAsset = stakeContext.stakeType != StakeType.NONE ? stakeContext.assetIn : assetIn;
        uint256 flashLoanAmount = stakeContext.stakeType != StakeType.NONE ? stakeContext.amountIn : amountIn;

        morpho.flashLoan(
            flashLoanAsset,
            flashLoanAmount,
            abi.encode(assetIn, assetOut, rebalanceAdapter, amountIn, amountToTake, swapData, stakeContext)
        );
    }

    /// @inheritdoc IDutchAuctionRebalancer
    function onMorphoFlashLoan(uint256 flashLoanAmount, bytes calldata data) external onlyMorpho {
        (
            address assetIn,
            address assetOut,
            address rebalanceAdapter,
            uint256 amountIn,
            uint256 amountToTake,
            SwapData memory swapData,
            StakeContext memory stakeContext
        ) = abi.decode(data, (address, address, address, uint256, uint256, SwapData, StakeContext));

        if (stakeContext.stakeType == StakeType.ETHERFI_ETH_WEETH) {
            // If stakeContext.stakeType == ETHERFI_ETH_WEETH, the contract will unwrap flash loaned WETH to ETH and stake
            // the ETH into the EtherFi L2 Mode Sync Pool to receive weETH in return, which is the assetIn for the rebalance
            _stakeWethForWeeth(stakeContext, amountIn);
        }

        IERC20(assetIn).approve(rebalanceAdapter, amountIn);
        IRebalanceAdapter(rebalanceAdapter).take(amountToTake);

        if (swapData.swapType == SwapType.EXACT_INPUT_SWAP_ADAPTER) {
            _swapExactInputOnSwapAdapter(assetOut, amountToTake, flashLoanAmount, swapData.swapContext);
        } else if (swapData.swapType == SwapType.EXACT_OUTPUT_SWAP_ADAPTER) {
            _swapExactOutputOnSwapAdapter(assetOut, amountIn, amountToTake, swapData.swapContext);
        } else if (swapData.swapType == SwapType.LIFI_SWAP) {
            address lifiTarget = swapData.lifiSwap.to;
            bytes memory lifiCallData = swapData.lifiSwap.data;
            _swapLIFI(IERC20(assetOut), amountToTake, lifiTarget, lifiCallData);
        }

        IERC20 flashLoanAsset = IERC20(stakeContext.stakeType != StakeType.NONE ? stakeContext.assetIn : assetIn);
        IERC20(flashLoanAsset).approve(msg.sender, flashLoanAmount);
    }

    function _stakeWethForWeeth(StakeContext memory stakeContext, uint256 minAmountOut) internal {
        IWETH9(address(weth)).withdraw(stakeContext.amountIn);

        // Deposit the ETH into the EtherFi L2 Mode Sync Pool to obtain weETH
        // Note: The EtherFi L2 Mode Sync Pool requires ETH to mint weETH. WETH is unsupported at time of writing
        IEtherFiL2ModeSyncPool(stakeContext.stakeTo).deposit{value: stakeContext.amountIn}(
            ETHERFI_ETH_ADDRESS, stakeContext.amountIn, minAmountOut, address(0)
        );
    }

    function _swapExactInputOnSwapAdapter(
        address inputToken,
        uint256 inputAmount,
        uint256 minOutputAmount,
        ISwapAdapter.SwapContext memory swapContext
    ) private {
        SafeERC20.forceApprove(IERC20(inputToken), address(swapAdapter), inputAmount);
        swapAdapter.swapExactInput(inputToken, inputAmount, minOutputAmount, swapContext);
    }

    function _swapExactOutputOnSwapAdapter(
        address inputToken,
        uint256 outputAmount,
        uint256 maxInputAmount,
        ISwapAdapter.SwapContext memory swapContext
    ) private {
        SafeERC20.forceApprove(IERC20(inputToken), address(swapAdapter), maxInputAmount);
        swapAdapter.swapExactOutput(inputToken, outputAmount, maxInputAmount, swapContext);
    }

    function _swapLIFI(IERC20 inputToken, uint256 inputAmount, address target, bytes memory data) internal {
        SafeERC20.forceApprove(inputToken, target, inputAmount);

        (bool success,) = target.call(data);
        if (!success) revert LIFISwapFailed();
    }

    receive() external payable {}
}
