# Monetisation Roadmap

## 1. Offering Structure
- **Tier C (Free)**: real-time投稿 + 6時間前までの直前告知。広告枠なし。
- **Tier B (Creator)**: サブスクリプション (想定 ¥2,000/月)。48時間前までの短期告知、フォロワー数によるアップグレード。
- **Tier A (Official/Sponsor)**: 有料契約 (想定 ¥25,000/月〜) + 10% トランザクション手数料。長期キャンペーン、バナー露出、ダッシュボードでの優先審査。

## 2. Billing & Payment Integration
- Stripe Billing を採用。プロダクト例:
  - `creator-plan` (月額, 自動課金)
  - `sponsor-plan` (月額, カスタム価格 / 請求書)
- Checkout フロー:
  1. 管理画面で「プランをアップグレード」→ Stripe Checkout セッション作成 (`price_id` ごと)
  2. 成功時 webhook (`checkout.session.completed`) で Firestore `users/{uid}` を更新 (`poster_tier`, `promotion_quota`)
  3. キャンセル／支払い失敗時 `customer.subscription.deleted` でTierをダウングレード
- Stripe Webhook 処理を Firebase Functions で実装（asia-northeast1、HTTP endpoint + `functions.https.onRequest`）

## 3. Admin Workflow
1. 支払い完了 → 自動で `poster_tier = "tier_a"` / `"tier_b"` に更新、クォータ初期化。
2. 初回だけ手動審査（会社情報, URL）を記録。Firestore `users/{uid}/verification` コレクションに履歴を推奨。
3. 審査NG の場合、Stripe ダッシュボードから返金・サブスクリプション停止。

## 4. Required Features
- **Frontend**
  - プラン選択モーダル（Stripe Checkout リダイレクト）
  - 支払い状態の表示、キャンセル／再開ボタン
  - 公式アカウント申請フォーム（必要資料アップロード → Cloud Storage）
- **Backend/Functions**
  - `/api/billing/create_checkout_session` (requires tier target)
  - Stripe Webhook: subscription events → Firestore update、メール通知
  - `promotion_quota` の自動リセット（cron: 月1、週1）
- **Operations**
  - 初期導入時に既存公式アカウントへ手動付与 (`npm run set-admin`, Firestore更新)
  - 売上レポート: Stripeのダッシュボード + BigQuery連携を検討

## 5. Timeline
| Sprint | Deliverables |
| --- | --- |
| Sprint 1 | Stripe Test環境でのCheckout/Portal連携、Webhook→Firestore 更新 |
| Sprint 2 | 管理UIでの申請・審査フロー、メール通知、クォータ自動更新 |
| Sprint 3 | 商用ローンチ、トラッキング（GA4, Mixpanel）、請求書テンプレート |

## 6. Open Questions
- 法人向け請求書払いに対応するか (Stripe Invoicing or manual)
- プロモーションの成果計測（クリック数、リーチ）をどう可視化するか
- キャンぺーン審査のSLA、サポートチャネル（メール/Slack）
