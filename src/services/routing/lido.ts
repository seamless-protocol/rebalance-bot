import { Address, encodeFunctionData } from "viem";
import stETHAbi from "../../../abis/stETH";
import WETH9Abi from "../../../abis/WETH9";
import { CHAIN_ID } from "../../constants/chain";
import { publicClient } from "../../utils/transactionHelpers";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { Call } from "../../types";

export const getLidoEthStakeQuote = async (ethAmountIn: bigint) => {
  if (CHAIN_ID !== 1) {
    throw new Error('Native Lido staking is only supported by the rebalance bot on Ethereum mainnet');
  }

  // The amount of wstETH minted is equal to the amount of stETH shares received by depositing ETH into the Lido contract
  // see:
  //   - https://github.com/lidofinance/core/blob/a89fd494afbdd8c81c9401870abdfa3566187a67/contracts/0.6.12/WstETH.sol#L81
  //   - https://github.com/lidofinance/core/blob/a89fd494afbdd8c81c9401870abdfa3566187a67/contracts/0.4.24/Lido.sol#L938
  const sharesByPooledEthResponse = await publicClient.readContract({
    address: CONTRACT_ADDRESSES[CHAIN_ID].STETH as Address,
    abi: stETHAbi,
    functionName: 'getSharesByPooledEth',
    args: [ethAmountIn],
  });

  return sharesByPooledEthResponse;
};

export const prepareLidoEthStakeCalldata = (inputAmount: bigint): Call[] => {
  if (CHAIN_ID !== 1) {
    throw new Error('Native Lido staking is only supported by the rebalance bot on Ethereum mainnet');
  }

  const wethWithdrawCalldata = encodeFunctionData({
    abi: WETH9Abi,
    functionName: 'withdraw',
    args: [inputAmount],
  });

  return [
    {
      target: CONTRACT_ADDRESSES[CHAIN_ID].WETH,
      data: wethWithdrawCalldata,
      value: 0n,
    },
    // Transfers of ETH to the wstETH contract mint wstETH
    {
      target: CONTRACT_ADDRESSES[CHAIN_ID].WSTETH as Address,
      data: "0x",
      value: inputAmount,
    }
  ];
};