# Spots プロジェクトサマリー（更新: 2025-02-XX）

## 開発ステータス
- Private Alpha（渋谷ローカルテスター対象）
- npm workspaces構成（frontend / backend / firebase/functions）
- フロント: React 18 + Vite + TypeScript + Mapbox GL + Firebase Web SDK + SWR
- バックエンド: Express + Firebase Admin SDK + Stripe SDK + Zod を Firebase Functions にデプロイ
- インフラ: Firestore / Storage / Stripe Billing / Sentry（asia-northeast1）

## 実装済み機能ハイライト
- **地図と探索**: Mapbox地図表示、カテゴリタブ、Map/Listビュー切替、履歴付き検索オーバーレイ、トレンドビュー（人気ランキング＋プロモーション）
- **投稿と告知運用**: Spot投稿フォーム（位置選択・画像アップロード・バリデーション）、Tier/クォータ対応の予約告知作成、`processScheduledSpots` による審査済み公開と Promotion 連携
- **ソーシャル & 通知**: いいね・お気に入り・フォロー・コメント（画像添付・ページング・Like）、フォロー中投稿フィード、Firestore通知購読 + ローカル通知
- **管理オペレーション**: 管理者ダッシュボード（フィルタ・テンプレ適用・レビュー履歴・CSVエクスポート）、審査テンプレ管理、Promotion下書き
- **課金とクォータ**: Stripe Checkout / Portal エンドポイント、Webhook冪等ストアとプラン反映、Firestore通知と運用アラート、クォータ自動リセット
- **可観測性 & 分析**: Sentry 初期化/ユーザー設定（フロント・バック・Functions）、GA4/Mixpanelラッパ、Stripe/Scheduled処理のログとアラート補足

## 進行中・未実装トピック
- 検索APIやサジェストは未接続（検索オーバーレイはローカルフィルタのみ）
- テスト自動化は最小限（Vitestでサービス層一部）で、E2E/統合テストは未整備
- レスポンシブ最適化・アクセシビリティ改善（フォーカス管理/コントラスト/スクリーンリーダー）は追加対応が必要
- GA4/Mixpanelトークン設定とイベント命名規約の確定、ダッシュボード整備が未完
- Stripe Webhook / 定期バッチのステージング検証と運用Runbook更新が継続タスク
- Secrets・環境変数は `.env.example` と Functions Config の同期運用が未確立（Vault管理前提）

## 技術構成
- **Frontend**: React, Vite, TypeScript, Mapbox GL, SWR, Firebase Auth/Firestore/Storage SDK, Sentry React
- **Backend**: Node.js + Express, Firebase Admin, Stripe, Zod, Vitest、`@shibuya/backend` としてビルド
- **Functions**: Firebase Functions (`api`, `stripeWebhook`, `processScheduledSpots`, `refreshPopularSpots`, `tidyPromotions`, `resetPosterQuotas`)
- **データストア**: Firestore（スポット/予約/通知/ランキング/課金イベント/ソーシャル関係）、Firebase Storage（画像）
- **外部サービス**: Stripe Billing、Mapbox、Sentry、（任意）GA4 / Mixpanel

## 主要データモデル
- `users/{uid}`: poster_tier, promotion_quota, followers_count, favorite_spot_ids, followed_user_ids, flags, stripe_customer_id, metadata
- `spots/{spotId}`: title, description, category, lat/lng, start_time, end_time, owner_id, likes, comments_count, created_at, image_url
- `scheduled_spots/{id}`: publish_at, start/end_time, announcement_type, status, review_notes, owner_id, image_url, created_at
- `promotions/{id}` / `leaderboards/popular_spots/entries/{spotId}`: Promotionスケジュール、公開中スポットへの紐付け、優先度、ランキングスコア
- `notifications/{id}`: user_id, title, body, category (`billing`/`moderation`/`system`), metadata, priority, read, created_at
- `stripe_webhook_events/{eventId}`: status, type, attempts, processedAt, lastError といったWebhook冪等管理

