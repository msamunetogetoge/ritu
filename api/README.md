# RITU API (Deno + Hono)

このディレクトリは Cloud Run 上で動かす想定のバックエンド（Deno 2 +
Hono）を格納します。ルーティーン閲覧・登録ワークフローを扱う最小構成で、Firestore
実装を差し替えやすいようにレイヤを分割しています。

## ディレクトリ構成と責務

| パス                      | 役割                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main.ts`                 | Deno の HTTP エントリーポイント。`createApp` が返す Hono アプリを `Deno.serve` に渡すだけの薄いラッパーです。                                                                                                            |
| `src/app.ts`              | Hono インスタンス組み立て。認証ミドルウェア、ルーティング登録、エラーハンドリングをまとめます。Cloud Run／テスト双方で同じ構成を再利用できるようにしています。                                                           |
| `src/middlewares/auth.ts` | Firebase ID トークンを検証して `uid` を抽出します。トークンが未取得の場合は開発用に `Authorization: Bearer <uid>` を許容し、`ALLOW_DEV_IMPERSONATION=true` 時のみ `x-user-id` ヘッダーをフォールバックとして利用します。 |
| `src/routes/`             | HTTP ルート宣言。`routes/routines.ts` が RoutineService を HTTP エンドポイント（GET/POST/PATCH/DELETE）にマッピングします。バリデーションは Hono の `validator` を使用。                                                 |
| `src/services/`           | ドメインサービス層。`RoutineService` がルーティーンと完了のユースケース（ソフトデリート復元、ストリーク計算など）を定義します。                                                                                          |
| `src/repositories/`       | 永続化インターフェース。`routine-repository.ts` が抽象化を定義し、`in-memory.ts` がテスト用スタブ実装です。Firestore 実装を追加する場合はこのインターフェースを実装します。                                              |
| `src/types.ts`            | API レスポンス／ユースケースで共有する基本型。OpenAPI の `Routine`/`Completion` スキーマに対応しています。                                                                                                               |
| `src/**/*.test.ts`        | Deno 標準のテスト。サービス層のロジックと HTTP レイヤの挙動をエンドツーエンドに近い形で検証します。                                                                                                                      |

## 実行・開発コマンド

`deno.json` に以下のタスクを定義しています。

```bash
deno task start   # 本番同等の単発実行
deno task dev     # --watch 付きローカル開発
deno task test    # テスト実行（allow系権限はタスク側で付与済み）
deno fmt          # フォーマッタ
deno lint         # Lint
```

リポジトリ直下には
`deno task dev`（scripts/dev.ts）があり、API（インメモリ実装）とフロントエンドの
Vite 開発サーバを同時に立ち上げられます。

その他のユーティリティタスク:

```bash
deno task emulator       # Firebase Emulator (firestore/auth) 起動
deno task test:firestore # Firestore 実装向けテストをエミュレータに対して実行
```

## Firestore デプロイ

Firebase CLI を用いて本番 Firestore
のルールやインデックスを更新する手順は以下の通りです。

```bash
firebase login
firebase use <prod-project-id>
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Cloud Run
ではメタデータサーバ経由でアクセストークンが取得されるため、同一プロジェクトであれば追加設定は不要です。別プロジェクトを参照する場合は
`FIRESTORE_PROJECT_ID`
やサービースアカウントの資格情報を環境変数で指定してください。

## Firestore 接続設定

| 変数名                           | 必須 | 説明                                                                                      |
| -------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `FIRESTORE_PROJECT_ID`           | ◯    | 接続先の GCP プロジェクトID。Cloud Run では `GOOGLE_CLOUD_PROJECT` が入るため省略可能。   |
| `FIRESTORE_DATABASE`             | -    | 既定は `(default)`。マルチDB利用時のみ指定。                                              |
| `FIRESTORE_EMULATOR_HOST`        | -    | `localhost:8080` のように指定すると Firestore Emulator に接続し、認証なしで利用できます。 |
| `GOOGLE_APPLICATION_CREDENTIALS` | -    | サービスアカウントJSONへのパス。ローカルから本番 Firestore へ接続する際に使用。           |
| `FIREBASE_SERVICE_ACCOUNT_JSON`  | -    | サービスアカウントJSON文字列（base64デコード結果など）。パス指定の代替。                  |
| `ROUTINE_REPOSITORY`             | -    | `memory` を指定すると強制的にインメモリ実装を利用します（テスト用途）。                   |

Cloud Run
上ではメタデータサーバ経由でデフォルトサービスアカウントのトークンを取得するため、追加の設定なしで
Firestore に接続できます。

## Cloud Run（開発環境）デプロイ

ルートの `cloudbuild.yaml` で Cloud Build → Artifact Registry → Cloud Run
の流れを自動化しています。

1. Artifact Registry（例: `ritu-be-itg-YYYYMMDD`）を `asia-northeast1` に作成\
   `gcloud artifacts repositories create ritu-be-itg-20250205 --repository-format=docker --location=asia-northeast1 --project ritu-475021`
2. Cloud Build を実行し、コンテナをビルド＆デプロイ\
   `gcloud builds submit --config cloudbuild.yaml --substitutions=_REPO=ritu-be-itg-20250205,_TAG=dev,_FIRESTORE_PROJECT_ID=ritu-9cfb0 --project ritu-475021`
3. Cloud Run のデフォルトドメイン（`https://<service>-<hash>-uc.a.run.app`）を
   `VITE_ROUTINE_API_BASE_URL` に設定してください。

