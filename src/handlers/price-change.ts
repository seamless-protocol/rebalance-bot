import { Address } from "viem";
import { publicClient } from "../config/viemConfig";
import { RebalanceStatus } from "../types";
import {
  getLeverageTokenRebalanceAdapterContract,
  leverageManagerContract,
  rebalancerContract,
} from "../utils/contractHelpers";

export async function tryCreateAuction(leverageToken: Address): Promise<RebalanceStatus> {
  // Get rebalance status of leverage token, token can be eligible for Dutch auction or pre-liquidation or not eligible at all
  const rebalanceStatus = await rebalancerContract.read.getRebalanceStatus([
    leverageManagerContract.address,
    leverageToken,
  ]);

  console.log(`Rebalance status for leverage token (${leverageToken}):`, rebalanceStatus);

  // If token is eligible for Dutch auction, create auction so rebalancer can compete and rebalance token
  if (rebalanceStatus === RebalanceStatus.DUTCH_ELIGIBLE) {
    console.log(`Checking if leverage token (${leverageToken}) already has an active valid auction...`);

    // We need to check if valid auction already exists in case someone else already created auction
    // If auction is not valid, we will create new one otherwise we will skip creating auction because it will revert anyway
    const rebalanceAdapterContract = getLeverageTokenRebalanceAdapterContract(leverageToken);
    const doesValidAuctionExists = await rebalanceAdapterContract.read.isAuctionValid();

    if (!doesValidAuctionExists) {
      console.log(`Creating auction for leverage token (${leverageToken})...`);

      const tx = await rebalanceAdapterContract.write.createAuction();
      console.log(`Created auction for leverage token (${leverageToken}), waiting for receipt:`, tx);

      await publicClient.waitForTransactionReceipt({
        hash: tx,
      });
      console.log(`Auction created for leverage token (${leverageToken})`);
    }
  }

  // In case of Dutch auction eligibility we will return than enum here no matter did we create auction or not
  // It is just important that return value indicates that auction is in progress and competition is happening
  // If auction is not created, it means that auction is not eligible for Dutch auction and we will not compete for it

  return rebalanceStatus;
}
