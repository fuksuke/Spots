# Walkthrough: Spots Map UI Performance & Cost Optimization (v0.4)

## 概要 (Overview)
本更新では、v0.4スペックに基づき、コスト削減 (Map Load回避) とパフォーマンス向上 (メインスレッドブロック回避) を実装しました。また、保守性を高めるために巨大化していた `MapView.tsx` をリファクタリングしました。

## 実装内容 (Changes)

### 1. TaskScheduler Integration (Performance)
マーカー (Spot Callout) の作成・更新処理を `TaskScheduler` を用いてバッチ化・分散化しました。
- `c:\Users\fukud\python\Shibuya LiveMap MVP\frontend\src\lib\map\TaskScheduler.ts`: タスクの優先度付きスケジューリング機能。
- `c:\Users\fukud\python\Shibuya LiveMap MVP\frontend\src\lib\map\SpotCalloutManager.ts`: `sync` メソッドを非同期化し、大量のマーカー更新時のUIフリーズを防止。

### 2. GlobalMapProvider (Cost Reduction)
Mapbox GL JS のインスタンスをページ遷移間で永続化する仕組みを導入しました。
- `c:\Users\fukud\python\Shibuya LiveMap MVP\frontend\src\features\map\GlobalMapProvider.tsx`: マップインスタンスの生成・保持・DOMへの着脱 (Attach/Detach) を管理。
- `c:\Users\fukud\python\Shibuya LiveMap MVP\frontend\src\main.tsx`: アプリケーション全体を Provider でラップ。
- `c:\Users\fukud\python\Shibuya LiveMap MVP\frontend\src\features\map\hooks\useMapInitialization.ts`: `new mapboxgl.Map()` の代わりに `useGlobalMap().attach()` を使用するように変更。

### 3. MapView Refactoring (Maintainability)
1300行超の `MapView.tsx` を機能ごとの Hooks に分割・整理しました。

| Hook File | 役割 |
|-----------|------|
| `useInteractiveMap.ts` | クリック、ホバー、カーソル制御などのインタラクション処理 |
| `useMapLayerLogic.ts` | タイル計算、LOD (Level of Detail) 判定、データ変換ロジック |
| `useMapRenderer.ts` | Canvas レンダリング、GeoJSON ソース更新処理 |
| `useMapInitialization.ts` | マップの初期化、リサイズ、Global Map 連携 |

これにより、`MapView.tsx` は約270行まで圧縮され、各ロジックの見通しが良くなりました。

## 検証手順 (Verification Steps)

1. **Global Map の動作確認**:
   - アプリを起動し、地図が表示されることを確認。
   - 別のページ（例: アカウント設定）に移動し、再び地図ページに戻る。
   - **期待値**: 地図がリロードされず（Mapboxのロゴが一瞬消えて再表示されるような挙動がなく）、即座に表示されること。DevToolsのNetworkタブでMapboxへの初期リクエストが再送されていないことを確認可能。

2. **TaskScheduler の動作確認**:
   - ズームアウトして大量のスポットを表示領域に入れる。
   - ズームイン/アウトを繰り返す。
   - **期待値**: UIがカクつくことなく、マーカーが順次表示される（一瞬ですべて表示されず、少しずつ表示される挙動が見える場合があります）。

3. **機能リグレッション確認**:
   - スポットクリックで詳細が表示されるか。
   - キャンバスモード（高密度時）の描画が正常か。
   - フィルタリングが機能するか。

## 次のステップ (Next Steps)
- **Tap-to-Grow**: ピンタップ時のインライン拡大UIの実装（将来のロードマップ）。
- **Vector Tile Hosting**: Mapbox API依存度のさらなる低減（将来のロードマップ）。
