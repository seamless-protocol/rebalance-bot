import { ETHERFI_L2_MODE_SYNC_POOL_ETH_ADDRESS } from "@/constants/values";
import EtherfiL2ExchangeRateProviderAbi from "abis/EtherfiL2ExchangeRateProvider";
import { getContract } from "viem";
import { getEtherFiL2ModeSyncPoolContract } from "@/utils/contractHelpers";
import { publicClient } from "@/utils/transactionHelpers";

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
