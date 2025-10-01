import { Address, encodeFunctionData } from "viem";
import WETH9Abi from "../../../abis/WETH9";
import wstETHAbi from "../../../abis/wstETH";
import { CHAIN_ID } from "../../constants/chain";
import { publicClient } from "../../utils/transactionHelpers";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { Call } from "../../types";

export const getLidoEthStakeQuote = async (ethAmountIn: bigint) => {
  if (CHAIN_ID !== 1) {
    throw new Error('Native Lido staking is only supported by the rebalance bot on Ethereum mainnet');
  }

  const sharesByPooledEthResponse = await publicClient.readContract({
    address: CONTRACT_ADDRESSES[CHAIN_ID].WSTETH as Address,
    abi: wstETHAbi,
    functionName: 'getWstETHByStETH',
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