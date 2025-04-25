import { FALLBACK_RPC_URL, PRIMARY_RPC_URL } from "../constants/chain";
import { Log, encodeEventTopics } from "viem";

import WebSocket from "ws";
import { WebSocketConfig } from "../types";

export const subscribeToEventWithWebSocket = (config: WebSocketConfig) => {
  const { contractAddress, abi, eventName, onEvent } = config;

  const urls = [PRIMARY_RPC_URL, FALLBACK_RPC_URL];
  let currentRpcIndex = 0;
  let ws: WebSocket;

  const connect = (): WebSocket => {
    const url = urls[currentRpcIndex];

    const rpcName = currentRpcIndex == 0 ? "primary" : "fallback";

    console.log(`Connecting to ${rpcName} RPC WebSocket for ${eventName}`);
    ws = new WebSocket(url);

    const encodedTopics = encodeEventTopics({ abi, eventName });

    ws.on("open", () => {
      console.log(`WebSocket connection established for ${eventName} on ${rpcName} RPC`);

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
      console.error(`WebSocket error for ${eventName} on ${rpcName} RPC:`, error);
      // If a fallback URL is available, try connecting to it
      if (currentRpcIndex + 1 < urls.length) {
        console.log(`Attempting fallback connection for ${eventName}`);
        ws.close();
        currentRpcIndex += 1;
        connect();
      }
    });

    ws.on("close", () => {
      console.log(`WebSocket connection closed for ${eventName} on ${rpcName} RPC`);
    });

    return ws;
  };

  return connect();
};
