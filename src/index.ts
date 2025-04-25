import { LEVERAGE_TOKENS_FILE_PATH, REBALANCE_ELIGIBILITY_POLL_INTERVAL } from "./constants/chain";
import monitorDutchAuctionRebalanceEligibility from "./services/monitorDutchAuctionRebalanceEligibility";
import subscribeToAuctionCreated from "./subscribers/auctionCreated";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreated";
import { LeverageToken } from "./types";
import { getLeverageTokenRebalanceAdapter } from "./utils/contractHelpers";
import { readJsonArrayFromFile } from "./utils/fileHelpers";

const subscribeToAllAuctionCreatedEvents = () => {
  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH) as LeverageToken[];
  leverageTokens.forEach((leverageToken) => {
    const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken.address);
    subscribeToAuctionCreated(rebalanceAdapter);
  });
};

subscribeToLeverageTokenCreated();
subscribeToAllAuctionCreatedEvents();
monitorDutchAuctionRebalanceEligibility(REBALANCE_ELIGIBILITY_POLL_INTERVAL);
