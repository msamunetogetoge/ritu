```mermaid
flowchart LR
  actor((User))

  subgraph App["RITU App"]
    UC_Login["Googleでログイン"]
    UC_RoutineCRUD["ルーティンを登録/編集/削除"]
    UC_AddNoti["通知を追加/編集/削除\n(ルーティン毎)"]
    UC_LineLink["LINE連携する\n(LIFFでログイン & 友だち追加)"]
    UC_PayWall["通知3件目で課金案内"]
    UC_Subscribe["月額500円を開始(Stripe)"]
    UC_Unsubscribe["サブスク解除(いつでも)"]
    UC_Receive["定時通知を受け取る(LINE)"]
  end

  actor --> UC_Login
  actor --> UC_RoutineCRUD
  actor --> UC_AddNoti
  UC_AddNoti --> UC_LineLink

  UC_AddNoti --> UC_PayWall
  UC_PayWall --> UC_Subscribe
  actor --> UC_Subscribe
  actor --> UC_Unsubscribe

  UC_LineLink --> UC_Receive
  UC_AddNoti --> UC_Receive

  %% Notes (relationships)
  UC_Subscribe --> UC_AddNoti
  UC_Unsubscribe --> UC_AddNoti