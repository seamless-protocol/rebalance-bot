import { Address } from "viem";
import { LeaseMutex } from "./leaseMutex";
import { TAKE_AUCTION_LOCKS } from "../constants/values";

export const getLockForRebalanceAdapter = (rebalanceAdapter: Address): LeaseMutex => {
  let lock = TAKE_AUCTION_LOCKS.get(rebalanceAdapter);
  if (!lock) {
    lock = new LeaseMutex();
    TAKE_AUCTION_LOCKS.set(rebalanceAdapter, lock);
  }
  return lock;
};
