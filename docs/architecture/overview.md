flowchart TB
  %% ========== Client ==========
  subgraph Client["Client (Web / Mobile App)"]
    UI["RITU App UI\n- ルーティン管理\n- 通知設定\n- 課金画面"]
    LIFF["LIFF (LINE連携画面)\n- LINEログイン\n- 友だち追加導線"]
  end

  %% ========== Firebase / GCP ==========
  subgraph FirebaseGCP["Firebase / GCP"]
    Auth["Firebase Authentication\n(Google Provider)"]
    FS["Cloud Firestore\n(users / routines / notifications)"]
    Rules["Firestore Security Rules\n(uid境界)"]
    Fn["Cloud Functions\n- 通知CRUD(制限チェック)\n- Stripe連携\n- LINE送信\n- 定時処理"]
    Scheduler["Cloud Scheduler\n(毎分 or 5分)"]
    PubSub["Pub/Sub (optional)\nスケール/リトライ用"]
  end

  %% ========== External ==========
  subgraph External["External Services"]
    Stripe["Stripe\n- Checkout\n- Webhook"]
    LINE["LINE Platform\n- Messaging API\n- LIFF"]
    Discord["Discord (Future)\n- Webhook/Bot"]
  end

  %% ========== Flows ==========
  UI -->|"Googleログイン"| Auth
  Auth -->|"uid/ID Token"| UI

  UI -->|"CRUD: routines"| FS
  UI -->|"通知追加/更新/削除\n(必ず関数経由)"| Fn
  Fn -->|"read/write"| FS
  FS --- Rules

  UI -->|"LINE連携QR/URL表示\n(LIFF起動)"| LIFF
  LIFF -->|"LINEログイン\n(同意)"| LINE
  LIFF -->|"lineUserId を登録"| Fn
  Fn -->|"users/{uid}.line.userId 更新"| FS

  UI -->|"課金開始"| Fn
  Fn -->|"Checkout Session作成"| Stripe
  Stripe -->|"Checkout URL"| UI
  Stripe -->|"Webhook(支払/更新/解約)"| Fn
  Fn -->|"users/{uid}.isPremium 更新"| FS

  Scheduler -->|"定期起動"| Fn
  Fn -->|"送信対象検索\n(nowに一致, enabled, 未送信)"| FS
  Fn -->|"Push通知"| LINE

  %% Optional scale path
  Scheduler -.->|"大量時に分割"| PubSub
  PubSub -.-> Fn

  %% Future
  Fn -.->|"Discord通知送信(将来)"| Discord
