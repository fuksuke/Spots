# 管理画面・審査基盤 設計書 (Admin Panel Design & Roadmap)

## 1. 概要 (Overview)
Shibuya LiveMap MVPの管理画面は、プラットフォームの健全性を維持し、質の高いコンテンツをユーザーに届けるための**コントロールセンター**です。
「見やすく、迷わず、素早く」操作できるUIを目指し、投稿されたスポット情報の審査と、ユーザーからの通報対応を効率的に行える基盤を構築します。

---

## 2. 審査・運用ルール (Rules & Workflow)

### 審査基準 (Review Criteria)
管理者は以下の基準で投稿を審査します。不適切な投稿はアプリ上に公開されません。
- **コンテンツ**: 公序良俗に反しないか、違法性がないか、渋谷エリアのイベント情報として適切か。
- **品質**: 画像が著しく低画質でないか、タイトルや説明文が具体的でユーザーに有益か。
- **信頼性**: 位置情報が正確か、開催日時が現実的か（過去日付や異常な長期間設定など）。

### 運用の流れ (Operational Flow)
1. **投稿 (Submission)**: ユーザーがフォームから投稿 → **「審査待ち」**としてDB保存。
2. **審査 (Review)**: 管理者が管理画面で内容を確認。
    - **承認 (Approve)**: 即時または指定日時に**「公開」**ステータスへ移行。
    - **却下 (Reject)**: 理由（テンプレート/コメント）を添えて却下。ユーザーへ通知（将来機能）。
3. **監視 (Monitoring)**: 公開後のスポットに対するユーザーからの通報を確認。
    - **対応 (Action)**: 問題があればスポットを非公開/削除し、通報を「解決済み」にする。

---

## 3. データライフサイクルとアーキテクチャ (Architecture)

### データフロー (Data Lifecycle)
すべてのコンテンツは**必ず管理者の承認プロセス（ステータス管理）を経由**します。管理画面を通さない「抜け道」は存在しません。

1. **Spot Post Flow**:
   `User Input` -> `API (Create)` -> **[DB: ScheduledSpot (Pending)]** -> `Admin Review` -> **[DB: ScheduledSpot (Approved/Published)]** -> `Public App`
   *Emergency Action*: **[Approved/Published]** -> `Admin Force Delete/Unpublish` -> **[DB: ScheduledSpot (Rejected/Cancelled)]**

2. **Report Flow**:
   `User Report` -> `API (Report)` -> **[DB: SpotReport (Open)]** -> `Admin Action (Delete Spot / Resolve)` -> **[DB: SpotReport (Resolved)]**

### データベース設計 (Schema Overview)
既存のフロントエンド実装から定義される主要モデルです。

- **`scheduled_spots`**: 審査対象のスポット情報。
    - `status`: `pending` (初期値) -> `approved` / `rejected` -> `published` (公開)
    - `reviewNotes`: 審査時のコメント履歴。
- **`spot_reports`**: 通報情報。
    - `status`: `open` (未対応) -> `resolved` (対応済み)
    - `reason`: スパム、誤情報、不適切などの区分。
- **`review_logs`**: 管理者の操作ログ（いつ、誰が、どのステータスに変更したか）。
- **`admin_alerts`**: 管理者向け通知（新規通報、審査待ち発生、システムアラート）。

---

## 4. 実装状況 (Implementation Status)

### ✅ 実装済み (Completed)

| 機能 | ファイル | 詳細 |
|------|----------|------|
| 通報からの直接アクション | `AdminSpotReportsPanel.tsx` | 「強制削除」ボタン、通報解決と連動 |
| 投稿者IDフィルタリング | `AdminDashboard.tsx`, `scheduledSpotService.ts` | Backend/Frontend 両方対応 |
| 公開済みコンテンツの緊急停止 | `AdminScheduledSpotsPanel.tsx`, `scheduledSpotService.ts` | `published → rejected` 遷移、「公開停止(却下)」ボタン |
| レートリミット | `rateLimit.ts` | 通報API: 1時間10回制限 |
| 管理者通知システム | `notificationService.ts`, `AdminNotificationsPanel.tsx` | DB保存、15秒ポーリング、既読管理 |
| 通報時の管理者通知 | `spotsController.ts` | `notifyAdminOfReport` 呼び出し |
| 審査待ち発生時の通知 | `scheduledSpotsController.ts` | `notifyAdminOfPendingSpot` 呼び出し |
| 日付フィルタ | `AdminDashboard.tsx` | 公開予定日での絞り込みUI |
| 通報ログイン必須化 | `spots.ts`, `SpotDetailSheet.tsx` | 匿名通報を廃止、ログイン必須 |
| AdminLayout・ナビゲーション | `AdminLayout.tsx` | タブ切り替え、通知パネル統合 |
| カード型UI | `AdminScheduledSpotsPanel.tsx`, `AdminSpotReportsPanel.tsx` | グリッドカード表示、画像プレビュー、バッジ表示 |
| レスポンシブ完全対応 | `AdminLayout.tsx`, `AdminLayout.css`, `base.css` | ボトムタブバー、safe-area対応、横向き対応 |

