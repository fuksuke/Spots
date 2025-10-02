# Billing Operations Guide

最終更新: 2025-10-XX

## 1. Stripe 設定値一覧
| 種別 | 環境変数 | 説明 |
| --- | --- | --- |
| Secret | `STRIPE_API_KEY` | Stripe secret key（`sk_live_` / `sk_test_`）|
| Secret | `STRIPE_WEBHOOK_SECRET` | `stripe listen` で取得する Webhook signing secret |
| Config | `STRIPE_PRICE_TIER_A` | スポンサー(Tier A)のPrice ID |
| Config | `STRIPE_PRICE_TIER_B` | クリエイター(Tier B)のPrice ID |
| Config | `STRIPE_SUCCESS_URL` | Checkout成功後の戻りURL（例: `https://app.example.com/?billing=success`）|
| Config | `STRIPE_CANCEL_URL` | Checkoutキャンセル時の戻りURL |
| Config | `STRIPE_PORTAL_RETURN_URL` | Customer Portal利用終了後の戻りURL |
| Config | `BILLING_ALERT_RECIPIENT_UIDS` | 課金異常時に通知を受け取るFirebase UID（カンマ区切り）|
| Config | `BILLING_ALERT_RECIPIENT_UID` | 単一UID用のショートカット（オプション）|

> Functions Config を利用する場合は `firebase functions:config:set stripe.api_key="..." stripe.webhook_secret="..."` 等で設定します。アプリケーション `.env` と整合をとってください。

### 本番とステージングの差分管理
- `.env.production` `.env.staging` を保持し、Deploy時に正しい値を読み込む
- Firebase Functions Config に `--project` オプションを使って環境ごとにセット
- `BILLING_ALERT_RECIPIENT_UIDS` は環境別に設定し、本番にステージング用UIDが混在しないよう注意

## 2. テストアカウントと検証フロー
1. **Stripe ダッシュボード**でステージング用のテストカスタマーを作成（メールをメモ）。
2. `stripe login` → `stripe listen --forward-to <functions-url>/stripeWebhook` を起動。
3. Vite dev あるいはステージングサイトで以下を実行：
   - Checkout成功/キャンセル/エラー (`stripe trigger checkout.session.completed` / `...checkout.session.async_payment_failed`)
   - Portal遷移 (`stripe trigger customer.subscription.updated` → Portalで情報更新)
   - 解約 (`stripe trigger customer.subscription.deleted`)
4. 検証項目：
   - アプリのトースト表示と `notifications` コレクションへの書き込み
   - Firestore `users/{uid}` の `poster_tier` / `promotion_quota` / `stripe_customer_id`
   - `stripe_webhook_events/{eventId}` の `status=processed`
   - Sentry / Cloud Logging でエラーが無いことを確認

> テスト用カード: `4242 4242 4242 4242` など Stripe 提供のテストカードを利用。

## 3. Webhook シークレット同期プロセス
1. 各環境で `stripe webhook endpoints create` もしくは `stripe listen` でWebhooksを設定。
2. 発行された `whsec_...` を Secrets Manager / Vault に保存し、環境変数へ展開。
3. Functions Configを使用する場合: `firebase functions:config:set stripe.webhook_secret="whsec_..."`。
4. 変更後は `firebase deploy --only functions:stripeWebhook` を実行し、新シークレットで署名検証が通ることを `stripe trigger` で確認。

## 4. クォータ自動リセット検証
1. ローカルで `npm run preview-quota-reset --workspace @shibuya/backend` を実行しDry Run結果を確認。
2. ステージング環境で `firebase functions:shell` → `resetPosterQuotas()` を呼び、Firestore更新をチェック。
3. 本番はスケジュール任せとしつつ、初回のみ `firebase functions:trigger resetPosterQuotas`（要権限）で手動実行しログを確認。
4. 差分監視：
   - `users/{uid}` の `promotion_quota_updated_at` を確認
   - BigQuery Export やダッシュボードで前月との差分を集計（将来的な拡張）

## 5. トラブルシュート
| 症状 | 可能性 | 対処 |
| --- | --- | --- |
| CheckoutがURLを返さない | Price ID未設定、Stripe APIキー不整合 | `.env` / Functions Config を確認し再デプロイ |
| Webhookが`signature verification failed` | `STRIPE_WEBHOOK_SECRET` 未更新 | シークレットを最新に差し替え、`stripe trigger` で再検証 |
| クォータが更新されない | Function未実行、Firestore権限 | Cloud Loggingで `resetPosterQuotas` ログを確認、Dry Run結果をチェック |
| 課金イベントがアラートされない | `BILLING_ALERT_RECIPIENT_UIDS` 未設定 | `.env` or Functions Config を再設定し、Functions再デプロイ |

## 6. 関連資料
- [Operations Guide](./operations.md)
- [Requirements Spec](./requirements.md)
- [Monetisation Roadmap](./monetisation-roadmap.md)

