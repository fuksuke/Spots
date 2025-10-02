# Spots 要件定義書（更新版）

- **名称**: Spots (Shibuya LiveMap MVP)
- **フェーズ**: Private Alpha（社内 / 招待ユーザー向けテスト）
- **対象エリア**: 渋谷駅を中心とした半径約1.5km
- **主要ユーザー**: ライブ/イベント主催者、公式スポンサー、飲食店、テスターコミュニティ
- **提供価値**: 投稿〜審査〜公開〜課金を一気通貫で運用できるローカルイベントプラットフォーム
- **直近の指標**: 週次アクティブ投稿者数、審査済み予約告知件数、課金導線の成功率、プロモーションCTR
- **チーム体制**: 個人開発（solo developer）

## 2. 技術構成
- **フロントエンド**: React + Vite / TypeScript、Mapbox GL JS、SWR、Firebase SDK、Sentry（ブラウザ）
- **バックエンド**: Node.js + Express、Firebase Admin SDK、Zod、Stripe SDK、Sentry（Node）
- **Firebase**: Firestore（本番データ）、Storage（画像）、Auth（IDトークン）、Cloud Functions（API + バッチ）
- **課金/決済**: Stripe Billing（Checkout / Customer Portal / Webhook）
- **可観測性**: Sentry、Cloud Logging、Stripe Webhook Eventストア
- **分析**: GA4 / Mixpanel（イベントマップ準備済み、導入切替可）

## 3. コア機能スコープ
1. **地図・探索**
   - Mapbox GLベースの地図表示、カテゴリタブ、マップ/リスト切替
   - 人気スポットパネル、検索履歴・サジェスト、フォロー投稿フィード
2. **投稿・予約告知**
   - 即時投稿フォーム（位置選択、画像アップロード、バリデーション）
   - 予約告知（短期告知 / 長期キャンペーン）作成・編集・キャンセル
   - 告知公開ジョブ、プロモーションバナー反映
3. **ソーシャル・通知**
   - コメント / いいね / フォロー、アプリ内通知、Firestoreリアルタイム連携
   - 審査結果・課金イベント発火時のプッシュ通知（アプリ内トースト）
4. **課金・クォータ管理**
   - Stripe Checkout導線、Billing FAQ、成功/失敗トースト
   - Stripe Portal遷移、顧客ID連携、プランごとのクォータ設定
   - 月次クォータ自動リセット（スケジュール Function）
   - Webhook冪等化と通知フロー、アラート受信者設定
5. **管理オペレーション**
   - 審査ダッシュボード（フィルタ、検索、コメントテンプレ、CSVエクスポート）
   - 審査履歴ログ、ステータス遷移追跡、通知テンプレート
   - Stripe異常時アラート、Sentry/Cloud Loggingモニタリング

## 4. データモデル（主要コレクション）
```json
users/{uid} {
  poster_tier: "tier_c" | "tier_b" | "tier_a",
  promotion_quota: { short_term?: number, long_term?: number },
  promotion_quota_updated_at: ISOString,
  followers_count: number,
  engagement_score: number,
  stripe_customer_id: string | null,
  flags: { is_verified: boolean, is_sponsor: boolean }
}

spots/{spotId} {
  title: string,
  description: string,
  category: "live" | "event" | "cafe" | "coupon" | "sports",
  lat: number,
  lng: number,
  start_time: timestamp,
  end_time: timestamp,
  image_url: string | null,
  owner_id: string,
  likes: number,
  comments_count: number,
  created_at: timestamp
}

scheduled_spots/{id} {
  title: string,
  description: string,
  category: string,
  lat: number,
  lng: number,
  start_time: timestamp,
  end_time: timestamp,
  publish_at: timestamp,
  owner_id: string,
  announcement_type: "short_term_notice" | "long_term_campaign",
  status: "pending" | "approved" | "published" | "rejected" | "cancelled",
  review_notes: string | null,
  created_at: timestamp,
  image_url: string | null
}

promotions/{id} {
  owner_id: string,
  spot_id: string | null,
  publish_at: timestamp,
  expires_at: timestamp,
  headline: string,
  cta_url: string | null,
  image_url: string | null,
  priority: number,
  status: "scheduled" | "active" | "expired"
}

notifications/{id} {
  user_id: string,
  title: string,
  body: string,
  category: "billing" | "moderation" | "system",
  metadata: Record<string, unknown>,
  priority: "standard" | "high",
  read: boolean,
  created_at: timestamp
}

stripe_webhook_events/{eventId} {
  status: "processing" | "processed" | "failed",
  type: string,
  attempts: number,
  lastAttemptAt: ISOString,
  processedAt?: ISOString,
  lastError?: string
}

scheduled_spot_review_logs/{logId} {
  spot_id: string,
  actor_uid: string,
  actor_email: string | null,
  previous_status: string,
  next_status: string,
  review_notes: string | null,
  created_at: timestamp
}
```

