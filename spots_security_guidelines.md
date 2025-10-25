# Spots Security Guidelines（個人開発ベストプラクティス）

## 0. 原則
- 最小権限の原則（Least Privilege）
- データ最小化（Minimization）
- 信頼境界の明確化（入力はすべて疑う）
- セキュリティ作業の自動化（更新・鍵ローテ・バックアップ検証）

## 1. 認証・認可
- メール／Google連携で登録、投稿時のみSMS認証
- セッション：Secure + HttpOnly + SameSite=Strict Cookie
- OAuthはPKCE必須、最小スコープ
- 管理画面は2要素認証＋IP制限
- ロールベースアクセス制御

## 2. 機微情報の取り扱い
### 電話番号
- 生番号は保存せず、HMACハッシュ＋末尾4桁のみ保存
- AES-GCM暗号化が必要な場合のみ使用、鍵はKMSで管理
- ログには出力しない

### メールアドレス
- HMACハッシュ化＋AES暗号化（必要時のみ復号）
- ダブルオプトイン
- SPF/DKIM/DMARC設定

### 決済情報
- Stripeなど外部決済でトークン化
- 自サーバではカード情報を一切保持しない
- Webhook署名検証＋冪等処理

## 3. 通信保護
- 常時HTTPS、HSTS有効化
- CSP（default-src 'self'）＋XSS/CSRF対策
- セキュリティヘッダ：nosniff, X-Frame-Options, Referrer-Policy

## 4. インフラ
- Secret Manager / KMSで鍵を安全管理
- DBをパブリック閉鎖、WAF前段
- 監査ログを不変ストレージに保存
- ステージ分離（Dev/Stg/Prod）

## 5. データ保持と削除
- 保持期間を明確化（例：90日でログ削除）
- 削除依頼対応（APPI/GDPR準拠）
- 匿名化・集計で分析

## 6. 濫用対策
- レート制限、CAPTCHA導入
- 通報機能の回数制限＋信頼スコア重み付け
- ファイルアップロードはウイルススキャン＋EXIF除去

## 7. ライブラリ管理
- npm audit / pip-audit をCIで実行
- Dependabotなどで自動更新

## 8. 運用
- 認証失敗率、SMS送信失敗率、通報率を監視
- アラート通知設定（OpsGenie/Slack）
- 鍵失効・再発行のRunbook整備

## 9. 日本法対応
- 個人情報保護法（利用目的の明確化・安全管理措置）
- Cookie同意バナー
- 位置情報は同意制＋低精度化

## 10. やらないことリスト
- カード情報を保存
- 電話番号/メールをログ出力
- .envをGitにコミット
- 管理画面に2FAなし
- 公開バケット
- Dev/Prod混在
- 依存更新放置

## 11. チェックリスト
- [ ] Cookieセキュア設定済み
- [ ] 電話番号ハッシュ化済み
- [ ] メール暗号化済み
- [ ] Stripeトークン利用のみ
- [ ] Secret Manager利用
- [ ] WAF + レート制限導入
- [ ] バックアップ暗号化済み
- [ ] プライバシーポリシー整備
