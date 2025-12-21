# RITU Web (React + Firebase)

クラウドラン上の Deno API と連携し、Today
画面のルーティーン体験を提供するフロントエンドです。Vite + React
で構築し、Firebase Auth / Firestore を直接購読する標準モードに加え、環境変数で
REST API 経由に切り替えられます。

> **前提**: Deno 2.5 以上をインストールしてください。初回の `deno task` 実行時に
> npm 依存が自動的に取得されます。

## ディレクトリ構成

| パス                              | 役割                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `src/App.tsx`                     | Today 画面のシェル。認証制御と各コンポーネントの組み立てを担当します。            |
| `src/features/routines/`          | Today 画面のプレゼンテーション（components）、ロジック（hooks）、型定義。         |
| `src/services/routine-service.ts` | Firestore / REST API を切り替えるデータアクセス層。購読・作成・完了登録を共通化。 |
| `src/lib/firebase.ts`             | Firebase SDK の初期化とエミュレータ接続。                                         |
| `src/index.css`                   | Today 画面のスタイル。                                                            |
| `src/main.tsx`                    | React アプリのエントリーポイント。                                                |
| `public/`                         | アイコンや静的アセット。                                                          |

## セットアップ

```bash
cd ritu

# 依存解決は deno が npm パッケージを自動取得するため省略可能
# （IDE向けに node_modules が必要なら `pnpm install` などを実行）

# 開発サーバ（Vite）
deno task dev

# 型チェック＆ビルド
deno task build

# Lint（ESLint）
deno task lint

# ビルド成果物のプレビュー
deno task preview

# ルートディレクトリからAPI + Webを同時起動
# （インメモリBackend + Viteの組み合わせ）
deno task dev  # => scripts/dev.ts

# Firestore エミュレータと統合テスト
deno task emulator       # Firebase Emulator (firestore/auth) を起動
deno task test:firestore # API側のFirestoreリポジトリテストを実行（エミュレータ宛）
```

> NOTE: サンドボックス環境などポートが制限されている場合、`deno task emulator`
> はポート確保に失敗することがあります。その際は
> `firebase emulators:start --only firestore,auth` を直接実行し、`firebase.json`
> のポート設定を調整してください。

Firebase Emulator を使用する場合は `.env.local`
などで環境変数を設定してください。

```bash
VITE_FIREBASE_API_KEY=xxxx
VITE_FIREBASE_AUTH_DOMAIN=xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxxx
VITE_FIREBASE_APP_ID=1:xxx:web:yyy
VITE_FIRESTORE_EMULATOR_HOST=localhost:8080
VITE_AUTH_EMULATOR_URL=http://localhost:9099
```

### バックエンド経由モード

`VITE_ROUTINE_DATA_MODE=backend` を設定すると、Firestore SDK の代わりに REST API
を通じてルーティーンや完了状態を取得／更新します。

```bash
VITE_ROUTINE_DATA_MODE=backend
VITE_ROUTINE_API_BASE_URL=http://localhost:8787/v1  # or Cloud Run URL
# 任意: 完了状況のポーリング間隔（ミリ秒）
VITE_ROUTINE_API_POLL_MS=10000
```

このモードでは `/routines` をポーリングし、各ルーティーンに対して
`/routines/{id}/completions?from=YYYY-MM-DD&to=YYYY-MM-DD` を呼び出して
Today画面の完了状態を合成します。Firestore エミュレータは不要ですが、Firebase
Auth で取得した ID トークンがあれば自動で `Authorization: Bearer <token>`
に差し替えられます。

### LINE 通知 / LINE Login 設定

- LIFF で LINE Login を行い、ID トークンを取得するために `VITE_LINE_LIFF_ID`
  を設定してください。
- 通知設定画面の「LINEログインして連携」ボタンから取得した ID トークンを
  `POST /v1/line/login` に送り、`notificationSettings.lineUserId`
  を保存します（バックエンド側では `LINE_LOGIN_CHANNEL_ID` が必要です）。

## コメント方針（フロントエンド）

- コメントは VS Code で視認しやすいよう `/* ... */` のブロック形式で記載します。
- UI の型やコンポーネント、Firestore
  連携ロジックなど他ファイルから読み取るのが難しい責務には、用途説明を添えます。
- マジックナンバーや正規表現が登場する場合は、単位や意図をコメントで明記します。
- 自明な JSX やスタイル宣言にはコメントを付けません。開発ノートや長文説明は
  `docs/` ディレクトリ側にまとめます。

## Firestore と API の関係

- デフォルトモードでは Firestore を直接購読しつつ、Cloud Run のバックエンド API
  と整合性がとれるように同じフィールド名を採用しています。
- バックエンドモードでは REST API (`/routines`, `/routines/{id}/completions`)
  をポーリングし、 Today 画面の完了状況をクライアント側で合成します。
- `RoutineRecord` や `CompletionRecord` は OpenAPI の `Routine`/`Completion`
  スキーマと同じ項目で構成されており、バックエンドの変更時は型とコメントを更新してください。
- 完了トグル (`setTodayCompletion`) では Firestore トランザクションまたは API
  経由のPOST/DELETEを通じてストリークを更新します。バックエンド側の計算ロジックと矛盾がないか適宜確認します。

## 今後の改善候補

1. API モードのポーリングを WebSocket / SSE
   や差分フェッチへ置き換え、帯域と遅延を最適化する。
2. Zustand や React Query を導入し、購読ロジックとキャッシュを分離する。
3. Storybook を導入して `RoutineCard` などの UI を単体検証できるようにする。
4. Today 画面以外のルーティーン編集画面を作成し、API の PATCH/DELETE
   を活用する。
