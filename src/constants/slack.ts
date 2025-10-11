import dotenv from "dotenv";

dotenv.config();

export const SLACK_ALERT_CHANNEL_ID = process.env.SLACK_ALERT_CHANNEL_ID || "";
export const SLACK_AUTH_TOKEN = process.env.SLACK_AUTH_TOKEN || "";
export const SLACK_REBALANCE_BOT_NAME = process.env.SLACK_REBALANCE_BOT_NAME || "";