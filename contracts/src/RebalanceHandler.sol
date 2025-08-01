// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IConditionalOrderGenerator, GPv2Order, IConditionalOrder, IERC165} from "cowprotocol/composable-cow/src/interfaces/IConditionalOrder.sol";
import {IERC20} from "cowprotocol/contracts/interfaces/IERC20.sol";

import {IRebalanceAdapter} from "./interfaces/IRebalanceAdapter.sol";
import {RebalanceStatus} from "./DataTypes.sol";
import {ILeverageManager, LeverageTokenState} from "./interfaces/ILeverageManager.sol";

// --- error strings
/// @dev This error is returned by the `verify` function if the *generated* order is not valid.
string constant INVALID_ORDER = "invalid order";

contract RebalanceHandler is IConditionalOrderGenerator, IERC1271 {
  ILeverageManager public immutable leverageManager;

  constructor(ILeverageManager _leverageManager) {
    leverageManager = _leverageManager;
  }

  function isValidSignature(bytes32 hash, bytes memory signature) public view override returns (bytes4) {
    return IERC1271.isValidSignature.selector;
  }

  function getRebalanceStatus(address leverageToken) public view returns (RebalanceStatus status) {
    IRebalanceAdapter rebalanceAdapter = IRebalanceAdapter(
      leverageManager.getLeverageTokenRebalanceAdapter(leverageToken)
    );

    LeverageTokenState memory leverageTokenState = leverageManager.getLeverageTokenState(leverageToken);

    // If caller can be rebalanceAdapter than it means that strategy is eligible for rebalance through dutch auction
    bool isDutchEligible = rebalanceAdapter.isEligibleForRebalance(
      leverageToken,
      leverageTokenState,
      address(rebalanceAdapter)
    );

    // If caller can be any address than it means that strategy is eligible for rebalance also through pre-liquidation
    bool isPreLiquidationEligible = rebalanceAdapter.isEligibleForRebalance(
      leverageToken,
      leverageTokenState,
      address(this)
    );

    if (isPreLiquidationEligible) {
      return RebalanceStatus.PRE_LIQUIDATION_ELIGIBLE;
    }

    if (isDutchEligible) {
      return RebalanceStatus.DUTCH_AUCTION_ELIGIBLE;
    }

    return RebalanceStatus.NOT_ELIGIBLE;
  }

  function verify(
    address owner,
    address sender,
    bytes32 _hash,
    bytes32 domainSeparator,
    bytes32 ctx,
    bytes calldata staticInput,
    bytes calldata offchainInput,
    GPv2Order.Data calldata
  ) external view override {
    (
      address leverageToken,
      address tokenIn,
      address tokenOut,
      uint256 sellAmount,
      uint256 buyAmount,
      bytes32 appData
    ) = abi.decode(offchainInput, (address, address, address, uint256, uint256, bytes32));

    RebalanceStatus status = getRebalanceStatus(leverageToken);
    IRebalanceAdapter rebalanceAdapter = IRebalanceAdapter(
      leverageManager.getLeverageTokenRebalanceAdapter(leverageToken)
    );

    bool auctionExists = rebalanceAdapter.isAuctionValid();

    if (status == RebalanceStatus.NOT_ELIGIBLE || !auctionExists) {
      revert IConditionalOrder.OrderNotValid(INVALID_ORDER);
    }
  }

  /**
   * @dev Set the visibility of this function to `public` to allow `verify` to call it.
   * @inheritdoc IConditionalOrderGenerator
   */
  function getTradeableOrder(
    address owner,
    address sender,
    bytes32 ctx,
    bytes calldata staticInput,
    bytes calldata offchainInput
  ) public view virtual override returns (GPv2Order.Data memory order) {
    (address tokenIn, address tokenOut, address receiver, uint256 sellAmount, uint256 buyAmount, bytes32 appData) = abi
      .decode(offchainInput, (address, address, address, uint256, uint256, bytes32));

    order = GPv2Order.Data({
      sellToken: IERC20(tokenIn),
      buyToken: IERC20(tokenOut),
      receiver: receiver,
      sellAmount: sellAmount,
      buyAmount: buyAmount,
      validTo: uint32(block.timestamp + 1 days),
      appData: appData,
      feeAmount: 0,
      kind: GPv2Order.KIND_SELL,
      partiallyFillable: false,
      sellTokenBalance: GPv2Order.BALANCE_ERC20,
      buyTokenBalance: GPv2Order.BALANCE_ERC20
    });
  }

  function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool) {
    return interfaceId == type(IConditionalOrderGenerator).interfaceId || interfaceId == type(IERC165).interfaceId;
  }
}
