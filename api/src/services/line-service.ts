export class LineService {
  #channelAccessToken: string;

  constructor(channelAccessToken: string) {
    this.#channelAccessToken = channelAccessToken;
    if (!channelAccessToken) {
      console.warn(
        "[LineService] LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is empty. Using mock send.",
      );
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

    console.info(`[LINE] Sent push to ${userId}: "${text}"`);
  }

  /**
   * Verify LINE Webhook signature
   * @param body request body string
   * @param signature X-Line-Signature header
   * @param channelSecret LINE_CHANNEL_SECRET
   */
  async verifySignature(body: string, signature: string, channelSecret: string): Promise<boolean> {
    if (!channelSecret) {
      console.error("LINE_CHANNEL_SECRET is not set. Signature verification failed.");
      return false; // Fail secure: reject if secret is missing
    }
    const encoder = new TextEncoder();
    const keyData = encoder.encode(channelSecret);
    const bodyData = encoder.encode(body);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, bodyData);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const calculatedSignature = btoa(String.fromCharCode(...hashArray));

    return calculatedSignature === signature;
  }

  /**
   * Handle Webhook events
   * Returns parsed events or void
   */
  async handleWebhookEvent(events: any[]): Promise<void> {
    for (const event of events) {
      const userId = event.source?.userId;
      if (!userId) continue;

      console.info(`[LINE Webhook] Event Type: ${event.type}, User ID: ${userId}`);

      if (event.type === "follow") {
        console.info(`[LINE Webhook] Follow event from ${userId}`);
        // TODO: Store userId to DB (link with app user)
      } else if (event.type === "message") {
        console.info(`[LINE Webhook] Message from ${userId}: ${event.message?.text}`);
        // TODO: Echo back or handle commands
      }
    }
  }

  getLineConfig() {
    return {
      friendUrl: Deno.env.get("LINE_FRIEND_URL") ?? "",
      friendQr: Deno.env.get("LINE_FRIEND_QR") ?? "",
    };
  }
}
