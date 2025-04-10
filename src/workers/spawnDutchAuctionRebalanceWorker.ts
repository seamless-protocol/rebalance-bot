import { DutchAuctionRebalanceWorkerMessage, LeverageToken } from "@/types";

import { Worker } from "worker_threads";
import { logWithPrefix } from "../utils/logHelpers";
import path from "path";

// Track active workers to prevent double-spawning
const activeAuctionWorkers = new Map<string, boolean>();

const spawnDutchAuctionRebalanceWorker = (token: LeverageToken) => {
  if (activeAuctionWorkers.get(token.address)) {
    logWithPrefix("spawnDutchAuctionRebalanceWorker", `Worker for token ${token.address} already exists, skipping...`);
    return;
  }
  logWithPrefix("spawnDutchAuctionRebalanceWorker", `Spawning worker for token ${token.address}...`);

  activeAuctionWorkers.set(token.address, true);

  const workerScript = path.resolve(__dirname, "./dutchAuctionRebalanceWorker.js");
  const worker = new Worker(workerScript, {
    workerData: token,
  });

  // Listen for messages from the worker
  worker.on("message", (msg: DutchAuctionRebalanceWorkerMessage) => {
    if (msg.status === "done") {
      logWithPrefix("spawnDutchAuctionRebalanceWorker", `Completed for token: ${token.address}`);
    } else if (msg.status === "error") {
      console.error(`Failed for token: ${token.address}, error: ${msg.error}`);
    }

    activeAuctionWorkers.delete(token.address);
  });

  // Handle worker errors
  worker.on("error", (err) => {
    console.error(`Worker error for token ${token.address}:`, err);
    activeAuctionWorkers.delete(token.address);
  });

  // Handle worker exit
  worker.on("exit", (code) => {
    logWithPrefix("spawnDutchAuctionRebalanceWorker", `Worker for token ${token.address} exited with code ${code}`);
    activeAuctionWorkers.delete(token.address);
  });
};

export default spawnDutchAuctionRebalanceWorker;
