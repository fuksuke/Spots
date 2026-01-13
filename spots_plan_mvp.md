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

## 現在の実装状況（2026-01 時点）

### 全体達成度：約70-75%
- **α版**（投稿・いいね・地図表示）：**100%達成** ✅
- **β版**（通知・信頼スコア・通報）：**約50-60%** ⚠️
- **1.0版**（広告枠・トレンド・検索）：**約20-30%** ❌

### 実装済み機能
- ✅ リアルタイム投稿（spots）＋予約投稿（scheduled_spots）
- ✅ SMS電話認証（phoneVerified必須）
- ✅ いいね・コメント・フォロー・お気に入り機能
- ✅ 地図表示（cluster/pulse/balloon レイヤー、DOM budget制御）
- ✅ 通報機能（spot_reports）＋管理画面
- ✅ 予約投稿審査フロー＋審査テンプレート
- ✅ 人気スポットランキング（popularity_score算出）
- ✅ Tier システム（A/B/C）
- ✅ In-App通知（モデレーション通知）
- ✅ 管理ダッシュボード（通報管理・予約投稿審査）

### 未実装の重要機能
- ❌ **Push通知システム**（FCM統合、いいね/フォロー/イベント開始前通知）
- ❌ **完全な信頼スコアシステム**（trust_score、自動ペナルティ、段階的警告）
- ❌ **ドタキャンペナルティ**（時間帯別ペナルティ適用）
- ❌ **通報制限**（1日3件上限、report_score）
- ❌ **リアルタイムメッセージ**（「もうすぐ始まるよ！」等の状態別表示）
- ❌ **吹き出し3秒切替アニメーション**
- ❌ **Stripe決済統合**（広告課金システム）
- ❌ **アフィリエイト機能**（投稿者収益化）
- ❌ **AIレコメンド機能**

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

### β版に向けた追加タスク（spots_plan_v0.1.md 要件ベース）
| ID | カテゴリ | 内容 | 優先度 | 依存 | 備考 |
|----|----------|------|---------|------|------------|
| **B0-1** | **Push通知** | Firebase Cloud Messaging (FCM) 統合 + Service Worker実装 | **P0** | FCM設定 | **ユーザーリテンション最重要** |
| **B0-2** | **Push通知** | いいね通知（1,10,50,100,500,1000回でトリガー） | **P0** | B0-1 | Cloud Functions実装 |
| **B0-3** | **Push通知** | フォロー通知（フォローされた瞬間） | **P0** | B0-1 | Cloud Functions実装 |
| **B0-4** | **Push通知** | イベント開始前通知（行きたい登録済み、30分前） | **P0** | B0-1 | Cloud Scheduler連携 |
| **B0-5** | **Push通知** | 通知設定画面（ON/OFF切替、カテゴリ別設定） | **P0** | B0-1 | Frontend実装 |
| **B1-1** | **信頼スコア** | users.trust_score フィールド追加（0-100、初期値60） | **P1** | なし | **健全性維持の核** |
| **B1-2** | **信頼スコア** | 虚偽投稿ペナルティ（-50点、通報3件以上で自動フラグ） | **P1** | B1-1 | Cloud Functions実装 |
| **B1-3** | **信頼スコア** | ドタキャンペナルティ（時間帯別：-5〜-50点） | **P1** | B1-1 | Cloud Scheduler連携 |
| **B1-4** | **信頼スコア** | 段階的警告システム（<40で審査強化、<20で停止、<10でBAN） | **P1** | B1-1, B1-2 | 自動制限ロジック |
| **B1-5** | **信頼スコア** | リカバリーポイント（30日間問題なし+5点、イベント成功+10点） | **P1** | B1-1 | ポジティブ評価 |
| **B1-6** | **通報強化** | 通報上限（1日3件、daily_report_count カウンター） | **P1** | なし | Cloud Scheduler でリセット |
| **B1-7** | **通報強化** | report_score 実装（正当通報+5、虚偽通報-10） | **P1** | B1-6 | 通報信頼度システム |
| **B1-8** | **通報強化** | 通報の重み調整（score>=70で×1.5、<30で×0.5） | **P1** | B1-7 | 質の高い通報を優先 |
| B2-1 | UX強化 | リアルタイムメッセージ（event_status: upcoming/live/ending_soon/ended） | P1 | なし | 吹き出しメッセージ動的変更 |
| B2-2 | UX強化 | 吹き出し3秒切替アニメーション（CSS transition、プレミアム除外） | P1 | なし | 「街が生きている」演出 |
| B2-3 | トレンド | 話題急上昇ランキング（24時間以内のいいね増加率） | P1 | なし | トレンド機能強化 |
| B2-4 | 検索 | アドバンスドサーチ（複合条件、保存された検索） | P2 | P1-1 | UX枠 |

