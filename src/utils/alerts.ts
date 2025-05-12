import { SLACK_ALERT_CHANNEL_ID, SLACK_AUTH_TOKEN } from "../constants/slack";

import { LogLevel } from "../types";
import { WebClient } from "@slack/web-api";

const slackClient = new WebClient(SLACK_AUTH_TOKEN);

export const sendAlert = async (message: string, logLevel: LogLevel) => {
  await notifySlackChannel(message, logLevel);
};

const notifySlackChannel = async (message: string, logLevel: LogLevel) => {
  if (!SLACK_ALERT_CHANNEL_ID || !SLACK_AUTH_TOKEN) {
    return;
  }

  try {
    console.log("Notifying slack channel:", SLACK_ALERT_CHANNEL_ID, message);

    await slackClient.chat.postMessage({
      channel: SLACK_ALERT_CHANNEL_ID,
      text: `${getSymbol(logLevel)} ${message}`,
    });
  } catch (error) {
    console.error("Error notifying slack channel:", error);
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
