# Spots MVP 開発プラン（2025-02）

## 目的とスコープ
- **目的**: 2025 Q1 内に Private Alpha → Public Beta へ移行するための最小機能セット（MVP）を確定し、リリース阻害要因を潰し切る。
- **対象**: 現状実装済み機能（Map/投稿/審査/トレンド/広告枠）をベースに、Nice-to-have（高度検索、信頼スコア連動、Stripe 決済）は除外。

## マネタイズ方針（MVP）
- 収益源は **Google AdSense** のみ。トレンド画面とマップの下部にレスポンシブ広告ユニットを 2 箇所設置し、インプレッションを計測する。
- Stripe Checkout/Portal や課金 Tiers のコードは残し、UI を隠しておく（将来復帰用）。
- AdSense の読み込み状態や広告枠のラベル（"スポンサー"）を UI 上で明示し、広告が非表示でもレイアウトが崩れないよう Skeleton を用意する。

## 全体方針
1. **安全な投稿/審査ライン** を維持したまま、閲覧〜トレンド体験を完成度90%以上に引き上げる。
2. **リアルタイムイベントの鮮度を担保**（視聴ログ + ランキング + プロモ枠）し、一般利用者が迷わず価値を得られる構成にする。
3. **運用容易性**: 予約投稿公開/プロモ失効/ランキング再構築/ログ監視を自動化し、10分単位でのジョブ実行とログ確認を習慣化する。

## 残タスク一覧（優先度: P0 = MUST、P1 = SHOULD、P2 = NICE）
| ID | カテゴリ | 内容 | 優先度 | 依存 | 備考 |
|----|----------|------|---------|------|------------|
| P0-1 | 運用 | `npm run maintenance --workspace backend` を Cloud Scheduler/cron で 10分毎に叩き、ログ確認手順を README に追記（済） | P0 | なし | 稼働状況を Cloud Logging で監視 |
| P0-2 | マップ | DOM300 over 時の canvas fallback（既存）＋ marker pooling / auto degrade を導入し、モバイルで FPS>30 を確認 | P0 | map_tile API | `frontend/src/components/MapView.tsx` |
| P0-3 | ビュー記録 | SpotDetailSheet 以外（リストカード、Map 吹き出し、トレンドカード）からも `recordSpotView` を送信し、Sentry tag で失敗率を監視（済） | P0 | API 実装済み | Map/リスト/トレンド/通知から `onSpotView` で統一 |
| P0-4 | トレンド | トレンド画面/リストに AdSense ユニットを設置。広告未配信時の Skeleton と "スポンサー" ラベルを実装 | P0 | AdSense Script | Frontend |
| P0-5 | 投稿/審査 | Runbook: 予約投稿→審査→公開の手順とチェックリストを docs/operations.md に追記（済） | P0 | 審査オペレーション | Hero/チェックリスト込みで更新 |
| P0-6 | 通報 | Firestore に `spot_reports` + Admin リストで対応フローを用意（済） | P0 | API/UI | Adminダッシュボードの「通報」タブで閲覧・対応済み更新可 |
| P0-7 | QA/安定 | Playwright で「ログイン→投稿→マップ→トレンド→通知」シナリオを1本作り、GitHub Actions から回す | P0 | Playwright 未導入 | CI で自走確認 |
| P0-8 | モニタリング | Sentry/GA4 でマップ滞在時間・スクロール深度を計測し、MVP の指標（UU/滞在分/閲覧イベント数）をダッシュボード化 | P0 | 分析設定 | 最低限のダッシュボード |

| P1-1 | 検索 | 距離・開催時間フィルタを `GET /api/spots` + 検索オーバーレイに追加 | P1 | needs backend query | 余裕があれば |
| P1-2 | 通知 | トレンド・フォロー・審査結果など主要通知をまとめた bell ドロワー改善 | P1 | UI あり | UX 枠 |
| P1-3 | アカウント | Verified バッジや電話認証状態の表示位置を統一（Map tooltip / List card / Detail Sheet） | P1 | 既存データ | 表示統一 |

| P2-1 | 信頼スコア | 通報/虚偽投稿/フォロー数を反映した trust score を計算し、ランキング/広告枠に連携 | P2 | 後続 | 将来の信用設計 |
| P2-2 | Discovery | 行きたい通知/信頼メトリクス可視化 | P2 | 後続 | β以降 |

## タイムライン（例）
| 週 | 主要タスク |
|----|-------------|
| Week 1 | P0-1〜P0-4（メンテジョブ/マップ最適化/ビュー計測/AdSense）完了、運用メモ初稿 |
| Week 2 | 通報機能（P0-6）+ Playwright 導線（P0-7）+ モニタリング整備（P0-8） |
| Week 3 | E2E + 負荷 QA、Runbook 仕上げ。P1から必要分を実装 |
| Week 4 | βリリース QA、アプリ配信準備、ドキュメント固め |

## 依存/リスク
- **Cloud Scheduler 設定**: `npm run maintenance --workspace backend` を 10 分毎に叩かないと人気ランキングが古くなるので、Cloud Scheduler もしくは自宅サーバーの cron で必ず動かす。
- **ビュー API のログ扱い**: Firestore 書き込みが想定より増える可能性。セッション TTL を短くしつつ、失敗率を Sentry/GA4 で確認。
- **通報フロー**: MVP でも最低限の通報→確認ラインを作らないと Public Beta で場が荒れる。簡易でも早めに実装する。
- **Map パフォーマンス**: DOM 300 制限に引っかかりやすいので、marker pooling/auto degrade を優先的に入れる。

## リリース判定チェックリスト
- [ ] `npm run maintenance` が Cloud Scheduler / cron で 10 分毎に実行されているログが Cloud Logging で確認できる。
- [ ] トレンド画面でプロモ枠残り時間・枠種別・CTA、人気ランキングに view/like/score が表示される。
- [ ] SpotDetailSheet/Map/List/Promotion 全てから view API が呼ばれ、Firestore の `spots.view_count` が増えている。
- [ ] 通報 UI / Admin 対応が整っており、虚偽投稿/スパム対応手順が Runbook に記載済み。
- [ ] Playwright E2E が CI でパスし、手動 QA でも主要導線にブロッカーなし。
- [ ] Docs（README, operations.md, promotions-spec.md）が最新化され、自分がすぐ参照できる状態になっている。

---

この文書は MVP リリース向けの実行計画として適宜アップデートする。
