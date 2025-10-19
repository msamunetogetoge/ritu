以下に、RITUアプリの**仕様書**と**設計書**を統合したドキュメントを、マークダウン形式で出力します。
内容はあなたが提供した4つの資料【RITU 🎯 プロジェクト概要】【Scalable,
Cost-Efficient GCP Architecture】【Scalable, Developer-Friendly
Architecture】【RITU_BE_API_Design.md】を統合し、開発でそのまま使える形に整えています。

---

# 🧭 RITU 仕様書・設計書（統合版）

## 🎯 プロジェクト概要

### 目的

日々のルーティーンを登録・記録し、**継続を可視化・褒めてくれる Web
アプリ**を開発。 SNS連携による「承認」と「モチベーション維持」を狙う。

### 初期リリース

- 対象：**Webアプリのみ**
- 配信：**Firebase Hosting (CDN/SSL付)**
- 将来的に：**iOS / Android / Tauri** へ拡張予定（UIとAPIを共通化）

### 技術スタック

| 区分         | 技術                           | 説明                                     |
| ------------ | ------------------------------ | ---------------------------------------- |
| フロント     | React + Vite + TypeScript      | Webアプリ（最初のリリース対象）          |
| 認証         | Firebase Auth (Google)         | Googleログイン認証（JWT発行）            |
| データ       | Firestore                      | ルーティーン・履歴・コメント・いいね管理 |
| バックエンド | Cloud Run (TS node)            | APIロジック・定期処理                    |
| 開発         | Firebase Emulator Suite        | ローカル一括実行・DB確認                 |
| デプロイ     | Firebase CLI                   | Hosting + Functions 一括                 |
| 構成管理     | モノレポ (apps + api + shared) | 将来Tauri/iOS/Android拡張に対応          |

---

## 🧩 機能要件（MVP）

| カテゴリ         | 機能                                      |
| ---------------- | ----------------------------------------- |
| ルーティーン管理 | 登録・編集・削除・完了チェック            |
| 継続可視化       | 日数・ストリーク表示                      |
| フィードバック   | 達成時にメッセージ or アニメーション表示  |
| コミュニティ機能 | 投稿共有・コメント・いいね                |
| データ復旧       | 削除から7日以内なら復元（ソフトデリート） |
| 外部連携（将来） | X（旧Twitter）投稿・いいね反映            |
| 認証             | Googleアカウントログイン（MVP）           |

---

## 🏗 システム構成（GCP / Firebase）

| コンポーネント          | 役割                                            |
| ----------------------- | ----------------------------------------------- |
| Firebase Hosting        | Reactアプリを配信（CDN/SSL付き）                |
| Firebase Auth           | Googleログイン認証（JWT発行）                   |
| Firestore               | ルーティーン・履歴・コメント・いいね管理        |
| Cloud Run               | APIロジック（TypeScript）・削除スケジュール処理 |
| Cloud Tasks / Scheduler | ソフトデリート後7日経過時の自動削除             |
| Secret Manager          | APIキーやX連携認証情報保管                      |
| Firebase Emulator Suite | ローカル環境（Auth/Firestore/Functions/UI）     |

---

## 🧱 ディレクトリ構造（Monorepo）

```
repo/
  apps/
    web/               # React + Vite (Web)
  api/
    functions/         # Cloud Functions (TS)
  shared/
    models/            # 共通型定義
    utils/             # 共通ロジック
  firebase.json
  firestore.rules
  firestore.indexes.json
  package.json / Cargo.toml
```

---

## ⚙️ 開発環境とローカル実行

### Firebase Emulator Suite

| サービス    | ポート |
| ----------- | ------ |
| Auth        | 9099   |
| Firestore   | 8080   |
| Functions   | 5001   |
| Hosting     | 5000   |
| Emulator UI | 4000   |

起動:

```bash
firebase emulators:start
```

### フロントエンド（Vite）の補足

- Today 画面用の React + Vite プロジェクト（`ritu/` 配下）は Deno 2 の `npm:`
  互換モジュールから `deno run -A npm:create-vite` で生成した。以後の依存解決は
  `deno install` で行える。
- ローカル実行は `ritu/` ディレクトリ内で `npm run dev` または（Deno
  タスクを割り当てる場合）`deno task dev` を経由して起動する。

---

## 🧠 データモデル（Firestore）

| コレクション | 概要                                       |
| ------------ | ------------------------------------------ |
| Users        | ユーザプロフィール・設定                   |
| Routines     | ルーティーン定義（title, schedule, etc）   |
| Completions  | 実績（date, userId, routineId）            |
| SharedPosts  | 共有投稿（routineId, text, likeCountなど） |
| Comments     | 投稿へのコメント                           |
| Likes        | 投稿へのいいね                             |

