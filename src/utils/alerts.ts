import { SLACK_ALERT_CHANNEL_ID, SLACK_AUTH_TOKEN } from "../constants/slack";

import { WebClient } from "@slack/web-api";

const slackClient = new WebClient(SLACK_AUTH_TOKEN);

export const notifySlackChannel = async (message: string) => {
  try {
    console.log("Notifying slack channel:", SLACK_ALERT_CHANNEL_ID, message);
    await slackClient.chat.postMessage({
      channel: SLACK_ALERT_CHANNEL_ID,
      text: message,
    });
  } catch (error) {
    // Silently fail if slack is not configured
    console.error("Error notifying slack channel:", error);
  }
};
