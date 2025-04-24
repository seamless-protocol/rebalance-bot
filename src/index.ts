import { REBALANCE_ELIGIBILITY_POLL_INTERVAL } from "./constants/chain";
import monitorDutchAuctionRebalanceEligibility from "./services/monitorDutchAuctionRebalanceEligibility";
import subscribeToAuctionCreated from "./subscribers/auctionCreated";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreated";

subscribeToLeverageTokenCreated();
subscribeToAuctionCreated("0xA38062F23cbF30680De009e59E62B62F6c95a35A");
monitorDutchAuctionRebalanceEligibility(REBALANCE_ELIGIBILITY_POLL_INTERVAL);