## タイムライン（例）

### MVP（Private Alpha）リリース - Week 1〜4
| 週 | 主要タスク |
|----|-------------|
| Week 1 | P0-1〜P0-4（メンテジョブ/マップ最適化/ビュー計測/AdSense）完了、運用メモ初稿 |
| Week 2 | 通報機能（P0-6）+ Playwright 導線（P0-7）+ モニタリング整備（P0-8） |
| Week 3 | E2E + 負荷 QA、Runbook 仕上げ。P1から必要分を実装 |
| Week 4 | MVP（Private Alpha）リリース QA、アプリ配信準備、ドキュメント固め |

### β版（Public Beta）準備 - Week 5〜10
| 週 | 主要タスク | タスクID |
|----|-------------|----------|
| Week 5-6 | FCM統合 + Service Worker実装、Push通知基盤構築 | B0-1 |
| Week 6-7 | いいね/フォロー/イベント開始前通知実装、通知設定画面 | B0-2, B0-3, B0-4, B0-5 |
| Week 7-8 | trust_score実装、虚偽投稿/ドタキャンペナルティ、段階的警告 | B1-1, B1-2, B1-3, B1-4, B1-5 |
| Week 8-9 | 通報システム強化（上限・信頼度・重み調整） | B1-6, B1-7, B1-8 |
| Week 9-10 | UX強化（リアルタイムメッセージ、吹き出しアニメ）、QA | B2-1, B2-2 |
| Week 10 | β版（Public Beta）リリース準備、最終QA |

### 1.0版リリース準備 - Week 11〜14
| 週 | 主要タスク |
|----|-------------|
| Week 11-12 | Stripe決済統合、広告課金システム実装 |
| Week 13 | アフィリエイト機能、コンバージョントラッキング |
| Week 14 | 1.0版リリース QA、プロダクション展開 |

## 依存/リスク

### MVP（Private Alpha）リスク
- **Cloud Scheduler 設定**: `npm run maintenance --workspace backend` を 10 分毎に叩かないと人気ランキングが古くなるので、Cloud Scheduler もしくは自宅サーバーの cron で必ず動かす。
- **ビュー API のログ扱い**: Firestore 書き込みが想定より増える可能性。セッション TTL を短くしつつ、失敗率を Sentry/GA4 で確認。
- **通報フロー**: MVP でも最低限の通報→確認ラインを作らないと Public Beta で場が荒れる。簡易でも早めに実装する。
- **Map パフォーマンス**: DOM 300 制限に引っかかりやすいので、marker pooling/auto degrade を優先的に入れる。

### β版（Public Beta）追加リスク
- **Push通知コスト**: FCM無料枠（月間無制限だが、送信レート制限あり）を超えないよう、通知頻度を最適化する必要がある。
- **信頼スコア誤検知**: 自動ペナルティが厳しすぎると正当なユーザーを排除する恐れ。初期は閾値を緩めに設定し、運用データを見て調整。
- **ドタキャン検知の正確性**: 天候・災害等の正当理由を判定する仕組みが必要。初期は管理者による手動免除で対応。
- **通報システムの悪用**: 虚偽通報による攻撃（特定ユーザーへの嫌がらせ）を防ぐため、report_scoreの導入とレート制限が必須。
- **スケーラビリティ**: β版でユーザー数が急増した場合、Firestore書き込み（いいね/通知/ビューログ）がボトルネックになる可能性。Redis導入を検討。

### 1.0版追加リスク
- **Stripe決済の法的対応**: 特定商取引法、資金決済法への対応が必要。弁護士相談推奨。
- **アフィリエイト収益分配**: 投稿者への支払いフロー、税務処理（源泉徴収等）の整備が必要。
- **広告審査の運用負荷**: 有料広告が増えると審査工数が増加。自動審査ロジックの強化が必要。

## リリース判定チェックリスト

