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


## 日次メンテナンス

1. 10分おきのメンテジョブ
   - `npm run maintenance --workspace backend` を Cloud Scheduler もしくは自宅サーバーの cron に登録。例：
     ```bash
     # Cloud Scheduler (HTTP 経由で Cloud Run/Functions を叩く場合)
     gcloud scheduler jobs create http spots-maint        --schedule="*/10 * * * *" --time-zone="Asia/Tokyo"        --uri="https://<run-url>/maintenance"        --http-method=POST        --oidc-service-account-email=<sa>@<project>.iam.gserviceaccount.com        --body='{"command":"npm run maintenance --workspace backend"}'
     ```
     ```bash
     # cron (ローカル/VM)
     */10 * * * * cd /path/to/Spots && npm run maintenance --workspace backend >> /var/log/spots-maint.log 2>&1
     ```

2. ログ確認
   - Cloud Logging で `[maintenance]` タグを検索し、`publishedSpotIds` と `activatedPromotionIds` が期待通りか見る。
   - 失敗時は Sentry もしくはログを参照（`[maintenance] Failed`）。再実行は `gcloud scheduler jobs run spots-maint` か cron の手動実行。

3. 予約投稿・プロモーションの確認
   - Firestore `scheduled_spots` で `status="approved"` が残っていないか確認。残っている場合は `publish_at` 時刻が未来かどうかをチェック。
   - `promotions` で `status="scheduled"` のものが `publish_at` を過ぎていたら、`maintenance` が走っているかログを確認。

4. AdSense/トレンドの目視
   - トレンド画面の AdSense 枠（空の場合は Skeleton 表示）を確認。広告が出ていない場合、`adsbygoogle` のエラーを console でチェック。
   - 人気ランキングの view/like/score が更新されているか（`/api/spots/popular` のレスポンスに `updated_at` が10分以内か）。

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

## 予約投稿 Runbook（投稿→審査→公開）

