import { encodeFunctionData, getContract } from "viem";
import EtherFiDepositAdapterAbi from "../../../abis/EtherFiDepositAdapter";
import EtherfiL2ExchangeRateProviderAbi from "../../../abis/EtherfiL2ExchangeRateProvider";
import EtherfiL2ModeSyncPoolAbi from "../../../abis/EtherFiL2ModeSyncPool";
import WETH9Abi from "../../../abis/WETH9";
import { CHAIN_ID } from "../../constants/chain";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { ETHERFI_L2_MODE_SYNC_POOL_ETH_ADDRESS } from "../../constants/values";
import { Call } from "../../types";

import { getEethContract, getEtherFiL2ModeSyncPoolContract, getEtherFiLiquidityPoolContract } from "../../utils/contractHelpers";
import { publicClient } from "../../utils/transactionHelpers";

// Logic based off EtherFi LiquidityPool and DepositAdapter contracts
// LiquidityPool: https://github.com/etherfi-protocol/smart-contracts/blob/6fd14b1791b7b666ec9325ea9b8ce3b1bad9880b/src/LiquidityPool.sol#L486
// DepositAdapter: https://github.com/etherfi-protocol/smart-contracts/blob/6fd14b1791b7b666ec9325ea9b8ce3b1bad9880b/src/DepositAdapter.sol#L67
// High-level, when ETH is deposited into the LiquidityPool to get eETH, an exchange rate is calculated based on the total
// amount of ETH in the LiquidityPool and the total amount of shares in the eETH contract.
// The exchange rate between eETH and weETH is 1:1 with eETH shares (which is different from a user's balance of eETH,
// see https://github.com/etherfi-protocol/smart-contracts/blob/6fd14b1791b7b666ec9325ea9b8ce3b1bad9880b/src/EETH.sol#L214 and
// https://github.com/etherfi-protocol/smart-contracts/blob/6fd14b1791b7b666ec9325ea9b8ce3b1bad9880b/src/WeETH.sol#L66).
export const getEtherFiEthStakeQuote = async (ethAmountIn: bigint): Promise<bigint> => {
  if (CHAIN_ID !== 1) {
    return getL2EtherFiEthStakeQuote(ethAmountIn);
  }

  const totalPooledEth = await getEtherFiLiquidityPoolContract().read.getTotalPooledEther() - ethAmountIn;

  if (totalPooledEth === 0n) {
    return ethAmountIn;
  }

  const eethTotalShares = await getEethContract().read.totalShares();

  const weethAmountOut = (ethAmountIn * eethTotalShares) / totalPooledEth;

  return weethAmountOut;
}

export const getL2EtherFiEthStakeQuote = async (ethAmountIn: bigint): Promise<bigint> => {
  const etherFiL2ModeSyncPool = getEtherFiL2ModeSyncPoolContract();

  const exchangeRateProviderAddress = await etherFiL2ModeSyncPool.read.getL2ExchangeRateProvider();
  const exchangeRateProviderContract = getContract({
    address: exchangeRateProviderAddress,
    abi: EtherfiL2ExchangeRateProviderAbi,
    client: publicClient,
  });

  const weethAmountOut = await exchangeRateProviderContract.read.getConversionAmount([
    ETHERFI_L2_MODE_SYNC_POOL_ETH_ADDRESS,
    ethAmountIn,
  ]);

  return weethAmountOut;
};

export const prepareEtherFiEthStakeCalldata = (inputAmount: bigint, outputAmountMin: bigint): Call[] => {
  if (CHAIN_ID !== 1) {
    return prepareL2EtherFiEthStakeCalldata(inputAmount, outputAmountMin);
  }

  const approveWethCalldata = encodeFunctionData({
    abi: WETH9Abi,
    functionName: 'approve',
    args: [CONTRACT_ADDRESSES.ETHERFI_DEPOSIT_ADAPTER, inputAmount],
  });

  const depositWethCalldata = encodeFunctionData({
    abi: EtherFiDepositAdapterAbi,
    functionName: 'depositWETHForWeETH',
    args: [inputAmount, '0x0000000000000000000000000000000000000000'],
  });

  return [
    {
      target: CONTRACT_ADDRESSES.WETH,
      data: approveWethCalldata,
      value: 0n,
    },
    {
      target: CONTRACT_ADDRESSES.ETHERFI_DEPOSIT_ADAPTER,
      data: depositWethCalldata,
      value: 0n,
    }
  ]
};

export const prepareL2EtherFiEthStakeCalldata = (inputAmount: bigint, outputAmountMin: bigint): Call[] => {
  // Unwrap WETH to ETH
  const unwrapWethCalldata = encodeFunctionData({
    abi: WETH9Abi,
    functionName: 'withdraw',
    args: [inputAmount],
  });

  // Deposit ETH to EtherFi L2 Mode Sync Pool
  const depositEthCalldata = encodeFunctionData({
    abi: EtherfiL2ModeSyncPoolAbi,
    functionName: 'deposit',
    args: [ETHERFI_L2_MODE_SYNC_POOL_ETH_ADDRESS, inputAmount, outputAmountMin],
  });

  return [
    {
      target: CONTRACT_ADDRESSES.WETH,
      data: unwrapWethCalldata,
      value: 0n,
    },
    {
      target: ETHERFI_L2_MODE_SYNC_POOL_ETH_ADDRESS,
      data: depositEthCalldata,
      value: inputAmount,
    },
  ];
};