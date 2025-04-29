import { Log, decodeEventLog } from "viem";

import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import LeverageManagerAbi from "../../abis/LeverageManager";
import { LeverageToken } from "../types";
import { appendObjectToJsonFile } from "../utils/fileHelpers";
import { subscribeToEventWithWebSocket } from "../utils/websocketHelpers";
import { subscribeToAuctionCreated } from "./auctionCreated";

const subscribeToLeverageTokenCreated = () => {
  console.log("Listening for LeverageTokenCreated events...");

  const leverageManagerAddress = CONTRACT_ADDRESSES.LEVERAGE_MANAGER;

  subscribeToEventWithWebSocket({
    contractAddress: leverageManagerAddress,
    abi: LeverageManagerAbi,
    eventName: "LeverageTokenCreated",
    onEvent: (event: Log) => {
      handleLeverageTokenCreatedEvent(event);
    },
  });
};

const handleLeverageTokenCreatedEvent = (event: Log) => {
  const decodedEvent = decodeEventLog({
    abi: LeverageManagerAbi,
    data: event.data,
    topics: event.topics,
  });

  // When an abi includes multiple events, viem's `decodeEventLog` will return a union type, which causes a ts error
  // when accessing the args. This if statement is a workaround to ensure the args are the correct type to avoid
  // the ts error.
  if (decodedEvent.eventName === "LeverageTokenCreated") {
    const leverageToken: LeverageToken = {
      address: decodedEvent.args[0],
      collateralAsset: decodedEvent.args[1],
      debtAsset: decodedEvent.args[2],
      rebalanceAdapter: decodedEvent.args[3].rebalanceAdapter,
    };

    appendObjectToJsonFile(LEVERAGE_TOKENS_FILE_PATH, leverageToken);

    subscribeToAuctionCreated(leverageToken.rebalanceAdapter);
  }
};

export default subscribeToLeverageTokenCreated;
