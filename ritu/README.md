# RITU Web (React + Firebase)

クラウドラン上の Deno API と連携し、Today
画面のルーティーン体験を提供するフロントエンドです。Vite + React
で構築し、Firebase Auth / Firestore を直接購読してリアルタイム更新を行います。

> **前提**: Deno 2.5 以上をインストールしてください。初回の `deno task` 実行時に
> npm 依存が自動的に取得されます。

## ディレクトリ構成

| パス                              | 役割                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| `src/App.tsx`                     | Today 画面の UI と状態管理。Firestore 購読や完了トグルをまとめています。 |
| `src/services/routine-service.ts` | Firestore との直接的な読み書きロジック（購読、作成、完了登録）。         |
| `src/lib/firebase.ts`             | Firebase SDK の初期化とエミュレータ接続。                                |
| `src/index.css`                   | Today 画面のスタイル。                                                   |
| `src/main.tsx`                    | React アプリのエントリーポイント。                                       |
| `public/`                         | アイコンや静的アセット。                                                 |

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
```

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

## コメント方針（フロントエンド）

- コメントは VS Code で視認しやすいよう `/* ... */` のブロック形式で記載します。
- UI の型やコンポーネント、Firestore
  連携ロジックなど他ファイルから読み取るのが難しい責務には、用途説明を添えます。
- マジックナンバーや正規表現が登場する場合は、単位や意図をコメントで明記します。
- 自明な JSX やスタイル宣言にはコメントを付けません。開発ノートや長文説明は
  `docs/` ディレクトリ側にまとめます。

## Firestore と API の関係

- フロントエンドは Firestore を直接購読しつつ、Cloud Run のバックエンド API
  と整合性がとれるように同じフィールド名を採用しています。
- `RoutineRecord` や `CompletionRecord` は OpenAPI の `Routine`/`Completion`
  スキーマと同じ項目で構成されており、バックエンドの変更時は型とコメントを更新してください。
- 完了トグル (`setTodayCompletion`) では Firestore
  トランザクションを使用し、`currentStreak`/`maxStreak`
  を即時反映します。バックエンド側のストリーク計算ロジックと矛盾がないか適宜確認します。

## 今後の改善候補

1. API 経由の読み書きへ切り替え、Firestore
   直接アクセスをバックエンドに集約する。
2. Zustand や React Query を導入し、購読ロジックとキャッシュを分離する。
3. Storybook を導入して `RoutineCard` などの UI を単体検証できるようにする。
4. Today 画面以外のルーティーン編集画面を作成し、API の PATCH/DELETE
   を活用する。
