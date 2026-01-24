# CSSリファクタリング方針

## 現状分析

### CSSファイル一覧（サイズ順）

| ファイル | 行数 | サイズ | 用途 |
|---------|------|--------|------|
| `styles.css` | 5,299行 | 112KB | メインエントリーポイント |
| `base.css` | 4,963行 | 97KB | ベーススタイル |
| `SpotListView.css` | 1,976行 | 45KB | スポット一覧コンポーネント |
| `spot-create-refined.css` | 1,162行 | 28KB | スポット作成ページ |
| `trending-refined.css` | 694行 | 15KB | トレンドページ |
| `AccountPanel.css` | 410行 | 7KB | アカウントパネル |
| その他 | - | - | MapView, SpotDetailSheet, AdminLayout等 |

**合計: 約15,000行以上のCSS**

---

## 発見された問題点

### 1. ファイル間の大規模な重複

> [!CAUTION]
> `styles.css` と `base.css` でほぼ同一のコードが存在！

**重複している主要なセクション:**
- `:root` CSS変数宣言（約70行）
- `body`, `html`, `#root` のベースリセット
- `.avatar`, `.avatar-fallback` スタイル
- `.app-shell`, `.layout-column`, `.content-area` レイアウト
- `.map-callout-*` 関連スタイル（約150行）
- `.floating-panel`, `.auth-modal`, `.category-modal` モーダル
- `.account-card`, `.account-*` 関連スタイル（完全重複）
- `.spot-create-*` 関連スタイル（完全重複）
- `.form-card`, `.form-group`, `.form-row` フォーム

### 2. デザイントークンの分散

各ファイルで独自のCSS変数を再定義している:

```css
/* trending-refined.css */
:root {
  --trending-primary: #3b82f6;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --space-xs: 0.5rem;
  --radius-sm: 8px;
}

/* spot-create-refined.css */
:root {
  --spot-primary: #0084ff;
  --spot-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --spot-space-xs: 0.25rem;
  --spot-radius-sm: 8px;
}
```

**問題:** 
- 同じ目的の変数が異なる名前で定義
- 色やサイズの一貫性がない
- グローバル変数とローカル変数が混在

### 3. コンポーネントCSSの完全重複

`styles.css` と `AccountPanel.css` で `.account-card` の定義が完全に重複（約180行）

### 4. 使用されていない可能性のあるスタイル

- `.spot-mobile-card` 関連のレガシースタイル
- `.spot-card-media` などの古いカードレイアウト

---

## リファクタリング方針

### Phase 1: デザイントークンの統一

1. **`_variables.css` を新規作成**
   - すべてのCSS変数を1箇所に集約
   - カラーパレット、スペーシング、シャドウ、ボーダー半径を統一

```css
/* 例: 統一されたデザイントークン */
:root {
  /* Colors */
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  
  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-full: 9999px;
}
```

### Phase 2: ファイル構造の再編成

**提案構造:**
```
frontend/src/styles/
├── _variables.css      # デザイントークン（新規）
├── _reset.css          # ベースリセット（新規）
├── _utilities.css      # ユーティリティクラス（新規）
├── base.css            # レイアウト・共通コンポーネント（整理後）
├── components/
│   ├── AccountPanel.css
│   ├── SpotListView.css
│   ├── SpotDetailSheet.css
│   ├── MapView.css
│   └── ...
├── pages/
│   ├── spot-create.css    # リネーム
│   └── trending.css       # リネーム
└── index.css           # エントリーポイント（@import整理）
```

### Phase 3: 重複コードの削除

1. `styles.css` を `index.css` にリネームし、@importのみに
2. `base.css` から重複を除去
3. コンポーネントCSSから `styles.css` への重複を削除

### Phase 4: 未使用スタイルの削除

1. PurgeCSSまたは手動調査で未使用セレクタを特定
2. レガシーなカードスタイルを削除

---

## 実行優先度

| 優先度 | タスク | 工数見積り | 影響範囲 |
|--------|--------|------------|----------|
| 🔴 高 | `styles.css`と`base.css`の統合 | 大 | 全体 |
| 🟡 中 | デザイントークン統一 | 中 | 全体 |
| 🟢 低 | コンポーネントCSS整理 | 小 | 各機能 |
| 🟢 低 | 未使用スタイル削除 | 小 | - |

---

## 注意事項

> [!IMPORTANT]
> CSSの変更は見た目に直接影響するため、各段階でブラウザでの動作確認が必要

**検証方法:**
1. 各主要ページ（マップ、リスト、トレンド、アカウント、スポット作成）の表示確認
2. モバイル・デスクトップ両方でのレイアウト確認
3. モーダル・ドロワーなどのインタラクション確認

---

## 次のステップ

1. ユーザーの承認を得る
2. Phase 1から順次実行
3. 各フェーズ完了後にテスト

