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

    // USDC and iUSD are 1:1, but iUSD has 18 decimals and USDC has 6 decimals
    const iUSDAmountIn = usdcAmountIn * 10n ** 12n;

    const siUSDAmountOut = await publicClient.readContract({
      address: CONTRACT_ADDRESSES[CHAIN_ID].SIUSD as Address,
      abi: siUSDAbi,
      functionName: 'previewDeposit',
      args: [iUSDAmountIn],
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

    // iUSD and USDC are 1:1, but iUSD has 18 decimals and USDC has 6 decimals
    return iUSDAmountOut / 10n ** 12n;
};

export const prepareInfinifiSiUSDMintAndStakeCalldata = (receiver: Address, usdcAmountIn: bigint): Call[] => {
    const approveCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_GATEWAY as Address, usdcAmountIn],
    });
    const mintAndStakeCalldata = encodeFunctionData({
        abi: infinifiGatewayAbi,
        functionName: 'mintAndStake',
        args: [receiver, usdcAmountIn],
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

export const prepareInfinifiSiUSDUnstakeAndRedeemCalldata = (receiver: Address, siUSDAmountIn: bigint, usdcAmountOut: bigint): Call[] => {
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

    // iUSD and USDC are 1:1, but iUSD has 18 decimals and USDC has 6 decimals
    const iUSDAmountIn = usdcAmountOut * 10n ** 12n;

    const iUSDApproveCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_GATEWAY as Address, iUSDAmountIn],
    });
    const redeemCalldata = encodeFunctionData({
        abi: infinifiGatewayAbi,
        functionName: 'redeem',
        args: [receiver, iUSDAmountIn, usdcAmountOut]
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