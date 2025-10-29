# Spots プロジェクトサマリー（更新: 2025-10-30 (Latest sync)）

## 現況まとめ
- Stage: Private Alpha (渋谷ローカルテスター向け)。投稿・ソーシャル・課金・審査ラインは通しで動作。
- Map/検索UX: タイルベースの LOD 切替と DOM300 制御は導入済み。DOM 超過時は canvas フォールバックへ退避し、プレミアム投稿は優先表示。Tap-to-Grow や WebGL 点群など v0.3 の演出系は未実装。
- オペレーション: Firebase Functions で予約投稿処理/ランキング/Stripe Webhook/Quota リセットを運用、Firestore 通知と In-app トーストで利用者アラートを補完。
- 安全性: 投稿・予約は SMS 本人確認必須。認証モーダル/phone_hash 保存/Functions との同期を実装済み。
- 既知ギャップ: 行きたい通知/通報・信頼スコア・高度検索・距離/料金メタデータ・地図パフォーマンスなどは仕様書の範囲に届いておらず、今後の開発対象。

## スペック準拠状況
### `spots_plan_v0.1.md`
- ✅ 投稿・いいね・コメント（画像付）・フォロー/フォローフィード・お気に入り・カテゴリフィルタ・検索オーバーレイ・予約告知（quota/Tier/審査）・管理者ダッシュボード・Stripe課金・Firestore通知を実装。
- ⚠️ 行きたい通知はUIモックのみ、通報ワークフロー/信頼スコア/広告アルゴリズム/アドバンスドサーチ（距離・価格など）は未着手。
- ⚠️ コンテンツ露出ロジックは単純な likes/comments + recency。score リフレッシュアルゴリズムや新規投稿優遇は今後設計。

### `sms_verification_spec.md`
- ✅ PhoneVerificationModal（国選択/フォーマット/再送制御）＋ Firebase Phone Auth + `/api/profile/verify-phone` で phone_hash 保存、`PhoneVerificationRequiredError` を投稿/予約 API に組み込み済み。
- ✅ プロフィールには phoneVerified / verifiedAt / バッジ表示を反映。
- 🔜 Twilio Lookup 等の回線種別判定・運用Runbook・アラート設計は未整備。

### `spots_map_ui_perf_spec_v0.2/v0.3`
- 🟡 現状は GeoJSON circle layer + 一括描画のみ。タイルAPI・DOM300ガード・Markerプーリング・Auto-Degrade・Tap-to-Grow の実装は未着手。
- 🔜 次フェーズで backend タイルエンドポイント、前述の LOD 切替、低性能端末モード、FPS/初期描画計測を整備する。

### `event_data_spec_v0.1.md`
- ✅ 詳細シート/リストビューではタイトル・カテゴリ・説明・時間帯・画像・統計を表示し、CTA・コメント導線を提供。
- ⚠️ 地図の吹き出しは最小データ（タイトル/カテゴリ）だけで、簡易表示/Tap-to-Grow/距離・徒歩時間/料金表示は未導入。
- ✅ リストビューは価格・Verified バッジ・開始までの残り時間などを表示するカードレイアウトに刷新（距離系は今後対応）。
- ⚠️ pricing・distance・verifiedバッジの共通データ整備が未完了。メタ情報は Firestore モデル/レスポンス拡張が必要。