## API サマリー（抜粋）
| Method | Path | 説明 |
| --- | --- | --- |
| GET | /api/health | ヘルスチェック |
| GET | /api/spots | スポット一覧（カテゴリ・フォローフィルタ対応） |
| POST | /api/spots | スポット投稿（Firebase IDトークン必須） |
| GET | /api/spots/:id | スポット詳細取得 |
| GET/POST | /api/spots/:id/comments | コメント取得・投稿 |
| POST | /api/like_spot / /api/unlike_spot | いいね／解除 |
| POST | /api/favorite_spot / /api/unfavorite_spot | お気に入り登録／解除 |
| POST | /api/follow_user / /api/unfollow_user | ユーザーフォロー操作 |
| GET | /api/followed_posts | フォロー中ユーザーの投稿フィード |
| GET | /api/profile | ログインユーザーのプロフィール取得 |
| PUT | /api/profile | プロフィール更新（表示名/アイコン/カテゴリ） |
| POST | /api/billing/create_checkout_session | Stripe Checkout セッション作成 |
| POST | /api/billing/create_portal_session | Stripe Customer Portal セッション作成 |
| GET/POST | /api/scheduled_spots... | 予約告知 CRUD（ユーザー自身） |
| GET/POST | /api/admin/scheduled_spots... | 管理者審査・テンプレ・ログ取得（`admin` クレーム必須） |
| GET | /api/promotions | 公開中 Promotion 取得 |

## バッチ / 自動処理
| Function | トリガー | 役割 |
| --- | --- | --- |
| `processScheduledSpots` | 5分毎 | 承認済み予約告知を `spots` へ公開し Promotion を有効化 |
| `refreshPopularSpots` | 15分毎 | `leaderboards/popular_spots` を再計算 |
| `tidyPromotions` | 24時間毎 | 期限切れ Promotion の失効処理 |
| `resetPosterQuotas` | 月次 (0 3 1 * *) | Poster Tier に応じたクォータ再配布 |
| `stripeWebhook` | HTTPS | Stripeイベント冪等処理（プラン反映・通知） |
| `api` | HTTPS | Express アプリ全エンドポイント（asia-northeast1） |

## 開発フロー
- `npm install`（ルートで依存関係を一括インストール）
- フロント: `npm run dev --workspace frontend`（`frontend/.env` に Mapbox・Firebase 設定を用意）
- バックエンド: `npm run dev --workspace backend` でローカルAPI（要 `backend/.env` に Firebase Admin/Stripe鍵）
- Functions: `npm run build --workspace backend` 後、`firebase/functions` で `npm run serve` or `firebase emulators:start --only functions`
- 本番ビルド: `npm run build --workspaces`

## テスト / 品質
- `npm run test --workspace backend` で Vitest 実行（`scheduledSpotService` レビュー処理のユニットテスト）
- 静的解析: `npm run lint --workspaces`（ESLint + Prettier 設定）
- 今後: API統合テスト（Supertest）、E2E（Playwright）、CI/CD（GitHub Actions）整備が必要

## 運用メモ
- 必須環境変数: Firebase Web APIキー群、Firebase Admin 認証情報、Mapboxトークン、Sentry DSN, Stripe APIキー/Price ID/Webhook Secret, GA4/Mixpanelトークン（任意）
  - 新規: SMS認証ハッシュ用の `PHONE_HASH_SECRET`
- Billingアラート送付先: `BILLING_ALERT_RECIPIENT_UIDS` or `firebase functions:config:set alerts.billing_recipient_uids=...`
- 支援窓口: `support@shibuya-livemap.local`（UI内リンクあり）、Billing FAQ (`/billing-faq.html`)
- Secretsはローカル `.env` と Functions Config の二重管理を避け、Vault等からデプロイスクリプトで注入する運用を想定

## 参考ドキュメント
- [要件定義書](docs/requirements.md)
- [Operations ガイド](docs/operations.md)
- [Billing Operations Guide](docs/billing-operations.md)
- [Development Plan](docs/development-plan.md)
- [Monetisation Roadmap](docs/monetisation-roadmap.md)
- [Architecture Overview](docs/architecture.md)
