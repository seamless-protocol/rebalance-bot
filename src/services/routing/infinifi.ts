import { CHAIN_ID } from "../../constants/chain";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { Address, encodeFunctionData, erc20Abi } from "viem";
import siUSDAbi from "../../../abis/siUSD";
import { publicClient } from "../../utils/transactionHelpers";
import infinifiGatewayAbi from "../../../abis/InfinifiGateway";
import { Call } from "../../types";

export const getInfinifiSiUSDMintAndStakeQuote = async (usdcAmountIn: bigint) => {
    if (CHAIN_ID !== 1) {
      throw new Error('Native iUSD staking is only supported by the rebalance bot on Ethereum mainnet');
    }

    const siUSDAmountOut = await publicClient.readContract({
      address: CONTRACT_ADDRESSES[CHAIN_ID].SIUSD as Address,
      abi: siUSDAbi,
      functionName: 'previewDeposit',
      args: [usdcAmountIn], // USDC and iUSD are 1:1
    });

    return siUSDAmountOut;
};

export const getInfinifiSiUSDUnstakeAndRedeemQuote = async (siUSDAmountIn: bigint) => {
    if (CHAIN_ID !== 1) {
      throw new Error('Native siUSD unstaking is only supported by the rebalance bot on Ethereum mainnet');
    }

    const iUSDAmountOut = await publicClient.readContract({
      address: CONTRACT_ADDRESSES[CHAIN_ID].SIUSD as Address,
      abi: siUSDAbi,
      functionName: 'previewRedeem',
      args: [siUSDAmountIn],
    });

    return iUSDAmountOut; // iUSD and USDC are 1:1
};

export const prepareInfinifiSiUSDMintAndStakeCalldata = (receiver: Address, usdcAmountIn: bigint, siUSDAmountIn: bigint): Call[] => {
    const approveCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_GATEWAY as Address, usdcAmountIn],
    });
    const mintAndStakeCalldata = encodeFunctionData({
        abi: infinifiGatewayAbi,
        functionName: 'mintAndStake',
        args: [receiver, siUSDAmountIn],
    });

    return [
        {
            target: CONTRACT_ADDRESSES[CHAIN_ID].USDC as Address,
            data: approveCalldata,
            value: 0n,
        },
        {
            target: CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_GATEWAY as Address,
            data: mintAndStakeCalldata,
            value: 0n,
        },
    ];
};

export const prepareInfinifiSiUSDUnstakeAndRedeemCalldata = (receiver: Address, siUSDAmountIn: bigint, iUsdAmountIn: bigint): Call[] => {
    const siUSDApproveCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_GATEWAY as Address, siUSDAmountIn],
    });
    const unstakeCalldata = encodeFunctionData({
        abi: infinifiGatewayAbi,
        functionName: 'unstake',
        args: [CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR, siUSDAmountIn],
    });

    const iUSDApproveCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_GATEWAY as Address, iUsdAmountIn],
    });
    const redeemCalldata = encodeFunctionData({
        abi: infinifiGatewayAbi,
        functionName: 'redeem',
        args: [receiver, iUsdAmountIn, iUsdAmountIn]
    });

    return [
        {
            target: CONTRACT_ADDRESSES[CHAIN_ID].SIUSD as Address,
            data: siUSDApproveCalldata,
            value: 0n,
        },
        {
            target: CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_GATEWAY as Address,
            data: unstakeCalldata,
            value: 0n,
        },
        {
            target: CONTRACT_ADDRESSES[CHAIN_ID].IUSD as Address,
            data: iUSDApproveCalldata,
            value: 0n,
        },
        {
            target: CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_GATEWAY as Address,
            data: redeemCalldata,
            value: 0n,
        }
    ]
};