## 実装済み機能ハイライト
- Map & Discovery: Mapbox GL ベースの地図描画、カテゴリタブ、マップ/リスト切替、検索オーバーレイ（履歴付きクライアントフィルタ）、人気ランキング・プロモーション枠。
- List View: ソート（開始時間/人気/価格/新着）とフィルタ（無料・Verified・当日・室内/屋外）を追加し、価格・場所・バッジなど `event_data_spec` に沿ったカード表示へ刷新。
- Posting & Scheduling: 3ステップ投稿フロー（地図位置選択/プラン選択/詳細入力）、画像アップロード、Tier別プラン制御、Firebase Functions 経由の予約告知公開/Promotion反映。
- Social & Community: いいね・お気に入り・フォロー、コメントスレッド（ページング・画像添付・Like）、フォロー中フィード、投稿者バッジ表示。
- Notifications & Analytics: Firestore 通知購読 + In-app トースト、Sentry 初期化、GA4/Mixpanel ラッパ、Stripe/Functions イベントのログ連携。
- Admin & Billing: 審査ダッシュボード（フィルタ・検索・テンプレ適用）、審査ログ、Stripe Checkout/Portal、Webhook冪等ストア、クォータリセットとアラート下地。

## 優先課題と開発計画
- Map UI performance v0.3: タイルAPIとクラスタリング層を backend に追加し、フロントで LOD/Marker プール/Auto-Degrade/Tap-to-Grow を実装。FPS・初期描画計測と低性能端末フォールバックを導入。
- Search & Discovery 拡張: 検索バックエンド（候補: Algolia/Firestore range）と Suggestion API を用意し、検索オーバーレイをネットワーク駆動に更新。距離・開催時刻ソートを提供。
- Event データのリッチ化: 距離/ETA/料金/verified バッジ/プレミアム表示を Firestore モデル・API・UI 全体に拡張し、`event_data_spec` の 4 段階表示を揃える。
- Safety & Trust: 通報フロー、虚偽投稿ペナルティ、trust_score 集計とランキングアルゴリズムの再設計、通知条件の細分化。
- QA & Ops: Vitest カバレッジ拡張、Supertest で API 統合テスト、Playwright シナリオ、CI/CD ワークフロー、負荷試験（Map/Functions/Billing）の自動化と Runbook 整備。

## 技術構成
- **Frontend**: React 18 + Vite + TypeScript, Mapbox GL JS, SWR, Firebase Auth/Firestore/Storage SDK, Sentry (browser), libphonenumber-js, Stripe.js。
- **Backend**: Node.js + Express, Firebase Admin SDK, Firestore, Stripe SDK, Zod, Vitest、`@shibuya/backend` として Functions へバンドル。
- **Cloud Functions**: `api`, `stripeWebhook`, `processScheduledSpots`, `refreshPopularSpots`, `tidyPromotions`, `resetPosterQuotas`（asia-northeast1）。
- **インフラ**: Firebase Auth / Firestore / Storage, Stripe Billing, Mapbox, Sentry, (オプション) GA4 / Mixpanel。

## 主要データモデル
- `users/{uid}`: poster_tier, promotion_quota, followers_count, engagement_score, favorite_spot_ids, followed_user_ids, phone_verified, phone_hash, stripe_customer_id, flags。
- `spots/{spotId}`: title, description, category, lat/lng, start_time, end_time, owner_id, image_url, likes, comments_count, created_at。
- `scheduled_spots/{id}`: publish_at, start_time, end_time, announcement_type, status, review_notes, owner_id, image_url, created_at。
- `promotions/{id}` & `leaderboards/popular_spots/entries/{spotId}`: Promotion設定、ランキングスコア、優先度。
- `notifications/{id}`: user_id, title/body, metadata(spotId等), category, priority, read, created_at。
- `stripe_webhook_events/{eventId}`: type, status, attempts, processed_at, last_error（冪等管理）。