### 前提
- **権限**: Firebase Auth で `admin=true` のカスタムクレームを付与されたアカウントでログインしていること（[Admin Privileges](#admin-privileges) 参照）。
- **ツール**:
  - Webアプリ内の「審査ダッシュボード」（`/spots` → ベルアイコン → 「審査状況」）。
  - Firestore Console（`scheduled_spots` / `promotions` / `scheduled_spot_review_logs`）。
  - Cloud Logging（`[maintenance]` タグ）および `npm run maintenance --workspace backend` を実行できる環境。
- **ジョブ前提**: `processScheduledSpots` を含む Cloud Scheduler/cron が稼働していること。停止している場合は Runbook 開始前に復旧する。

### フロー概要
1. 投稿者が Spot 作成フロー内で予約を登録すると `scheduled_spots` にドキュメントが追加される。
2. `short_term_notice` は Tier に関わらず即 `approved`、`long_term_campaign` は Tier A なら自動承認、それ以外は `pending` となり要審査。
3. 管理者が Pending を審査して `approved` / `rejected` を決定（必要に応じてプロモ情報を付与）。
4. `publish_at` を過ぎた Approved 予約はメンテナンスジョブで `spots` へ書き出され、対応するプロモがあれば `active` になる。
5. 公開後はフロントでの表示・通知・ログを確認し、問題あればロールバック／再審査を実施。

### 手順詳細
1. **Pending の確認**
   - 審査ダッシュボードで `審査待ち` タブを開き、最低でも午前/夕方の 1 日 2 回チェック。
   - カードを開き、以下を確認：タイトル・説明・開催時間・場所（Mapboxリンクで実地確認）・画像の適切性・投稿者 Tier / SMS 認証状態。
2. **審査/決定**
   - 承認可否を判断し、テンプレを選択 → 必要なら `reviewNotes` を追記。
   - プロモ掲載が必要な場合はヘッドライン/CTA/画像/優先度/掲載期間（`expiresAt`）を入力。終了日時が未設定ならイベント終了時刻を設定。
   - 「承認」または「却下」を確定。Firestore では `scheduled_spots/{id}.status` が更新され、`scheduled_spot_review_logs` / `notifications` が新規作成される。
3. **公開待ち / メンテジョブ確認**
   - `publish_at` 直前に Cloud Logging で `[maintenance]` ログを確認し、`Published ...` が出力されているかを見る。
   - エラーやジョブ停止が疑われる場合は `npm run maintenance --workspace backend` をワークスペースで手動実行し、再度ログを確認。
4. **公開後のチェック**
   - `spots` コレクションに新規スポットが生成されているか（`owner_id` とタイトルで検索）。
   - プロモを付けた場合は `promotions/{id}` の `status` が `active` へ、`spot_id` が新規スポット ID へ更新されているか。
   - フロントエンドで：Map/リスト/トレンドに表示されるか、SpotDetailSheet から閲覧できるか、通報モーダルが機能するかを確認。

### チェックリスト
- **承認前**
  - [ ] 投稿者 Tier と発行プランの整合性（Tier C は短期 6h 以内、Tier B は 48h 以内、Tier A は長期可）。
  - [ ] 同時間帯・同地点での重複イベントが無いか。
  - [ ] 画像/リンク/文面がコミュニティガイドラインに反しないか。
  - [ ] SMS 認証済みでない場合は信頼性に注意し、必要なら却下理由に記載。
- **公開後**
  - [ ] Map / トレンド / プロモバナーに反映されている。
  - [ ] 投稿者へ届く通知（アプリ通知 & `notifications` ドキュメント）が作成されている。
  - [ ] `spots.view_count` の初期値が 0、Sentry にエラーが出ていない。
- **障害時**
  - [ ] `[maintenance] Failed` ログのメッセージ確認、Firestore/Functions 側の Stack trace を取得。
  - [ ] 手動再実行 (`npm run maintenance --workspace backend`) で解決しない場合は Cloud Scheduler 設定・サービスアカウント権限を再確認。

### トラブルシュート
- **Pending が消えない**: 管理者トークン切れ → 再ログインし、`hasAdminClaim` を確認。Firestore 側で `status=pending` のままなら権限不足かテンプレ未設定。
- **Approved なのに公開されない**:
  - `publish_at` が未来か、`processScheduledSpots` が停止している可能性。ログで `Published ...` が最新10分以内か確認。
  - Firestore で `scheduled_spots/{id}` を開き、`status` が `approved` / `publish_at` が現在時刻を過ぎているかをチェック。
- **プロモが Active にならない**: `promotions/{id}` の `expires_at` が過去か、`promotion` 情報を審査時に入力し忘れている。必要なら Firestore で `status="scheduled"` を再確認し、審査やり直し。
- **予約の誤承認を取り消したい**: `scheduled_spots/{id}` を `cancelled` に更新し、`promotions` があれば `status="expired"` へ。公開済みの場合は `spots` 側削除が必要なので要注意。

## エラーモニタリング（Sentry）
- バックエンド / Firebase Functions 共通で `SENTRY_DSN` が設定されている場合に Sentry が初期化されます。必要に応じて `SENTRY_ENVIRONMENT`（例: `production` / `staging`）と `SENTRY_TRACES_SAMPLE_RATE`（0〜1の浮動小数）を設定してください。
- フロントエンドは `VITE_SENTRY_DSN` を設定すると自動で初期化され、`trackError` から送信されるエラーがSentryにも転送されます。任意で `VITE_SENTRY_ENVIRONMENT` と `VITE_SENTRY_TRACES_SAMPLE_RATE` を追加できます。
- Firebase Functionsのスケジュール実行やStripe Webhookで例外が発生した場合も `captureSentryException` で送信されます。アラート条件はSentry側で調整してください。

## Environment Checklist
- Ensure backend `.env` contains Firebase admin credentials (used by CLI scripts and during development).
- Promote official partners to `tier_a` by updating their Firestore user document or automating via Admin UI.
- Monitor Cloud Logging for `processScheduledSpots` to confirm posts transition `approved -> published`.
