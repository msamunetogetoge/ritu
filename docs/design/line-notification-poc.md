# LINE Notification PoC Design Document

## 概要

ユーザーが作成したルーティンに対して、設定した時間にLINE通知を受け取ることができる機能をPoC
(Proof of Concept) として実装する。 将来的にはGoogle Cloud
Tasksを使用したWebhookモデルへの移行を想定しているが、本フェーズではBackend
Workerによるポーリング方式を採用する。

## アーキテクチャ

### 現状 (As-Is)

- `NotificationWorker` は `api` サーバー内で稼働。
- `User` コレクションの `notificationSettings.scheduleTime`
  を参照し、その時間に設定している**全ユーザー**に対し、汎用的なリマインド通知を送信している。

### 変更後 (To-Be)

- **通知単位の粒度変更**:
  ユーザー単位の一括通知ではなく、**ルーティン単位**での通知を可能にする。
- `Routine` ドキュメントの `schedule` フィールドに `notify: boolean` フラグと
  `time: string` (HH:MM) を持たせる。
- `NotificationWorker`
  は、現在の時間に通知設定がONになっているルーティンを検索し、そのルーティンの所有者に通知を送る。

## データモデル設計

### Firestore Schema

#### `routines` Collection

`schedule` マップフィールド内に `notify` (boolean) を追加。

```typescript
interface Routine {
  // ... existing fields
  schedule: {
    type: "daily" | "weekly"; // existing convention
    time?: "HH:mm"; // existing convention
    notify?: boolean; // [NEW] LINE通知を行うかどうか
    // ... potentially daysOfWeek etc.
  };
}
```

#### `users` Collection

変更なし。ただし、LINE通知を送るために `notificationSettings.lineUserId`
が設定されている必要がある。

- `lineUserId` は LINE Login の ID トークンを `/v1/line/login`
  で検証して保存する。
- 通知タイミングはルーティンごとの `schedule.time`
  に従い、ユーザー設定画面では時刻やメール通知の設定を行わない。

## インターフェース設計

### Frontend (`ritu`)

- **ルーティン作成/編集ダイアログ**:
  - 時刻入力欄の下に「LINE通知を受け取る」チェックボックスを追加。
  - 時刻が未入力の場合はチェックボックスを無効化（またはチェック時に時刻入力を必須化）する。

### Backend (`api`)

- **Repository層**:
  - `RoutineRepository.listByScheduleTime(time: string): Promise<Routine[]>`
    を追加。
  - 実装クラス (`FirestoreRoutineRepository`) で、`schedule.time == time` かつ
    `schedule.notify == true` のクエリを実装。
- **Service/Worker層**:
  - `NotificationWorker`:
    - 定期実行 (e.g. 1分毎) 時に `RoutineRepository.listByScheduleTime`
      を呼び出す。
    - 取得したルーティンリストから `userId` を抽出。
    - `UserRepository.getById` 等でユーザー情報を取得し、`lineUserId`
      の有無を確認。
    - 有効なユーザーに対し、`LineService.sendPushMessage` を実行。
      - 通 知内容はルーティン名をパラメータに含める (例:
        「{RoutineName}の時間です！」)。
      - 同一ユーザーに同刻のルーティンが複数ある場合、まとめて通知するか個別にするかは実装詳細とする（本PoCでは個別送信または単純なループ処理で可）。

## 必要な環境変数

本PoCを動作させるために以下の環境変数が必要となる。

- `LINE_CHANNEL_ACCESS_TOKEN`: LINE Messaging APIのチャネルアクセストークン。
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Firestore接続用サービスアカウントキー
  (JSON文字列)。
  - または `GOOGLE_APPLICATION_CREDENTIALS` (ファイルパス)。
- `FIRESTORE_PROJECT_ID`: FirebaseプロジェクトID。
- `LINE_NOTIFICATION_TO` (任意): 配信先を強制するテスト用ID。

## セキュリティ・制約事項

- `NotificationWorker`
  はサーバーサイドでのみ動作し、一般ユーザーからの直接アクセスは遮断されるべきである（現状の実装に準拠）。
- 1分ごとのポーリングのため、厳密な秒単位の精度は保証しない。

## LINE Messaging API Reference (Push Message)

**Endpoint**: `POST https://api.line.me/v2/bot/message/push`

ユーザー、グループトーク、または複数人トークに、任意のタイミングでメッセージを送信するAPI。

### Headers

- `Content-Type`: `application/json` (必須)
- `Authorization`: `Bearer {channel access token}` (必須)
- `X-Line-Retry-Key`: `{UUID}` (任意, 16進表記のUUID)

### Body

```json
{
  "to": "U4af4980629...", // 必須: 送信先のID (userId, groupId, roomId)
  "messages": [ // 必須: 最大5件
    {
      "type": "text",
      "text": "Hello, world"
    }
  ],
  "notificationDisabled": false, // 任意: trueの場合、ユーザーに通知されない
  "customAggregationUnits": ["promotion_a"] // 任意: 集計用ユニット名
}
```

### Rate Limits

- 2,000リクエスト/秒

### Response (200 OK)

```json
{
  "sentMessages": [
    {
      "id": "461230966842064897",
      "quoteToken": "IStG5h1Tz7b..."
    }
  ]
}
```

### Error Codes

| Code    | Description                                                              |
| :------ | :----------------------------------------------------------------------- |
| **400** | 無効なユーザーID、存在しないグループ、無効なメッセージオブジェクトなど。 |
| **409** | 同じリトライキーを含むリクエストがすでに受理されている。                 |
| **429** | レート制限超過、またはメッセージ送信数上限超過。                         |

※
ステータスコード200でも、ブロックされているユーザーやアカウント削除済みユーザーには実際には届かない場合がある。
