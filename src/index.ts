import { REBALANCE_ELIGIBILITY_POLL_INTERVAL } from "./constants/chain";
import monitorDutchAuctionRebalanceEligibility from "./services/monitorDutchAuctionRebalanceEligibility";
import { subscribeToAllAuctionCreatedEvents } from "./subscribers/auctionCreated";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreated";

subscribeToLeverageTokenCreated();
subscribeToAllAuctionCreatedEvents();
monitorDutchAuctionRebalanceEligibility(REBALANCE_ELIGIBILITY_POLL_INTERVAL);
