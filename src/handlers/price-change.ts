import { Address } from "viem";
import { publicClient } from "../config/viemConfig";
import { RebalanceStatus } from "../types";
import {
  getLeverageTokenRebalanceAdapterContract,
  leverageManagerContract,
  rebalancerContract,
} from "../utils/contractHelpers";

export async function tryCreateAuction(leverageToken: Address): Promise<RebalanceStatus> {
  const rebalanceStatus = await rebalancerContract.read.getRebalanceStatus([
    leverageManagerContract.address,
    leverageToken,
  ]);

  console.log(`Rebalance status for leverage token (${leverageToken}):`, rebalanceStatus);

  if (rebalanceStatus === RebalanceStatus.DUTCH_ELIGIBLE) {
    console.log(`Leverage token (${leverageToken}) is eligible for Dutch auction`);
    console.log(`Creating auction for leverage token (${leverageToken})...`);

    const rebalanceAdapterContract = getLeverageTokenRebalanceAdapterContract(leverageToken);
    const tx = await rebalanceAdapterContract.write.createAuction();
    console.log(`Created auction for leverage token (${leverageToken}), waiting for receipt:`, tx);

    await publicClient.waitForTransactionReceipt({
      hash: tx,
    });
    console.log(`Auction created for leverage token (${leverageToken})`);
  }

  return rebalanceStatus;
}
