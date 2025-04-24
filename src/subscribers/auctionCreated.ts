import { Address, Log } from "viem";
import RebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import { subscribeToEventWithWebSocket } from "../utils/websocketHelpers";
import { getWebSocketUrl } from "../utils/transactionHelpers";
import { Worker } from "worker_threads";
import path from "path";
import { pathToFileURL } from "url";

const subscribeToAuctionCreated = (rebalanceAdapter: Address) => {
  console.log("Listening for AuctionCreated events...");

  const rpcUrl = getWebSocketUrl();

  subscribeToEventWithWebSocket({
    contractAddress: rebalanceAdapter,
    abi: RebalanceAdapterAbi,
    eventName: "AuctionCreated",
    onEvent: (event: Log) => {
      // Create a new worker for this auction event
      const worker = new Worker(pathToFileURL(path.join(__dirname, "../workers/handleAuctionCreateEvent.js")));

      // Send both the rebalanceAdapter address and the event to the worker
      worker.postMessage({
        rebalanceAdapter,
        event,
      });

      // Handle worker messages
      worker.on("message", (message) => {
        console.log("Worker message:", message.data);
      });

      // Handle worker errors
      worker.on("error", (error) => {
        console.error("Worker error:", error);
        // Optionally terminate the worker on error
        worker.terminate();
      });

      // Handle worker termination
      worker.on("messageerror", (error) => {
        console.error("Worker message error:", error);
        worker.terminate();
      });
    },
    rpcUrl,
  });
};

export default subscribeToAuctionCreated;
