# Operations Guide

> 課金運用の詳細は [Billing Operations Guide](./billing-operations.md) も参照してください。

## Firestore Index Deployment
Required composite indexes are defined in `firebase/firestore.indexes.json`. Deploy them with:
```bash
firebase deploy --only firestore:indexes
```
If you update the index file, re-run the command or use `firebase firestore:indexes:list` to confirm state.
The indexes cover:
- `scheduled_spots`: `(owner_id, announcement_type, publish_at)` for quota checks, `(status, publish_at)` for publish jobs.
- `promotions`: `(status, priority desc, publish_at)` for banner retrieval.

## Admin Privileges
Certain endpoints (scheduled spot review, promotions writes) require a Firebase custom claim `admin=true`.
Set or unset the claim via:
```bash
cd backend
npm run set-admin <uid> true   # grant
npm run set-admin <uid> false  # revoke
```
The script expects the standard service account credentials in environment variables (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).

## Cloud Scheduler Jobs
Three scheduled Cloud Functions must be configured after deploying Firebase Functions:
- `refreshPopularSpots` (every 15 minutes): refreshes leaderboard scores.
- `processScheduledSpots` (every 5 minutes): publishes approved scheduled posts and activates promotions.
- `tidyPromotions` (every 24 hours): expires promotions past their `expires_at`.

Create Cloud Scheduler jobs (Google Cloud Console or CLI) pointing to each function:
```bash
gcloud scheduler jobs create pubsub refresh-popular-spots \
  --schedule="*/15 * * * *" --time-zone="Asia/Tokyo" \
  --topic="projects/$PROJECT/topics/firebase-schedule-refreshPopularSpots" \
  --message-body="{}"
# Repeat for processScheduledSpots (every 5m) and tidyPromotions (daily)
```
After creation, trigger each job once manually to seed data.
```bash
gcloud scheduler jobs run refresh-popular-spots
gcloud scheduler jobs run process-scheduled-spots
gcloud scheduler jobs run tidy-promotions
```
Check Cloud Logging (`firebase functions:log`) to verify each workflow processes documents as expected.

## Stripe Webhook Operations
- Webhook処理は `stripe_webhook_events/{eventId}` コレクションで冪等管理しています。重複イベントは `status=processed` のままスキップされるため、Firestoreのドキュメントを削除するまでは再実行されません。
- 障害が発生した場合は `status=failed` と `lastError` が保存されるので、問題を解消した上で同じイベントIDのドキュメントを削除→Stripeからリトライを待機してください。
- Cloud Loggingでは `Skipping duplicate Stripe event` ログで重複検知が確認できます。
- 月次クォータのDry Runは `npm run preview-quota-reset --workspace @shibuya/backend` を実行すると対象ユーザーと変更内容が出力されます（Firestoreへの書き込みは行われません）。

### Stripe Checkout / Portal の動作確認
1. `stripe login` / `stripe listen --forward-to localhost:5001/.../stripeWebhook` でWebhookを傍受します。
2. アプリで `billing=success|cancel|error` の各ケースをStripe CLI (`stripe trigger checkout.session.completed` など) で再現し、
   - フロントのトースト表示
   - `users/{uid}` の `promotion_quota` 更新
   - Sentry / Cloud Logging の記録
   を確認してください。
3. `stripe trigger customer.subscription.deleted` 等でプラン失効をシミュレートし、クォータがリセットされることと通知が出ることをチェックします。

#### Billing Alert Recipients
- `BILLING_ALERT_RECIPIENT_UIDS`（カンマ区切り）に課金異常時のアラートを受け取るFirebase UIDを設定します。単一指定の場合は `BILLING_ALERT_RECIPIENT_UID` でも構いません。
- Functions Config を利用する場合は `firebase functions:config:set alerts.billing_recipient_uids="uid1,uid2"` で登録できます。
- 上記が設定されていると、Stripeイベントでプランが判定できない場合に通知が `notifications` コレクションへ高優先度で作成され、アプリ内トーストの対象となります。

## 審査オペレーション
- 管理画面は `/api/admin/scheduled_spots/review_templates` から取得したテンプレートを利用します。テンプレ内容は `backend/src/constants/moderation.ts` を編集し、必要に応じて翻訳・追記事項を記載してください。
- 審査API `/api/scheduled_spots/:id/review` には `templateId` と `reviewNotes` を送信します。却下時はコメント必須、テンプレートを選ぶと既定の文面が挿入されます。
- Firestore `scheduled_spot_review_logs` には `review_template_id` が保存されるため、監査時はテンプレート利用状況を参照できます。CSVエクスポートにも同列が含まれます。
- `notifications` メタデータにも `reviewTemplateId` が入るため、運用側で通知ログを集計してテンプレ活用状況を把握できます。

## エラーモニタリング（Sentry）
- バックエンド / Firebase Functions 共通で `SENTRY_DSN` が設定されている場合に Sentry が初期化されます。必要に応じて `SENTRY_ENVIRONMENT`（例: `production` / `staging`）と `SENTRY_TRACES_SAMPLE_RATE`（0〜1の浮動小数）を設定してください。
- フロントエンドは `VITE_SENTRY_DSN` を設定すると自動で初期化され、`trackError` から送信されるエラーがSentryにも転送されます。任意で `VITE_SENTRY_ENVIRONMENT` と `VITE_SENTRY_TRACES_SAMPLE_RATE` を追加できます。
- Firebase Functionsのスケジュール実行やStripe Webhookで例外が発生した場合も `captureSentryException` で送信されます。アラート条件はSentry側で調整してください。

## Environment Checklist
- Ensure backend `.env` contains Firebase admin credentials (used by CLI scripts and during development).
- Promote official partners to `tier_a` by updating their Firestore user document or automating via Admin UI.
- Monitor Cloud Logging for `processScheduledSpots` to confirm posts transition `approved -> published`.
