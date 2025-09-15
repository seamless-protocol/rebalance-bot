import { encodeFunctionData, getContract } from "viem";
import EtherfiL2ExchangeRateProviderAbi from "../../../abis/EtherfiL2ExchangeRateProvider";
import EtherfiL2ModeSyncPoolAbi from "../../../abis/EtherFiL2ModeSyncPool";
import WETH9Abi from "../../../abis/WETH9";
import { ETHERFI_L2_MODE_SYNC_POOL_ETH_ADDRESS } from "../../constants/values";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { Call } from "../../types";
import { getEtherFiL2ModeSyncPoolContract } from "../../utils/contractHelpers";
import { publicClient } from "../../utils/transactionHelpers";

export const getEtherFiEthStakeQuote = async (ethAmountIn: bigint): Promise<bigint> => {
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
  const wethAbi = WETH9Abi;
  const etherFiL2ModeSyncPoolAbi = EtherfiL2ModeSyncPoolAbi;

  // Unwrap WETH to ETH
  const unwrapWethCalldata = encodeFunctionData({
    abi: wethAbi,
    functionName: 'withdraw',
    args: [inputAmount],
  });

  // Deposit ETH to EtherFi L2 Mode Sync Pool
  const depositEthCalldata = encodeFunctionData({
    abi: etherFiL2ModeSyncPoolAbi,
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