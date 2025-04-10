import { Log, encodeEventTopics } from "viem";

import WebSocket from "ws";

export interface WebSocketConfig {
  contractAddress: string;
  abi: any;
  eventName: string;
  onEvent: (event: Log) => void;
  rpcUrl: string;
}

export const subscribeToEventWithWebSocket = (config: WebSocketConfig) => {
  const { contractAddress, abi, eventName, onEvent, rpcUrl } = config;
  const ws = new WebSocket(rpcUrl);

  const encodedTopics = encodeEventTopics({
    abi,
    eventName,
  });

  ws.on("open", () => {
    console.log(`WebSocket connection established for ${eventName}`);

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
      console.error(`Failed to parse WebSocket message for ${eventName}:`, data);
      return;
    }

    if (msg.method === "eth_subscription" && msg.params?.result) {
      const eventLog = msg.params.result as Log;
      console.log(`Raw event log received for ${eventName}:`, eventLog);
      onEvent(eventLog);
    }
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for ${eventName}:`, error);
  });

  ws.on("close", () => {
    console.log(`WebSocket connection closed for ${eventName}`);
  });

  return ws;
};