### 共通フィールド

- `createdAt`, `updatedAt`
- `isDeleted`, `deletedAt`（7日以内復元可能）

### Today画面（Firestore連携）

- フロントエンドは Firebase Auth の Google ログイン後に `routines`
  コレクションを `userId == auth.uid` でリアルタイム購読し、`deletedAt`
  が存在するドキュメントはクライアント側で除外する。
- 1日の完了状態はコレクショングループ `completions` を `userId` と
  `date == YYYY-MM-DD` で購読し、同日完了したルーティーン `routineId` を Today
  画面に反映する。
- ルーティーンを完了に切り替えた際は `routines/{rid}/completions/{YYYY-MM-DD}`
  に `{ id, routineId, userId, date, createdAt }` を書き込み、トランザクションで
  `currentStreak` と `maxStreak`
  を更新する。未完了に戻した場合は同じドキュメントを削除し、`currentStreak`
  をデクリメントする。
- フロントエンドの Firebase 設定は以下の Vite 環境変数で注入する（すべて必須）。

  | 変数名                              | 用途                                 |
  | ----------------------------------- | ------------------------------------ |
  | `VITE_FIREBASE_API_KEY`             | Web API Key                          |
  | `VITE_FIREBASE_AUTH_DOMAIN`         | Auth ドメイン                        |
  | `VITE_FIREBASE_PROJECT_ID`          | プロジェクト ID                      |
  | `VITE_FIREBASE_APP_ID`              | Web アプリ ID                        |
  | `VITE_FIREBASE_STORAGE_BUCKET`      | Storage バケット（任意だが指定推奨） |
  | `VITE_FIREBASE_MESSAGING_SENDER_ID` | メッセージング Sender ID             |

- Emulator Suite を使う場合は `VITE_FIRESTORE_EMULATOR_HOST=localhost:8080` と
  `VITE_AUTH_EMULATOR_URL=http://localhost:9099`
  を設定し、フロントエンドは自動でエミュレータへ接続する。

### Today画面（バックエンドモード）

- `VITE_ROUTINE_DATA_MODE=backend` を指定すると、フロントエンドは Firestore SDK
  の代わりに REST API (`GET /routines`, `PATCH /routines/{id}`,
  `POST /routines/{id}/completions` など) へアクセスする。
- ルーティーン一覧は `/routines?limit=100`
  を定期ポーリングし、Todayの完了状況は各ルーティーンの
  `/routines/{id}/completions?from=YYYY-MM-DD&to=YYYY-MM-DD`
  を集約して判定する。
- 認証ヘッダーは Firebase ID Token (`Authorization: Bearer <token>`)
  を優先し、未取得の場合は開発用に `Authorization: Bearer <uid>` + `X-User-Id`
  をフォールバック送信する。
- バックエンドモードの追加Vite設定:

  | 変数名                      | 用途                                             |
  | --------------------------- | ------------------------------------------------ |
  | `VITE_ROUTINE_API_BASE_URL` | APIベースURL（例: `http://localhost:8787/v1`）   |
  | `VITE_ROUTINE_API_POLL_MS`  | ポーリング間隔（ミリ秒、任意、デフォルト10,000） |

---

## 🔐 認証・セキュリティ

- Firebase Auth (Googleログイン)
- Cloud Functions でJWT検証 (`Authorization: Bearer <FirebaseIDToken>`)
- Firestore Security Rulesにより、

  - 自分のデータのみ書き込み可能
  - 共有投稿は全ユーザ閲覧可能（書き込みは本人のみ）

---

## 🧩 API設計（REST / OpenAPI対応）

Base URL: `https://api.ritu.app/v1` Auth:
`Authorization: Bearer <FirebaseIDToken>` Response: JSON

### エンドポイント一覧

| 区分        | HTTP   | パス                            | 説明                     |
| ----------- | ------ | ------------------------------- | ------------------------ |
| Users       | GET    | /users/me                       | 自分のプロフィール取得   |
| 〃          | PATCH  | /users/me                       | プロフィール更新         |
| Routines    | GET    | /routines                       | 自分のルーティーン一覧   |
| 〃          | POST   | /routines                       | 新規ルーティーン作成     |
| 〃          | PATCH  | /routines/:id                   | 更新                     |
| 〃          | DELETE | /routines/:id                   | ソフトデリート           |
| 〃          | POST   | /routines/:id/restore           | 削除から7日以内に復元    |
| Completions | GET    | /routines/:id/completions       | 日付範囲の完了一覧取得   |
| 〃          | POST   | /routines/:id/completions       | 完了登録                 |
| 〃          | DELETE | /routines/:id/completions/:date | 完了取消（日付指定）     |
| Feed        | GET    | /feed                           | パーソナライズドフィード |
| Posts       | POST   | /posts                          | 手動投稿（共有）         |
| Likes       | POST   | /posts/:id/likes                | いいね追加               |
| Comments    | POST   | /posts/:id/comments             | コメント追加             |
| Social      | POST   | /social/x/tweet                 | X(Twitter)投稿           |
| Analytics   | GET    | /analytics/me/summary           | 自分の集計情報           |
| Admin       | POST   | /admin/jobs/cleanup-deleted     | 7日経過データ削除        |

