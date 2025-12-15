```mermaid
sequenceDiagram
  autonumber
  participant Scheduler as Cloud Scheduler
  participant Fn as Cloud Functions
  participant DB as Firestore
  participant LINE as LINE Messaging API
  participant User as User

  Scheduler->>Fn: 定期起動（毎分 / 5分）
  Fn->>DB: 通知検索\n- enabled=true\n- time == 現在時刻\n- lastSentAt 未送信
  DB-->>Fn: 送信対象通知一覧

  loop 通知ごと
    Fn->>LINE: Push通知送信\n(to: lineUserId)
    LINE-->>Fn: 200 OK
    Fn->>DB: lastSentAt 更新
  end

  LINE-->>User: LINEに通知が届く
