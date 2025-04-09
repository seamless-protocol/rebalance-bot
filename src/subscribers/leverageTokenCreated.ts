import { Log, decodeEventLog } from "viem";

import LeverageManagerAbi from "../../abis/LeverageManager";
import { LeverageToken } from "@/types";
import { appendObjectToJsonFile } from "../utils/fileHelpers";
import { createWebSocketConnection } from "../utils/websocketHelpers";
import { getContractAddressesByChainId } from "../utils/transactionHelpers";
import { logWithPrefix } from "../utils/logHelpers";
import path from "path";

const LEVERAGE_TOKENS_FILE_PATH = path.join(__dirname, "..", "data", "leverageTokens.json");

const subscribeToLeverageTokenCreated = (chainId: number) => {
  logWithPrefix("LeverageTokenCreated", "Listening for events...");

  const leverageManagerAddress = getContractAddressesByChainId(chainId).LEVERAGE_MANAGER;

  createWebSocketConnection({
    chainId,
    contractAddress: leverageManagerAddress,
    abi: LeverageManagerAbi,
    eventName: "LeverageTokenCreated",
    onEvent: (event: Log) => {
      saveLeverageToken(event);
    },
  });
};

const saveLeverageToken = (event: Log) => {
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
  }
};

export default subscribeToLeverageTokenCreated;
