import { CHAIN_ID } from "../constants/chain";
import { SLACK_ALERT_CHANNEL_ID, SLACK_AUTH_TOKEN, SLACK_REBALANCE_BOT_NAME } from "../constants/slack";

import { LogLevel } from "../types";
import { WebClient } from "@slack/web-api";
import { createComponentLogger } from "./logger";

const slackClient = new WebClient(SLACK_AUTH_TOKEN);
const alertLogger = createComponentLogger('slack-alerts');

export const sendAlert = async (message: string, logLevel: LogLevel) => {
  await notifySlackChannel(message, logLevel);
};

const notifySlackChannel = async (message: string, logLevel: LogLevel) => {
  if (!SLACK_ALERT_CHANNEL_ID || !SLACK_AUTH_TOKEN) {
    alertLogger.debug("Slack credentials not configured, skipping alert");
    return;
  }

  try {
    alertLogger.info({
      channel: SLACK_ALERT_CHANNEL_ID,
      logLevel: LogLevel[logLevel],
      messagePreview: message.substring(0, 100) + (message.length > 100 ? '...' : '')
    }, "Sending Slack alert");

    await slackClient.chat.postMessage({
      channel: SLACK_ALERT_CHANNEL_ID,
      text: `${getSymbol(logLevel)} ${message}\n• Chain ID: \`${CHAIN_ID}\`\n• Rebalance Bot: \`${SLACK_REBALANCE_BOT_NAME}\``,
    });

    alertLogger.info("Slack alert sent successfully");
  } catch (error) {
    alertLogger.error({ error }, "Error sending Slack alert");
  }
};

const getSymbol = (logLevel: LogLevel) => {
  if (logLevel === LogLevel.ERROR) {
    return ":rotating_light:";
  }
  if (logLevel === LogLevel.REBALANCED) {
    return ":large_green_circle:";
  }
  return ":information_source:";
};
