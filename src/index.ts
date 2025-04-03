import { CHAIN_IDS } from "./constants/chains";
import dotenv from "dotenv";
import subscribeToCreateNewLeverageToken from "./subscribers/createNewLeverageTokenSubscriber";

dotenv.config();

subscribeToCreateNewLeverageToken(CHAIN_IDS.BASE);
