import { parentPort, workerData } from "worker_threads";

import { LeverageToken } from "@/types";

const handleDutchAuctionRebalance = async (token: LeverageToken): Promise<void> => {
  console.log(`Starting auction for token ${token.address} on thread`);

  // TODO: Dutch auction logic
  // Placeholder: Wait for 10 seconds before completing
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, 10000);
  });
  console.log(`Auction completed for token ${token.address}`);
};

(async () => {
  try {
    await handleDutchAuctionRebalance(workerData as LeverageToken);
    if (parentPort) {
      parentPort.postMessage({ status: "done" });
    }
  } catch (error) {
    console.error("Error in rebalance auction worker:", error);
    if (parentPort) {
      parentPort.postMessage({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
})();
