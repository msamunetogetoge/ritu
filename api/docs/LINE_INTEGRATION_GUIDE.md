# LINE Messaging API 連携ガイド

LINEユーザーIDを取得し、メッセージを送信するための手順を説明します。

## 概要

LINE Messaging APIを使用してユーザーにメッセージを送るには、送信先の**User ID**（`U`から始まる文字列）が必要です。
このIDは、ユーザーがLINE公式アカウント（Bot）と対話した際（友だち追加、メッセージ送信など）に、LINEプラットフォームから送信される**Webhook**を通じて取得できます。

## 手順

### 1. Webhook URLの設定

1.  アプリケーションにWebhook受け取り用のエンドポイント（例: `/v1/line/webhook`）を作成します。
2.  開発環境（ローカル）で動作確認する場合、`ngrok` などを利用してローカルサーバーをインターネットに公開するか、クラウド上の開発環境のURLを使用します。
3.  [LINE Developers Console](https://developers.line.biz/console/) にログインし、チャネル設定の「Messaging API設定」タブを開きます。
4.  「Webhook URL」にエンドポイントのURL（例: `https://your-domain.com/v1/line/webhook`）を入力し、検証します。
5.  「Webhookの利用」を有効にします。

### 2. User IDの取得方法

Webhookエンドポイントで受け取るJSONペイロードには、イベントが発生したユーザーのIDが含まれています。

例（友だち追加イベント `follow`）:
```json
{
  "events": [
    {
      "type": "follow",
      "replyToken": "...",
      "source": {
        "userId": "U1234567890abcdef1234567890abcdef", // これが必要なID
        "type": "user"
      },
      ...
    }
  ]
}
```

この `source.userId` をデータベースの `users` コレクションの `notificationSettings.lineUserId` に保存することで、そのユーザーに対してプッシュメッセージを送信できるようになります。

### 3. アカウント連携（Account Linking）について

アプリのユーザーとLINEユーザーを紐付けるには、以下のいずれかの方法が一般的です。

*   **方法A（簡易版）**: ユーザーに「Botに特定のキーワード（例: アプリの登録メールアドレスやID）」を送ってもらい、Webhookでそれを検知して紐付ける。
*   **方法B（推奨・安全）**: LINE Loginを使用し、アクセストークンからUser IDを取得する。
*   **方法C（Account Link機能）**: Messaging APIの「連携トークン」を発行し、ユーザーをアプリの連携画面に誘導して紐付ける。

今回はまず、Webhookを受け取り、ログにUser IDを表示する機能を実装し、IDが取得できることを確認します。
