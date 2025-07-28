// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IConditionalOrderGenerator, GPv2Order, IConditionalOrder, IERC165} from "cowprotocol/composable-cow/src/interfaces/IConditionalOrder.sol";
import {IERC20} from "cowprotocol/contracts/interfaces/IERC20.sol";

// --- error strings
/// @dev This error is returned by the `verify` function if the *generated* order hash does not match
///      the hash passed as a parameter.
string constant INVALID_HASH = "invalid hash";

contract SimpleTransferHandler is IConditionalOrderGenerator {
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
    GPv2Order.Data memory generatedOrder = getTradeableOrder(owner, sender, ctx, staticInput, offchainInput);

    // /// @dev Verify that the *generated* order is valid and matches the payload.
    // if (!(_hash == GPv2Order.hash(generatedOrder, domainSeparator))) {
    //   revert IConditionalOrder.OrderNotValid(INVALID_HASH);
    // }
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