一覧系エンドポイント（例: `/routines`）は `items`, `page`, `limit`, `total`
を含むJSONペイロードを返却する。

---

### バックエンド環境変数（Firestore）

| 変数名                                                             | 説明                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `FIRESTORE_PROJECT_ID`                                             | 接続先プロジェクトID。Cloud Run 環境では `GOOGLE_CLOUD_PROJECT` が既定で利用される。      |
| `FIRESTORE_EMULATOR_HOST`                                          | `localhost:8080` などを指定すると Firestore Emulator に接続。ローカル開発時はこれを使う。 |
| `FIRESTORE_DATABASE`                                               | データベースID（既定は `(default)`）。                                                    |
| `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_SERVICE_ACCOUNT_JSON` | Firestore 本番接続に用いるサービスアカウント資格情報。片方を設定すればよい。              |
| `ROUTINE_REPOSITORY`                                               | `memory` を指定するとデータストアをインメモリ実装に固定。テスト用途。                     |

Cloud Run
上ではメタデータサーバーからアクセストークンを取得するため、サービスアカウントを明示的に指定しなくても
Firestore に接続できる。

---

### ローカル開発補助タスク

| コマンド                   | 説明                                                      |
| -------------------------- | --------------------------------------------------------- |
| `deno task emulator`       | Firestore / Auth Emulator を起動（要 Firebase CLI）。     |
| `deno task test:firestore` | Firestore Repository のテストをエミュレータに対して実行。 |

エミュレータ実行環境でポートが制限されている場合、コマンドが失敗することがある。その際は
`firebase.json` のポート設定を変更するか、手動で
`firebase emulators:start --only firestore,auth` を実行する。

---

## Firestore デプロイ手順

1. Firebase CLI にログインし、対象プロジェクトを選択する。
   ```bash
   firebase login
   firebase use <prod-project-id>
   ```
2. ルール・インデックスをデプロイする。
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only firestore:indexes
   ```
3. Cloud Run 上ではデフォルトサービスアカウントで Firestore
   に接続できるが、別プロジェクトを参照する場合は `FIRESTORE_PROJECT_ID`
   とサービスアカウント資格情報を環境変数で渡す。

デプロイ後はステージングで動作確認を行い、`deno task test:firestore`
をエミュレータ向けに実行して回帰を防ぐ。

---

## ♻️ データ削除と復元

- `isDeleted=true`, `deletedAt`を設定して**ソフトデリート**
- 復元：7日以内に `isDeleted=false`
- 自動削除：

  - **Cloud Scheduler** (1日1回)
  - または **Firestore TTL Policy**

---

## 💡 ローカル〜本番デプロイ手順

| 対象            | コマンド                                 | 備考               |
| --------------- | ---------------------------------------- | ------------------ |
| Hosting         | `firebase deploy --only hosting`         | Reactの`dist/`配信 |
| Functions       | `firebase deploy --only functions`       | APIデプロイ        |
| Firestore Rules | `firebase deploy --only firestore:rules` | セキュリティ更新   |
| 全体            | `firebase deploy`                        | 一括デプロイ       |

---

## 🧰 開発フロー

1. UI実装（Vite）
2. EmulatorでAuth/Firestore接続
3. API実行（`firebase serve --only functions`）
4. Jest / Integration テスト
5. Firebase Hostingへステージングデプロイ
6. ユーザ検証後に本番反映

---

## 📊 将来拡張方針

- **Tauri / iOS / Android** への展開（同一API利用）
- **Cloud Run** によるX連携・集計処理の高速化
- **Firestore + Cloud Tasks** で自動集計・定期処理
- **多言語対応** (i18n / locale別streak計算)
- **AI推薦機能**（将来的にRAGによる行動提案）

---

## ✅ まとめ

- Firebase中心の**Serverless構成**
- **コスト効率・スケーラビリティ・開発容易性**を両立
- ローカルで完結できる開発環境（Emulator）

---
