import { REBALANCE_ELIGIBILITY_POLL_INTERVAL } from "./constants/chain";
import { subscribeToAllAuctionCreatedEvents } from "./subscribers/auctionCreated";
import monitorDutchAuctionRebalanceEligibility from "./services/monitorDutchAuctionRebalanceEligibility";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreated";

subscribeToLeverageTokenCreated();
subscribeToAllAuctionCreatedEvents();
monitorDutchAuctionRebalanceEligibility(REBALANCE_ELIGIBILITY_POLL_INTERVAL);
