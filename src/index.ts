import { CHAIN } from "./constants/chain";
import monitorDutchAuctionRebalanceEligibility from "./services/monitorDutchAuctionRebalanceEligibility";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreated";

subscribeToLeverageTokenCreated();
monitorDutchAuctionRebalanceEligibility(CHAIN.rebalanceEligibilityPollInterval);
