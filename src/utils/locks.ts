import { Address } from "viem";
import { LeaseMutex } from "./leaseMutex";
import { PRE_LIQUIDATION_INTERVAL_LOCKS, PRE_LIQUIDATION_INTERVAL_LOCK_TIMEOUT, DUTCH_AUCTION_INTERVAL_LOCKS, DUTCH_AUCTION_INTERVAL_LOCK_TIMEOUT } from "../constants/values";


export const getPreLiquidationLock = (leverageToken: Address, interval: NodeJS.Timeout): LeaseMutex => {
  let lock = PRE_LIQUIDATION_INTERVAL_LOCKS.get(interval);
  if (!lock) {
    lock = new LeaseMutex(PRE_LIQUIDATION_INTERVAL_LOCK_TIMEOUT, `LeverageToken ${leverageToken}`);
    PRE_LIQUIDATION_INTERVAL_LOCKS.set(interval, lock);
  }
  return lock;
};

export const getDutchAuctionLock = (leverageToken: Address, interval: NodeJS.Timeout): LeaseMutex => {
  let lock = DUTCH_AUCTION_INTERVAL_LOCKS.get(interval);
  if (!lock) {
    lock = new LeaseMutex(DUTCH_AUCTION_INTERVAL_LOCK_TIMEOUT, `LeverageToken ${leverageToken}`);
    DUTCH_AUCTION_INTERVAL_LOCKS.set(interval, lock);
  }
  return lock;
};