import { Log, decodeEventLog } from "viem";

import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import LeverageManagerAbi from "../../abis/LeverageManager";
import { LeverageToken } from "../types";
import { appendObjectToJsonFile } from "../utils/fileHelpers";
import { getWebSocketUrl } from "../utils/transactionHelpers";
import { subscribeToEventWithWebSocket } from "../utils/websocketHelpers";

const subscribeToLeverageTokenCreated = () => {
  console.log("Listening for LeverageTokenCreated events...");

  const leverageManagerAddress = CONTRACT_ADDRESSES.LEVERAGE_MANAGER;
  const rpcUrl = getWebSocketUrl();

  try {
    subscribeToEventWithWebSocket({
      contractAddress: leverageManagerAddress,
      abi: LeverageManagerAbi,
      eventName: "LeverageTokenCreated",
      onEvent: (event: Log) => {
        try {
          handleLeverageTokenCreatedEvent(event);
        } catch (error) {
          console.error("Error handling LeverageTokenCreated event:", error);
          // Don't throw, just log the error and continue
        }
      },
      rpcUrl,
    });
  } catch (error) {
    console.error("Error setting up LeverageTokenCreated subscription:", error);
    // Don't throw, just log the error and continue
  }
};

const handleLeverageTokenCreatedEvent = (event: Log) => {
  try {
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

      try {
        appendObjectToJsonFile(LEVERAGE_TOKENS_FILE_PATH, leverageToken);
      } catch (error) {
        console.error("Error appending leverage token to file:", error);
        // Don't throw, just log the error and continue
      }
    }
  } catch (error) {
    console.error("Error decoding LeverageTokenCreated event:", error);
    // Don't throw, just log the error and continue
  }
};

export default subscribeToLeverageTokenCreated;
