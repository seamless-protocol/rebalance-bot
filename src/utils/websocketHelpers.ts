import { Log, encodeEventTopics } from "viem";

import WebSocket from "ws";
import { findChainById } from "./transactionHelpers";
import { logWithPrefix } from "./logHelpers";

export interface WebSocketConfig {
  chainId: number;
  contractAddress: string;
  abi: any;
  eventName: string;
  onEvent: (event: Log) => void;
}

export const createWebSocketConnection = (config: WebSocketConfig) => {
  const { chainId, contractAddress, abi, eventName, onEvent } = config;
  const { rpcUrl } = findChainById(chainId);
  const ws = new WebSocket(rpcUrl);

  const encodedTopics = encodeEventTopics({
    abi,
    eventName,
  });

  ws.on("open", () => {
    logWithPrefix(eventName, "WebSocket connection established");

    const subscriptionRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_subscribe",
      params: [
        "logs",
        {
          address: contractAddress,
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
      logWithPrefix(eventName, "Failed to parse WebSocket message", data);
      return;
    }

    if (msg.method === "eth_subscription" && msg.params?.result) {
      const eventLog = msg.params.result as Log;
      logWithPrefix(eventName, "Raw event log received", eventLog);
      onEvent(eventLog);
    }
  });

  ws.on("error", (error) => {
    logWithPrefix(eventName, "WebSocket error", error);
  });

  ws.on("close", () => {
    logWithPrefix(eventName, "WebSocket connection closed");
  });

  return ws;
};