### MVP（Private Alpha）リリース判定
- [ ] `npm run maintenance` が Cloud Scheduler / cron で 10 分毎に実行されているログが Cloud Logging で確認できる。
- [ ] トレンド画面でプロモ枠残り時間・枠種別・CTA、人気ランキングに view/like/score が表示される。
- [ ] SpotDetailSheet/Map/List/Promotion 全てから view API が呼ばれ、Firestore の `spots.view_count` が増えている。
- [ ] 通報 UI / Admin 対応が整っており、虚偽投稿/スパム対応手順が Runbook に記載済み。
- [ ] Playwright E2E が CI でパスし、手動 QA でも主要導線にブロッカーなし。
- [ ] Docs（README, operations.md, promotions-spec.md）が最新化され、自分がすぐ参照できる状態になっている。

### β版（Public Beta）リリース判定
- [ ] FCM統合が完了し、Service Workerでプッシュ通知を受信できる。
- [ ] いいね通知（1,10,50,100,500,1000回）が正しくトリガーされる。
- [ ] フォロー通知が即座に配信される。
- [ ] 行きたい登録イベントの30分前通知が正確に送信される。
- [ ] 通知設定画面で各種通知のON/OFF切替が機能する。
- [ ] `users.trust_score` が正しく初期化され（初期値60）、ペナルティが正確に適用される。
- [ ] 虚偽投稿（通報3件以上）で自動的に-50点のペナルティが適用される。
- [ ] ドタキャンペナルティが時間帯別に正しく計算される（-5〜-50点）。
- [ ] trust_score < 40で投稿審査が強化、< 20で停止、< 10でBANされる。
- [ ] 通報上限（1日3件）が正しく機能し、Cloud Schedulerで毎日リセットされる。
- [ ] `report_score` が正当通報/虚偽通報で増減する。
- [ ] リアルタイムメッセージ（「もうすぐ始まるよ！」等）が状態別に表示される。
- [ ] 吹き出しが3秒ごとに切り替わるアニメーションが機能する（プレミアム除外）。
- [ ] Firestore書き込み負荷が許容範囲内（必要に応じてRedis導入）。

### 1.0版リリース判定
- [ ] Stripe決済統合が完了し、テスト決済が成功する。
- [ ] 広告プラン（プレミアム/スタンダード/スポット）が正しく機能する。
- [ ] 広告審査フロー（trust_score >= 60必須、管理者承認）が整っている。
- [ ] アフィリエイトリンクが投稿に追加でき、クリック数がトラッキングされる。
- [ ] コンバージョントラッキングが機能し、収益分配が正確に計算される。
- [ ] 法的対応（特定商取引法、資金決済法）が完了している。
- [ ] 投稿者への支払いフローと税務処理が整備されている。
- [ ] AIレコメンド機能が実装され、ユーザー行動分析が機能する（オプション）。

---

## β版実装ガイド（技術詳細）

### Push通知システム実装（B0-1〜B0-5）

#### 技術スタック
- Firebase Cloud Messaging (FCM)
- Cloud Functions for Firebase (TypeScript)
- Service Worker API
- Cloud Scheduler

#### 実装手順
1. **FCM設定**
   - Firebase Consoleでプロジェクト設定
   - `firebase-admin` SDK統合
   - `firebase-messaging` クライアント統合

2. **Service Worker実装** (`frontend/public/firebase-messaging-sw.js`)
   ```javascript
   // バックグラウンド通知受信
   messaging.onBackgroundMessage((payload) => {
     self.registration.showNotification(title, options);
   });
   ```

3. **Cloud Functions実装** (`backend/src/functions/notifications.ts`)
   - `onLikeCreate`: いいね数が閾値（1,10,50...）に達したらトリガー
   - `onFollowCreate`: フォローされたら即座にトリガー
   - `scheduledEventReminder`: Cloud Schedulerで1時間ごとにチェック、30分前のイベントに通知

4. **通知設定画面** (`frontend/src/components/NotificationSettings.tsx`)
   - ユーザープロフィールに `notification_settings` フィールド追加
   - カテゴリ別ON/OFF切替UI

### 信頼スコアシステム実装（B1-1〜B1-5）

#### データモデル拡張
```typescript
// users コレクション
interface UserProfile {
  trust_score: number; // 0-100、初期値60
  trust_score_history: Array<{
    timestamp: Timestamp;
    delta: number;
    reason: string;
  }>;
  penalty_count: number;
  last_penalty_at: Timestamp | null;
}

// penalty_logs コレクション（新規作成）
interface PenaltyLog {
  user_id: string;
  spot_id?: string | null;
  penalty_type: "fraud" | "cancellation" | "spam" | "abuse";
  points_deducted: number;
  reason: string;
  created_at: Timestamp;
  resolved: boolean;
}
```

