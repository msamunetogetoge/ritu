sequenceDiagram
  autonumber
  participant User as User
  participant App as RITU App
  participant LIFF as LIFF App
  participant LINE as LINE Platform
  participant Fn as Cloud Functions
  participant DB as Firestore

  User->>App: 通知設定で「LINE連携」
  App->>User: QR / URL 表示（LIFF起動）

  User->>LIFF: QR/URLを開く
  LIFF->>LINE: LINEログイン（同意）
  LINE-->>LIFF: lineUserId / profile

  LIFF->>Fn: LINE連携完了\n(lineUserId, Firebase ID Token)
  Fn->>Fn: ID Token検証（uid特定）
  Fn->>DB: users/{uid}.line.userId 保存
  DB-->>Fn: OK

  LIFF->>User: 連携完了表示