主要環境変数（Cloud Run デプロイ時に指定）

- `FIRESTORE_PROJECT_ID`: 例 `ritu-9cfb0`
- `ALLOW_DEV_IMPERSONATION`: `true` で `Authorization: Bearer <uid>` /
  `X-User-Id` フォールバックを許可（開発用）
- Feature flags（デフォルト `false`）
  - `FEATURE_FLAG_BILLING`
  - `FEATURE_FLAG_NOTIFICATIONS`
  - `FEATURE_FLAG_LINE_INTEGRATION`
  - `FEATURE_FLAG_COMPLETIONS`
  - `FEATURE_FLAG_COMMUNITY`
  - `FEATURE_FLAG_PROFILE_DETAILS`（プロフィール編集は使うので `true` 推奨）
- LINE 連携
  - `LINE_CHANNEL_ACCESS_TOKEN`: Messaging API
    のチャネルアクセストークン（Push送信に利用）
  - `LINE_CHANNEL_SECRET`: Webhook 署名検証用
  - `LINE_LOGIN_CHANNEL_ID`: LINE Login
    IDトークン検証用のチャネルID（`/v1/line/login` で利用）

## Firestore 実装の組み込み方針

1. `src/repositories` に Firestore 版 `RoutineRepository`
   を追加し、`RoutineService` から利用する CRUD / クエリ /
   トランザクション処理を実装します。
2. `createApp` に依存性注入を追加し、環境変数や DI コンテナから Firestore
   実装を渡します。ローカルテストでは既存の `InMemoryRoutineRepository`
   を指定すると良いです。
3. 認証ミドルウェアを Firebase ID トークン検証に置き換え、`userId` へ `uid`
   を詰めるようにします。

## テスト指針

- サービス層は `RoutineService`
  のユニットテストでビジネスルールを担保します（ストリーク計算、削除復元ウィンドウなど）。
- ルート層は `routes/routines_test.ts` のように Hono
  アプリへリクエストを投げ、HTTP レスポンスを検証します。
- Firestore 実装を導入した場合は Firebase Emulator Suite を利用した結合テストを
  `deno test --allow-env --allow-net` で走らせる想定です。

## コメント方針（ざっくりルール）

- 何の責務かが一見で判断しづらいクラス・関数・定数にだけコメントを添える（ドキュメントコメントは日本語でOK）。
- 型定義ファイルでは「どのAPIやFirestoreフィールドと対応しているか」を記載し、利用場所を推測できるようにする。
- アプリ全体の振る舞いに影響するマジックナンバーや正規表現には、意味（単位・フォーマット）を明記する。
- 詳細な制御フロー／ストレージアクセスについてはサービスやミドルウェアのプライベートメソッドに短文コメントを添え、呼び出し側から仕組みを追い直さなくて済むようにする。
- 自明な代入・変数宣言にはコメントを付けない。Markdown
  として残したい長文説明やチートシートはこの README か `docs/` 配下にまとめる。

## バックエンド開発ロードマップ

| 項目                                          | ステータス | メモ                                                                                                                                                  |
| --------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/v1/health`                                  | 完了       | Hono ルート実装済み。稼働確認用の疎通エンドポイント。                                                                                                 |
| `/v1/routines` (GET/POST/PATCH/DELETE)        | 完了       | InMemory リポジトリ上で CRUD が動作。OpenAPI 仕様に合わせて `total` を含むレスポンスを返却。                                                          |
| `/v1/routines/:id/restore`                    | 完了       | 7日間のソフトデリート復元ロジックとテストを実装。                                                                                                     |
| `/v1/routines/:id/completions` (GET/POST)     | 完了       | 日付バリデーションとストリーク再計算を含む。                                                                                                          |
| `/v1/routines/:id/completions/:date` (DELETE) | 完了       | REST 仕様に追記済み。取り消し後にストリークを再計算。                                                                                                 |
| Firestore 版 RoutineRepository                | 未着手     | 現状は InMemory スタブのみ。Firestore Emulator/本番への書き込み確認が必要。                                                                           |
| Firebase ID トークン検証ミドルウェア          | 完了       | `authMiddleware` が Firebase ID トークンから `uid` を検証・抽出し、`ALLOW_DEV_IMPERSONATION=true` のときのみフォールバックとして `x-user-id` を利用。 |
| 自動テスト: サービス/ルート                   | 完了       | Deno 標準テストで主要ユースケースをカバー。                                                                                                           |
| 自動テスト: Firestore 結合                    | 未着手     | エミュレータを使った E2E テストの追加が必要。                                                                                                         |
| デプロイ設定 (Cloud Run/Firebase)             | 未着手     | `deno task start` に相当する本番ビルド／インフラ設定は今後整備。                                                                                      |

### 次に取り組むとよさそうな優先タスク

1. Firestore 版 `RoutineRepository` を実装し、エミュレータで CRUD
   とストリーク更新を検証する。
2. Firebase Admin SDK を用いた ID トークン検証を `authMiddleware`
   に組み込み、権限制御を強化する。
3. Firestore 実装を前提とした統合テストと CI タスクを追加し、`deno task test`
   で自動化する。

## 今後の拡張メモ

- `ServiceError` を拡張して、OpenAPI の `error`
  レスポンスに合わせたエラー構造を揃える。
- `authMiddleware` を Firebase Admin SDK ベースに切り替え、`userId` だけでなく
  `claims` も格納する。
- ストリーク計算は Firestore
  側で集計しやすいよう、更新時にトランザクションを使って整合性を保つ。