#### 実装手順
1. **虚偽投稿ペナルティ** (`backend/src/functions/moderation.ts`)
   - `onReportCreate`: 通報が追加されたら、同一スポットへの通報数をカウント
   - 3件以上で自動フラグ → 管理者通知
   - 管理者が「虚偽」判定したら `-50点` 適用

2. **ドタキャンペナルティ** (`backend/src/functions/scheduledJobs.ts`)
   - Cloud Scheduler で1時間ごとに実行
   - `scheduled_spots.status === "cancelled"` を検出
   - キャンセル時刻とイベント開始時刻の差分を計算
   - ペナルティ適用：
     ```typescript
     const hoursBefore = (startTime - cancelledAt) / 3600000;
     let penalty = 0;
     if (hoursBefore >= 24) penalty = -5;
     else if (hoursBefore >= 1) penalty = -15;
     else if (hoursBefore >= 0) penalty = -25;
     else penalty = -50; // 無断ドタキャン
     ```

3. **段階的制限** (`backend/src/middleware/trustScoreCheck.ts`)
   - 投稿APIで `trust_score` チェック
   - `< 40`: 手動審査必須（`status: "pending_review"`）
   - `< 20`: 投稿不可（HTTP 403エラー）
   - `< 10`: 完全BAN（ログイン不可）

4. **リカバリーポイント** (`backend/src/functions/recovery.ts`)
   - Cloud Scheduler で毎日実行
   - 30日間ペナルティなし → `+5点`
   - イベント成功完了（`end_time` 経過 & キャンセルなし）→ `+10点`

### 通報システム強化（B1-6〜B1-8）

#### データモデル拡張
```typescript
// users コレクション
interface UserProfile {
  daily_report_count: number; // 当日の通報回数
  report_count_reset_at: Timestamp; // リセット日時
  report_score: number; // 50が初期値、70以上で重み×1.5、30未満で×0.5
}
```

#### 実装手順
1. **通報上限** (`backend/src/controllers/spotReportsController.ts`)
   - 通報API呼び出し時に `daily_report_count` チェック
   - 3件以上ならHTTP 429エラー（Too Many Requests）
   - Cloud Scheduler で毎日0:00に `daily_report_count = 0` にリセット

2. **report_score更新** (`backend/src/functions/moderation.ts`)
   - 管理者が通報を「正当」判定 → `report_score += 5`
   - 管理者が通報を「虚偽」判定 → `report_score -= 10`
   - `report_score < 20` → 通報機能一時停止

3. **通報の重み調整** (`backend/src/services/moderationService.ts`)
   ```typescript
   const getReportWeight = (reportScore: number): number => {
     if (reportScore >= 70) return 1.5;
     if (reportScore < 30) return 0.5;
     return 1.0;
   };
   ```

### UX強化実装（B2-1〜B2-2）

#### リアルタイムメッセージ
```typescript
// spots コレクション
interface Spot {
  event_status: "upcoming" | "live" | "ending_soon" | "ended";
  status_message: string; // 自動生成メッセージ
}

// Cloud Functions で1分ごとに更新
const updateEventStatus = (spot: Spot): void => {
  const now = Date.now();
  const startTime = spot.start_time.toMillis();
  const endTime = spot.end_time.toMillis();

  if (now < startTime - 1800000) { // 30分前
    spot.event_status = "upcoming";
    spot.status_message = "もうすぐ始まるよ！";
  } else if (now >= startTime && now < endTime - 1800000) {
    spot.event_status = "live";
    spot.status_message = "今まさに開催中🔥";
  } else if (now >= endTime - 1800000 && now < endTime) {
    spot.event_status = "ending_soon";
    spot.status_message = "まもなく終了！";
  } else {
    spot.event_status = "ended";
    spot.status_message = "今日はありがとう！";
  }
};
```

#### 吹き出し3秒切替アニメーション
```typescript
// frontend/src/components/MapView.tsx
const [visibleCallouts, setVisibleCallouts] = useState<string[]>([]);

useEffect(() => {
  const interval = setInterval(() => {
    // プレミアム以外のスポットをローテーション
    const regularSpots = spots.filter(s => !s.is_premium);
    const nextBatch = regularSpots.slice(currentIndex, currentIndex + 10);
    setVisibleCallouts(nextBatch.map(s => s.id));
    setCurrentIndex((prev) => (prev + 10) % regularSpots.length);
  }, 3000);

  return () => clearInterval(interval);
}, [spots]);
```

---

この文書は MVP リリース向けの実行計画として適宜アップデートする。
