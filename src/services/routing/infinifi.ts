import { CHAIN_ID } from "../../constants/chain";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { Address, encodeFunctionData, erc20Abi } from "viem";
import siUSDAbi from "../../../abis/siUSD";
import { publicClient } from "../../utils/transactionHelpers";
import infinifiGatewayAbi from "../../../abis/InfinifiGateway";
import { Call } from "../../types";
import infinifiUnstakeAndRedeemHelperAbi from "../../../abis/InfinifiUnstakeAndRedeemHelper";
import iUSDMintControllerAbi from "../../../abis/iUSDMintController";
import infinifiYieldSharingAbi from "../../../abis/InfinifiYieldSharing";

export const getInfinifiSiUSDMintAndStakeQuote = async (usdcAmountIn: bigint) => {
    if (CHAIN_ID !== 1) {
      throw new Error('Native iUSD staking is only supported by the rebalance bot on Ethereum mainnet');
    }

    const results = await publicClient.multicall({
      contracts: [
        {
          address: CONTRACT_ADDRESSES[CHAIN_ID].IUSD_MINT_CONTROLLER as Address,
          abi: iUSDMintControllerAbi,
          functionName: 'assetToReceipt',
          args: [usdcAmountIn],
        },
        {
          address: CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_YIELD_SHARING as Address,
          abi: infinifiYieldSharingAbi,
          functionName: 'vested',
        },
        {
          address: CONTRACT_ADDRESSES[CHAIN_ID].SIUSD as Address,
          abi: siUSDAbi,
          functionName: 'totalSupply',
        },
        {
          address: CONTRACT_ADDRESSES[CHAIN_ID].SIUSD as Address,
          abi: siUSDAbi,
          functionName: 'totalAssets',
        },
      ],
    });

    const iUSDAmount = results[0].result as bigint;
    const vestedYieldAssets = results[1].result as bigint;
    const siUSDTotalSupply = results[2].result as bigint;
    const siUSDTotalAssets = results[3].result as bigint;

    const siUSDTotalAssetsWithYield = siUSDTotalAssets + vestedYieldAssets;

    const siUSDAmountOut = siUSDTotalSupply === 0n ? iUSDAmount : ((iUSDAmount * siUSDTotalSupply) / siUSDTotalAssetsWithYield);

    return siUSDAmountOut;
};

export const getInfinifiSiUSDUnstakeAndRedeemQuote = async (siUSDAmountIn: bigint) => {
    if (CHAIN_ID !== 1) {
      throw new Error('Native siUSD unstaking is only supported by the rebalance bot on Ethereum mainnet');
    }

    const usdcAmountOut = await publicClient.readContract({
      address: CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_UNSTAKE_AND_REDEEM_HELPER as Address,
      abi: infinifiUnstakeAndRedeemHelperAbi,
      functionName: 'siUSD2USDC',
      args: [siUSDAmountIn],
    });

    return usdcAmountOut;
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

export const prepareInfinifiSiUSDUnstakeAndRedeemCalldata = (siUSDAmountIn: bigint): Call[] => {
    const siUSDApproveCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_UNSTAKE_AND_REDEEM_HELPER as Address, siUSDAmountIn],
    });
    const unstakeCalldata = encodeFunctionData({
        abi: infinifiUnstakeAndRedeemHelperAbi,
        functionName: 'unstakeAndRedeem',
        args: [siUSDAmountIn],
    });

    return [
        {
            target: CONTRACT_ADDRESSES[CHAIN_ID].SIUSD as Address,
            data: siUSDApproveCalldata,
            value: 0n,
        },
        {
            target: CONTRACT_ADDRESSES[CHAIN_ID].INFINIFI_UNSTAKE_AND_REDEEM_HELPER as Address,
            data: unstakeCalldata,
            value: 0n,
        }
    ]
};