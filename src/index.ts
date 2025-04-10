import { CHAIN_IDS } from "./constants/chains";
import { findChainById } from "./utils/transactionHelpers";
import monitorDutchAuctionRebalanceEligibility from "./services/monitorDutchAuctionRebalanceEligibility";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreated";

subscribeToLeverageTokenCreated(CHAIN_IDS.BASE);
monitorDutchAuctionRebalanceEligibility(findChainById(CHAIN_IDS.BASE).rebalanceEligibilityPollInterval);
