import { Log, decodeEventLog, encodeEventTopics } from "viem";

import LeverageManagerAbi from "../../abis/LeverageManager";
import { LeverageToken } from "@/types";
import WebSocket from "ws";
import { appendObjectToJsonFile } from "../utils/fileHelpers";
import path from "path";
import { getWebSocketUrl } from "../utils/transactionHelpers";
import { CONTRACT_ADDRESSES } from "../constants/contracts";

const LEVERAGE_TOKENS_FILE_PATH = path.join(__dirname, "..", "data", "leverageTokens.json");

const subscribeToLeverageTokenCreated = () => {
  console.log("Listening for LeverageTokenCreated events...");

  const ws = new WebSocket(getWebSocketUrl());

  const leverageManagerAddress = CONTRACT_ADDRESSES.BASE.LEVERAGE_MANAGER;
  const encodedTopics = encodeEventTopics({
    abi: LeverageManagerAbi,
    eventName: "LeverageTokenCreated",
  });

  ws.on("open", () => {
    console.log("WebSocket connection established to:", getWebSocketUrl());

    const subscriptionRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_subscribe",
      params: [
        "logs",
        {
          address: leverageManagerAddress,
          topics: encodedTopics,
        },
      ],
    };
    ws.send(JSON.stringify(subscriptionRequest));
  });

  ws.on("message", (data: string) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (err) {
      console.error("Failed to parse WebSocket message", data);
      return;
    }

    if (msg.method === "eth_subscription" && msg.params?.result) {
      const eventLog = msg.params.result as Log;
      console.log("Raw LeverageTokenCreated event log received:", eventLog);

      saveLeverageToken(eventLog);
    }
  });

  ws.on("error", (error) => {
    console.error("LeverageTokenCreated WebSocket error:", error);
  });

  ws.on("close", () => {
    console.log("LeverageTokenCreated WebSocket connection closed");
  });
};

const saveLeverageToken = (event: Log) => {
  const decodedEvent = decodeEventLog({
    abi: LeverageManagerAbi,
    data: event.data,
    topics: event.topics,
  });
  const leverageToken: LeverageToken = {
    address: decodedEvent.args[0],
    collateralAsset: decodedEvent.args[1],
    debtAsset: decodedEvent.args[2],
    rebalanceAdapter: decodedEvent.args[3].rebalanceAdapter,
  };

  appendObjectToJsonFile(LEVERAGE_TOKENS_FILE_PATH, leverageToken);
};

export default subscribeToLeverageTokenCreated;
