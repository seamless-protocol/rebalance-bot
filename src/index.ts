import { CHAIN_IDS } from "./constants/chains";
import dotenv from "dotenv";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreatedSubscriber";

dotenv.config();

subscribeToLeverageTokenCreated(CHAIN_IDS.BASE);
