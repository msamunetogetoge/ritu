export interface LineLoginResult {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
  expiresAt?: number;
  issuer?: string;
}

type VerifyResponse = {
  sub?: string;
  name?: string;
  picture?: string;
  exp?: number;
  iss?: string;
  aud?: string;
};

/**
 * LINE Login のIDトークンを検証し、LINEユーザーIDを取り出す。
 * Messaging APIのユーザーIDと同じ値なので、通知送信に利用できる。
 */
export class LineLoginService {
  #channelId: string;

  constructor(channelId: string) {
    this.#channelId = channelId;
  }

  async verifyIdToken(idToken: string): Promise<LineLoginResult> {
    if (!this.#channelId) {
      throw new Error("LINE_LOGIN_CHANNEL_ID is not configured.");
    }
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: this.#channelId,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LINE Login verify failed: ${res.status} ${body}`);
    }

    const payload = await res.json() as VerifyResponse;
    if (!payload.sub) {
      throw new Error("LINE Login verify response missing sub (user id).");
    }

    return {
      lineUserId: payload.sub,
      displayName: payload.name,
      pictureUrl: payload.picture,
      expiresAt: payload.exp ? payload.exp * 1000 : undefined,
      issuer: payload.iss,
    };
  }
}