## 5. API サーフェス（抜粋）
| エンドポイント | メソッド | 説明 |
| --- | --- | --- |
| `/api/spots` | GET | カテゴリ/フォローフィルタ付きスポット一覧 |
| `/api/spots` | POST | 新規スポットを投稿（IDトークン必須） |
| `/api/spots/:id` | GET | スポット詳細取得 |
| `/api/spots/:id/comments` | GET/POST | コメント一覧・投稿 |
| `/api/spots/:id/like` | POST | いいね追加/解除 |
| `/api/scheduled_spots` | GET/POST | 予約告知取得・作成 |
| `/api/scheduled_spots/:id` | PUT/DELETE | 予約告知更新・キャンセル |
| `/api/scheduled_spots/:id/review` | POST | 管理者による審査決定 |
| `/api/admin/scheduled_spots/review_templates` | GET | 審査コメントテンプレート一覧（管理者用） |
| `/api/promotions` | GET | 公開中のプロモーションバナー取得 |
| `/api/profile/me` | GET | ログインユーザーのプロフィール/クォータ取得 |
| `/api/billing/create_checkout_session` | POST | Stripe Checkout セッション生成 |
| `/api/billing/create_portal_session` | POST | Stripe Customer Portal セッション生成 |
| `/api/notifications` | GET | 未読通知取得（Firebase SDK利用） |

## 6. 自動化・バッチ処理
| Function | トリガー | 説明 |
| --- | --- | --- |
| `processScheduledSpots` | 5分 | 審査済み予約告知を公開し `spots` へ書き込み、必要なら `promotions` を更新 |
| `tidyPromotions` | 1日 | 期限切れのプロモーションを失効させる |
| `refreshPopularSpots` | 15分 | 人気スポットランキングを再計算 |
| `resetPosterQuotas` | 月次 (毎月1日) | ユーザーのプロモ枠クォータをTier設定に基づいてリセット |
| `stripeWebhook` | HTTP | Stripeイベント処理、冪等ストア+通知連携 |

## 7. 可観測性・アラート
- **Sentry**: フロント/バックエンド/Functions 全てでDSN設定済み。環境別 `SENTRY_ENVIRONMENT` を指定してアラートを分離可能。
- **Cloud Logging**: `stripeWebhook` や予約ジョブの実行ログを記録。課金異常/再試行は `stripe_webhook_events` とログで追跡。
- **課金アラート**: `BILLING_ALERT_RECIPIENT_UIDS`（または Functions Config）で指定したUIDへ高優先度通知を送信。Stripeプラン解析失敗時などに運用へ即時連絡。

## 8. テスト・品質保証
- **単体テスト**: Vitest（バックエンド services 層）
- **自動テスト予定**: PlaywrightによるE2E、SupertestによるAPI統合テスト（Sprint 3で拡充）
- **手動テスト**: Stripe CLIによる課金導線検証、Map/投稿フローのスモークテスト、審査ダッシュボードの確認

## 9. 運用・リリース体制
- **環境変数管理**: `.env`（ローカル）＋ Firebase Functions Config（本番）。Stripe鍵、Portal/Return URL、Sentry DSN を含む。
- **デプロイ手順**: フロント（Vite build → Vercel/Netlify）、バックエンド/Functions（`npm run build` → `firebase deploy --only functions`）。
- **バックログ運用**: READMEのスプリントテーマを基に GitHub Issues / Project でタスク管理。
- **サポート**: Billing FAQ、サポートメール（`support@shibuya-livemap.local`）、通知テンプレートを整備。
- **審査テンプレート管理**: `backend/src/constants/moderation.ts` でテンプレ文面を定義し、管理UIは `/api/admin/scheduled_spots/review_templates` から取得。Firestoreレビュー履歴・通知メタデータにも `review_template_id` を保存。

## 10. 今後のロードマップ
1. **課金/クォータ強化**: Stripe Portal UI改善、Webhook異常時の自動復旧、請求ダッシュボード
2. **審査オペレーション**: テンプレ管理、監査ログポリシー、Sentry & Cloud Logging アラート設計
3. **計測・UX**: GA4/Mixpanelイベント実装、CTRダッシュボード、モバイル/A11y改善、E2Eテスト導入
4. **公開準備**: テストリリース判定会、テスター招待フロー、フィードバックループの定着

---
本ドキュメントは2025-10-XX 時点の実装・運用状況を反映しています。以降の変更は README と Docs を同時に更新してください。
