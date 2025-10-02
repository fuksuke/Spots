# 開発計画（2025-10-XX版）

## フェーズ優先度
1. **課金・クォータの本番運用仕上げ（P0）**
2. **審査オペレーションと監査体制の強化（P1）**
3. **計測とUX品質の底上げ（P2）**

## タスク一覧

### P0: 課金・クォータ本番運用
- [ ] Stripe Checkout / Portal / 解約フローの実機テスト（`stripe trigger`）を実施し、Firestore通知・`stripe_webhook_events` の状態を確認
- [ ] 本番/ステージング `.env` / Functions Config にStripe・Sentry・アラート設定を反映
- [ ] `docs/billing-operations.md` に沿ってWebhookシークレット更新→再デプロイ→ログ確認を完了
- [ ] Billing FAQ / アプリ内案内文の最終チェック（Portal案内、サポート連絡先）

### P1: 審査オペレーション強化
- [ ] 審査テンプレートと監査ポリシー文面を確定し、管理UI／Docsへ反映
- [ ] 審査ダッシュボードに高度な検索/フィルタ/CSV出力を追加
- [ ] Sentry＋Cloud Logging のアラート閾値と通知先 (Slack/メール) を設定
- [ ] 管理者向けRunbookに審査SOP・通知テンプレ・エスカレーションフローを追記

### P2: 計測・UX品質向上
- [ ] GA4/Mixpanelイベントマップを作成し、`frontend/src/lib/analytics.ts` へ実装
- [ ] CTRダッシュボード（暫定はSpreadsheet可）と主指標の更新頻度を決定
- [ ] Playwrightで主要フローE2Eテスト、Vitest+SupertestでAPI統合テストを追加
- [ ] モバイルレイアウト/A11y改善（Tab操作、コントラスト、SR対応）
- [ ] マップ/リスト切替を最適化し、主要スポットを中心に表示するUI仕様を決定（ユーザーフィードバック反映）

### 継続タスク
- [ ] 週次バックログ/リスクレビューと優先度見直し
- [ ] Docs（requirements / operations / billing）更新の継続
- [ ] テストリリース対象ユーザー・サポート体制の調整
- [ ] Stripeレポート・通知ログの定期チェック

---
この計画は README の優先テーマおよび `docs/requirements.md` に基づいています。完了した項目はチェックを付け、必要に応じて追加してください。
