import { SLACK_ALERT_CHANNEL_ID, SLACK_AUTH_TOKEN } from "../constants/slack";

import { WebClient } from "@slack/web-api";

const slackClient = new WebClient(SLACK_AUTH_TOKEN);

export const logAndAlert = async (message: string, isError = false) => {
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
  await notifySlackChannel(message);
};

const notifySlackChannel = async (message: string) => {
  if (!SLACK_ALERT_CHANNEL_ID || !SLACK_AUTH_TOKEN) {
    return;
  }

  try {
    console.log("Notifying slack channel:", SLACK_ALERT_CHANNEL_ID, message);
    await slackClient.chat.postMessage({
      channel: SLACK_ALERT_CHANNEL_ID,
      text: message,
    });
  } catch (error) {
    console.error("Error notifying slack channel:", error);
  }
};
