import { Address } from "viem";
import { LeaseMutex } from "./leaseMutex";
import { PRE_LIQUIDATION_LOCKS, TAKE_AUCTION_LOCKS } from "../constants/values";

export const getPreLiquidationLock = (leverageToken: Address): LeaseMutex => {
  let lock = PRE_LIQUIDATION_LOCKS.get(leverageToken);
  if (!lock) {
    lock = new LeaseMutex();
    PRE_LIQUIDATION_LOCKS.set(leverageToken, lock);
  }
  return lock;
};

export const getDutchAuctionLock = (leverageToken: Address): LeaseMutex => {
  let lock = TAKE_AUCTION_LOCKS.get(leverageToken);
  if (!lock) {
    lock = new LeaseMutex();
    TAKE_AUCTION_LOCKS.set(leverageToken, lock);
  }
  return lock;
};