### ⚠️ 部分実装 / 要改善 (Partial / Needs Improvement)

| 機能 | 状態 | 残作業 |
|------|------|--------|


---

## 5. 開発ロードマップ (Development Roadmap)

### Phase 1: 必須機能の実装 (Essential Functions) 🔥
**目的**: 運用上の「できない」「危険」を解消する。

- [x] **通報アクション実装**:
    - [x] 通報一覧 (`AdminSpotReportsPanel`) に「スポット非公開」「削除」ボタンを追加
    - [x] 通報を「解決済み」にする処理と連動
- [x] **公開済みコンテンツの緊急停止**:
    - [x] `reviewScheduledSpot`: `published` -> `rejected` (公開取り消し) を許可
    - [x] AdminScheduledSpotsPanel で「公開停止 (却下)」ボタン
- [x] **フィルタリング機能強化**:
    - [x] 投稿者ID (ownerId) での検索機能
    - [x] **日付フィルタUI**: 公開予定日での絞り込み

### Phase 1.5: セキュリティと信頼性 (Security & Reliability) 🛡️
- [x] **通報APIの保護**:
    - [x] レートリミット (Rate Limiting) の実装
    - [x] 認証要件: 通報はログイン必須化（匿名通報を廃止）
- [x] **監視・通知 (Monitoring & Alerts)**:
    - [x] 通報時の管理者通知
    - [x] **審査待ち発生時の管理者通知** (`notifyAdminOfPendingSpot` 呼び出し)
    - [x] `publishDueScheduledSpots` ジョブの実行通知
- [ ] 外部通知連携（メール/Slack）- 優先度低

### Phase 2: UI基盤とナビゲーション (Foundation & Layout) 🔨
**目的**: 操作性を改善し、基本的な使い勝手を整える。
- [x] **ナビゲーション整理**:
    - [x] `AdminLayout` の改修。タブ切り替え、通知パネル統合
- [x] **通知機能**: ヘッダーの通知バーと未読管理の統合

### Phase 3: デザイン刷新 (Visual Polish) 🎨
**目的**: 見た目を整え、長期的な運用負荷を下げる。
- [x] **審査カードのデザイン化**: リスト表示からリッチなカード表示へ変更
- [x] **レスポンシブ完全対応**: スマホ用ボトムタブバー、フィルター・カードの完全レスポンシブ化

### Future: スケール対応 (Scalability) 📈
- **ユーザー管理**: 悪質ユーザーの凍結機能
- **自動化**: 自動承認システム等

---

## 6. 次回実装タスク (Next Tasks)

### 優先度: 低（Future）
1. **外部通知連携** - Slack/メール通知
2. **ユーザー管理** - 悪質ユーザー凍結機能
3. **自動化** - 自動承認システム

---

## 7. 実装完了履歴

### 2026-01-24 (Phase 3)
- [x] カード型UI: `AdminScheduledSpotsPanel.tsx`, `AdminSpotReportsPanel.tsx` をグリッドカード表示に刷新
  - 画像プレビュー対応、カテゴリ/タイプバッジ、ステータス表示の視覚化
  - 通報カードもリッチなデザインに更新
- [x] レスポンシブ完全対応:
  - `AdminLayout.tsx` にボトムタブバー追加（768px以下でモバイルUI）
  - アイコン付きナビゲーション（クリップボード/フラグ/チャート）
  - safe-area-inset対応（ノッチ付きデバイス）
  - 横向きスマホ対応（2カラムカード、横並びタブ）
  - フィルター・ツールバーの完全レスポンシブ化

### 2024-01-24
- [x] 日付フィルタUI: `AdminDashboard.tsx` に公開予定日範囲フィルタを追加
- [x] 審査待ち通知: `scheduledSpotsController.ts` で `notifyAdminOfPendingSpot` 呼び出し追加
- [x] 通報ログイン必須化: `requireAuth` ミドルウェア追加、フロントエンドでログイン促進UI
