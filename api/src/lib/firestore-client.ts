import { create as createJwt } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } };

export interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

export interface RunQueryResponse {
  document?: FirestoreDocument;
}

export interface AggregationQueryResponse {
  result?: {
    aggregateFields?: Record<
      string,
      { integerValue?: string; doubleValue?: number }
    >;
  };
}

interface FirestoreClientOptions {
  projectId: string;
  database?: string;
  emulatorHost?: string;
  credentialsPath?: string;
  serviceAccountJson?: string;
}

interface AccessToken {
  token: string;
  expiresAt: number;
}

export class FirestoreClient {
  #projectId: string;
  #database: string;
  #emulatorHost?: string;
  #credentialsPath?: string;
  #serviceAccountJson?: string;
  #accessToken?: AccessToken;

  constructor(options: FirestoreClientOptions) {
    this.#projectId = options.projectId;
    this.#database = options.database ?? "(default)";
    this.#emulatorHost = options.emulatorHost;
    this.#credentialsPath = options.credentialsPath;
    this.#serviceAccountJson = options.serviceAccountJson;
  }

  get projectPath(): string {
    return `projects/${this.#projectId}/databases/${this.#database}`;
  }

  async runQuery(
    body: Record<string, unknown>,
    parent?: string,
  ): Promise<RunQueryResponse[]> {
    const path = parent
      ? `${parent}:runQuery`
      : `${this.projectPath}/documents:runQuery`;
    return await this.#request<RunQueryResponse[]>(path, "POST", body);
  }

  async runAggregationQuery(
    body: Record<string, unknown>,
  ): Promise<AggregationQueryResponse[]> {
    const path = `${this.projectPath}/documents:runAggregationQuery`;
    return await this.#request<AggregationQueryResponse[]>(path, "POST", body);
  }

  async getDocument(path: string): Promise<FirestoreDocument> {
    return await this.#request<FirestoreDocument>(path, "GET");
  }

  async createDocument(
    collectionPath: string,
    fields: Record<string, FirestoreValue>,
    documentId?: string,
  ): Promise<FirestoreDocument> {
    const path = documentId
      ? `${collectionPath}?documentId=${encodeURIComponent(documentId)}`
      : collectionPath;
    return await this.#request<FirestoreDocument>(path, "POST", {
      fields,
    });
  }

  async patchDocument(
    path: string,
    fields: Record<string, FirestoreValue>,
    mask?: string[],
  ): Promise<FirestoreDocument> {
    const url = mask && mask.length > 0
      ? `${path}?${
        mask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join(
          "&",
        )
      }`
      : path;
    return await this.#request<FirestoreDocument>(url, "PATCH", {
      fields,
    });
  }

  async deleteDocument(path: string): Promise<void> {
    await this.#request<void>(path, "DELETE");
  }

  async #request<T>(
    path: string,
    method: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const baseUrl = this.#emulatorHost
      ? `http://${this.#emulatorHost}/v1`
      : "https://firestore.googleapis.com/v1";
    const url = `${baseUrl}/${path}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (!this.#emulatorHost) {
      const token = await this.#getAccessToken();
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Firestore request failed (${method} ${path}): ${response.status} ${response.statusText} - ${text}`,
      );
    }
    if (response.status === 204) {
      return undefined as unknown as T;
    }
    const json = await response.json();
    return json as T;
  }

  async #getAccessToken(): Promise<string> {
    if (this.#accessToken && this.#accessToken.expiresAt > Date.now()) {
      return this.#accessToken.token;
    }
    const token = await this.#obtainAccessToken();
    this.#accessToken = token;
    return token.token;
  }

  async #obtainAccessToken(): Promise<AccessToken> {
    // Prefer metadata server when running on GCP.
    const metadataToken = await this.#tryMetadataServer();
    if (metadataToken) {
      return metadataToken;
    }

    const credentials = await this.#loadServiceAccount();
    if (!credentials) {
      throw new Error(
        "Firestore credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.",
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: credentials.client_email,
      sub: credentials.client_email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/datastore",
      iat: now,
      exp: now + 3600,
    };
    const jwt = await createSignedJwt(payload, credentials.private_key);
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to exchange JWT for access token: ${text}`);
    }
    const json = await response.json() as {
      access_token: string;
      expires_in: number;
    };
    return {
      token: json.access_token,
      expiresAt: (Date.now() + (json.expires_in - 60) * 1000),
    };
  }

  async #tryMetadataServer(): Promise<AccessToken | null> {
    try {
      const response = await fetch(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
        { headers: { "Metadata-Flavor": "Google" } },
      );
      if (!response.ok) {
        return null;
      }
      const json = await response.json() as {
        access_token: string;
        expires_in: number;
      };
      return {
        token: json.access_token,
        expiresAt: (Date.now() + (json.expires_in - 60) * 1000),
      };
    } catch {
      return null;
    }
  }

  async #loadServiceAccount(): Promise<ServiceAccount | null> {
    if (this.#serviceAccountJson) {
      return JSON.parse(this.#serviceAccountJson) as ServiceAccount;
    }
    const path = this.#credentialsPath ??
      Deno.env.get("GOOGLE_APPLICATION_CREDENTIALS");
    if (!path) {
      return null;
    }
    const text = await Deno.readTextFile(path);
    return JSON.parse(text) as ServiceAccount;
  }
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

async function createSignedJwt(
  payload: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  /* Deno公式ドキュメント (Creating and verifying JWT) を参考にdjwtで署名付きトークンを生成。 */
  const cryptoKey = await importPrivateKey(privateKeyPem);
  return await createJwt({ alg: "RS256", typ: "JWT" }, payload, cryptoKey);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem);
  return await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(normalized);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

export function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { integerValue: value.toString() };
    }
    return { doubleValue: value };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => encodeValue(item)),
      },
    };
  }
  if (typeof value === "object") {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      fields[key] = encodeValue(val);
    }
    return { mapValue: { fields } };
  }
  throw new Error(`Unsupported value type: ${typeof value}`);
}

export function decodeValue(value?: FirestoreValue): unknown {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) {
    const fields = value.mapValue.fields ?? {};
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(fields)) {
      result[key] = decodeValue(val);
    }
    return result;
  }
  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((item) => decodeValue(item));
  }
  return undefined;
}

export function documentName(
  projectPath: string,
  collection: string,
  id: string,
): string {
  return `${projectPath}/documents/${collection}/${id}`;
}

export function extractDocumentId(document: FirestoreDocument): string {
  const segments = document.name.split("/");
  return segments[segments.length - 1]!;
}