## API サマリー（抜粋）
| Method | Path | 説明 |
| --- | --- | --- |
| GET | /api/health | ヘルスチェック |
| GET | /api/spots | スポット一覧（カテゴリ/フォロー絞り込み、ローカル検索連携） |
| POST | /api/spots | スポット投稿（SMS認証必須、画像URL対応） |
| GET | /api/spots/popular | 人気ランキング取得 |
| GET | /api/spots/:id | スポット詳細 |
| GET/POST | /api/spots/:id/comments | コメント取得・投稿 |
| POST | /api/like_spot / /api/unlike_spot | いいね操作 |
| POST | /api/favorite_spot / /api/unfavorite_spot | お気に入り操作 |
| POST | /api/follow_user / /api/unfollow_user | ユーザーフォロー |
| GET | /api/followed_posts | フォロー中投稿フィード |
| GET/PUT | /api/profile | プロフィール取得・更新 |
| POST | /api/profile/verify-phone | SMS認証結果反映 |
| POST | /api/billing/create_checkout_session | Stripe Checkout セッション作成 |
| POST | /api/billing/create_portal_session | Stripe Portal セッション作成 |
| GET/POST | /api/scheduled_spots... | 予約告知 CRUD |
| GET/POST | /api/admin/scheduled_spots... | 管理者審査/テンプレ/ログ |

## バッチ / 自動処理
| Function | トリガー | 役割 |
| --- | --- | --- |
| `processScheduledSpots` | 5分毎 | 承認済み予約告知を `spots` に公開し Promotion を有効化 |
| `refreshPopularSpots` | 15分毎 | `leaderboards/popular_spots` を再計算 |
| `tidyPromotions` | 24時間毎 | 期限切れ Promotion を失効処理 |
| `resetPosterQuotas` | 月次 (0 3 1 * *) | Poster Tier に応じたクォータ再配布 |
| `stripeWebhook` | HTTPS | Stripeイベント冪等処理（プラン反映・通知） |
| `api` | HTTPS | Express アプリ全エンドポイント（asia-northeast1） |

## 開発フロー
- `npm install`（ルートで Workspaces 依存を一括インストール）
- Frontend: `npm run dev --workspace frontend`（`frontend/.env` に Firebase / Mapbox / Sentry / Analytics 設定）
- Backend API: `npm run dev --workspace backend`（`backend/.env` に Firebase Admin, Stripe, PHONE_HASH_SECRET）
- Functions: `npm run build --workspace backend` 後 `npm run serve --workspace firebase-functions` or `firebase emulators:start --only functions`
- ビルド: `npm run build --workspaces`

## テスト / 品質
- `npm run test --workspace backend` (Vitest) — Firestore サービス・スケジュール規則のユニットテスト。
- `npm run lint --workspaces` — ESLint + Prettier。
- 🔜 API 統合テスト (Supertest)、E2E (Playwright)、Map負荷計測、CI/CD パイプラインを整備予定。

## 運用メモ
- 必須環境変数: Firebase Web API Keys, Firebase Admin 認証情報, Mapbox Token, Sentry DSN, Stripe API/Price/Webhook Secret, `PHONE_HASH_SECRET`, GA4/Mixpanel（任意）。
- Billingアラート送付先: `BILLING_ALERT_RECIPIENT_UIDS` or `firebase functions:config:set alerts.billing_recipient_uids=...`
- サポート窓口: `support@shibuya-livemap.local`（UIリンクあり）、Billing FAQ (`/billing-faq.html`)
- Secretsはローカル `.env` と Functions Config を同期させ、Vault 等からデプロイスクリプトで注入する運用を想定。

## 参考ドキュメント
- [要件定義書](docs/requirements.md)
- [Operations ガイド](docs/operations.md)
- [Billing Operations Guide](docs/billing-operations.md)
- [Development Plan](docs/development-plan.md)
- [Monetisation Roadmap](docs/monetisation-roadmap.md)
- [Architecture Overview](docs/architecture.md)
- [Spots Plan v0.1](spots_plan_v0.1.md)
- [SMS Verification Spec](sms_verification_spec.md)
- [Spots Map UI Perf Spec v0.3](spots_map_ui_perf_spec_v0.3.md)
- [Event Data Spec v0.1](event_data_spec_v0.1.md)

## 開発時メモ
- 簡易モック: `VITE_USE_MOCK_TILES=true npm run dev --workspace frontend` でローカルの `mocks/` JSON を返すよう切替可能。マップ＆リストビューのUI検証に利用。
