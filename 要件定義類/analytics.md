# アナリティクス方針

## 基本方針

- **汎用メトリクス**: Firebase Analytics を利用
- **アプリ固有メトリクス**: 自作（Firestore集計）

---

## 1. Firebase Analytics（汎用）

### 取得するデータ
| メトリクス | 説明 | 確認場所 |
|-----------|------|---------|
| アクティブユーザー | DAU/MAU | Firebase Console |
| セッション時間 | 平均滞在時間 | Firebase Console |
| スクリーン遷移 | 画面ごとのPV | Firebase Console |
| ユーザー属性 | 地域、デバイス等 | Firebase Console |

### カスタムイベント（実装予定）
```typescript
// スポット閲覧
logEvent(analytics, "spot_view", {
  spot_id: string,
  category: string,
  owner_id: string
});

// スポット投稿
logEvent(analytics, "spot_create", {
  announcement_type: "short_term_notice" | "long_term_campaign",
  category: string
});

// マップ操作
logEvent(analytics, "map_interaction", {
  action: "zoom" | "pan" | "marker_click"
});

// 検索
logEvent(analytics, "search", {
  query: string,
  results_count: number
});
```

### 導入手順
1. Firebase Console でAnalyticsを有効化
2. `frontend/src/lib/analytics.ts` にイベント送信関数を追加
3. 各コンポーネントから適切なタイミングで呼び出し

---

## 2. 自作アナリティクス（アプリ固有）

### 管理画面で表示するメトリクス
| メトリクス | データソース | 更新頻度 |
|-----------|-------------|---------|
| 未処理通報数 | `spot_reports` (status=open) | リアルタイム |
| 審査待ち件数 | `scheduled_spots` (status=pending) | リアルタイム |
| 本日の承認数 | `scheduled_spot_review_logs` | リアルタイム |
| 本日の投稿数 | `scheduled_spots` (created_at) | リアルタイム |

### 将来的な拡張（優先度低）
- 投稿者別パフォーマンス（閲覧数、いいね数）
- カテゴリ別人気度
- 時間帯別アクティビティ

---

## 3. 実装ロードマップ

### Phase 1: Firebase Analytics基本導入
- [ ] Firebase ConsoleでAnalytics有効化確認
- [ ] 基本イベント（spot_view, spot_create）の送信実装
- [ ] Consoleでデータ確認

### Phase 2: 管理画面の自作メトリクス整理
- [ ] 現在のanalyticsService.tsを簡素化
- [ ] 実データのみ表示（未処理通報、審査待ち件数）
- [ ] スタブデータ（activeUsers等）を削除またはFirebaseリンク案内に変更

### Phase 3: 高度なトラッキング（必要に応じて）
- [ ] ユーザージャーニー分析
- [ ] コンバージョンファネル設定
- [ ] A/Bテスト連携

---

## 4. 注意事項

### プライバシー
- 個人を特定できる情報はイベントに含めない
- ユーザーIDを送る場合はハッシュ化を検討

### パフォーマンス
- イベント送信は非同期で行い、UIをブロックしない
- 過度なイベント送信は避ける（バッチ処理を検討）

### コスト
- Firebase Analyticsは無料
- BigQueryエクスポートを使う場合は従量課金に注意

---

## 参考リンク

- [Firebase Analytics ドキュメント](https://firebase.google.com/docs/analytics)
- [推奨イベント一覧](https://support.google.com/analytics/answer/9267735)
- [Firebase Console](https://console.firebase.google.com/)
