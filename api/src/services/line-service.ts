export class LineService {
  #channelAccessToken: string;

  constructor(channelAccessToken: string) {
    this.#channelAccessToken = channelAccessToken;
    if (!channelAccessToken) {
      console.warn("[LineService] LINE_CHANNEL_ACCESS_TOKEN is empty. Using mock send.");
    }
  }

  async sendPushMessage(userId: string, text: string): Promise<void> {
    if (!this.#channelAccessToken) {
      console.info(`[Mock LINE] Send to ${userId}: ${text}`);
      return;
    }

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.#channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Failed to send LINE message", res.status, body);
      throw new Error(`LINE API error: ${res.status}`);
    }
  }
}
