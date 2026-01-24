# マップモード設計分析書

コードベースから分析した現時点でのマップモード設計のドキュメント。

---

## 1. マップモードの定義

### MapTileLayer 型定義

**ファイル**: `frontend/src/types.ts` (line 119)

```typescript
export type MapTileLayer = "cluster" | "pulse" | "balloon";
```

3つの主要レンダリングモード + 1つのフォールバックモード:

| モード | ズームレベル | 説明 |
|--------|-------------|------|
| **cluster** | ≤9 | グループ化されたスポットを数値付き大円として描画 |
| **pulse** | 9〜12 | 個別スポットをアニメーション付きカラー円で描画 |
| **balloon** | >12 | 詳細なコールアウトバブル（スポット情報表示） |
| **canvas** | - | DOM性能劣化時の2Dキャンバスフォールバック |

### レイヤー判定ロジック

**ファイル**: `frontend/src/features/map/hooks/useMapLayerLogic.ts` (lines 326-331)

```typescript
export const deriveLayerForZoom = (zoom: number): MapTileLayer => {
    const clamped = clampZoom(zoom);
    if (clamped <= GRID_MAX_ZOOM) return "cluster";
    if (clamped <= 12) return "pulse";
    return "balloon";
};
```

---

## 2. 状態管理アーキテクチャ

### MapView コンポーネント状態

**ファイル**: `frontend/src/features/map/MapView.tsx` (lines 126-156)

```typescript
const [renderMode, setRenderMode] = useState<MapTileLayer | 'canvas'>('balloon');
const [activeLayer, setActiveLayer] = useState<MapTileLayer | undefined>(tileLayer);
const [tileCoordinates, setTileCoordinates] = useState<TileCoordinate[]>([]);
const [fallbackSpots, setFallbackSpots] = useState<MapTileFeature[]>([]);

// レイヤーオーバーライドフラグ
const isLayerOverridden = tileLayer !== undefined;
```

### 自動レイヤー切り替え

**ファイル**: `MapView.tsx` (lines 223-262)

切り替え判定要素:
1. **ズームレベル** - `deriveLayerForZoom()` 経由
2. **DOMバジェット** - 許容DOM要素数（基準300、デバイス別調整）
3. **データ密度** - 非クラスタフィーチャー数

```typescript
const handleLayerDensity = useCallback(
    (layer: MapTileLayer, nonClusterCount: number, zoom: number): MapTileLayer | 'canvas' => {
        let nextLayer: MapTileLayer | 'canvas' = layer;
        if (nextLayer === 'balloon' && (nonClusterCount > PULSE_DENSITY_THRESHOLD || zoom < 10.5)) {
            nextLayer = 'pulse';
        }
        if (nextLayer === 'pulse' && (nonClusterCount > CLUSTER_DENSITY_THRESHOLD || zoom <= GRID_MAX_ZOOM + 0.2)) {
            nextLayer = 'cluster';
        }
        if (nextLayer === 'cluster' && nonClusterCount > DOM_BUDGET) {
            return 'canvas';
        }
        return nextLayer;
    },
    []
);
```

### 閾値設定 (lines 44-46)

| 定数 | 値 | 説明 |
|------|-----|------|
| `PULSE_DENSITY_THRESHOLD` | 180 | DOMバジェットの60% |
| `CLUSTER_DENSITY_THRESHOLD` | 225 | DOMバジェットの75% |
| `DOM_BUDGET` | 300 | 基準値（デバイス適応型） |

### FPSベース劣化

**ファイル**: `MapView.tsx` (lines 179-192)

```typescript
const FPS_THRESHOLD = 30;
fpsMonitorRef.current = new FPSMonitor(
    FPS_THRESHOLD,
    (fps) => {
        if (!isLayerOverridden) {
            setRenderMode('canvas');
        }
    },
    60, 60
);
```

---

## 3. タイルデータ取得・管理

### useMapTiles フック

**ファイル**: `frontend/src/hooks/useMapTiles.ts`

```typescript
export const useMapTiles = ({
    coordinates,
    layer,
    categories,
    premiumOnly,
    authToken,
    enabled = true
}: UseMapTilesOptions)
```

機能:
- **座標ベースフェッチ**: 可視マップ座標に基づくタイルリクエスト
- **レイヤーフィルタリング**: cluster/pulse/balloon別フィルタ
- **カテゴリフィルタリング**: スポットカテゴリ別フィルタ（オプション）
- **プレミアムフィルタリング**: プレミアム専用フィルタ（オプション）
- **キャッシュ**: `mapTileCache`によるクライアントサイドキャッシュ
- **デバウンス**: 過剰リクエスト防止（150ms）

### レンダリングデータ構築

**ファイル**: `useMapLayerLogic.ts` (lines 109-210)

`buildRenderingData()` の処理:
1. クラスタフィーチャーとスポットフィーチャーの分離
2. 期限切れスポットのフィルタリング（endTime確認）
3. IDによる重複排除
4. DOMバジェット内でのプレミアムスポット優先
5. レンダリング用構造化データの返却

---

## 4. UIコンポーネント構造

### MapView コンポーネント

**ファイル**: `frontend/src/features/map/MapView.tsx`

**DOM構造**:
```
MapOuter (トップレベルコンテナ)
├── MapRoot (Mapbox GLコンテナ, flex: 1 1 auto)
└── MapCanvas (フォールバック用オーバーレイキャンバス)
```

**Props定義** (lines 73-89):
```typescript
export type MapViewProps = {
    initialView: { longitude: number; latitude: number; zoom: number };
    spots?: Spot[];
    selectedLocation?: Coordinates | null;
    onSelectLocation?: (coords: Coordinates) => void;
    focusCoordinates?: Coordinates | null;
    onSpotClick?: (spotId: string) => void;
    onSpotView?: (spotId: string) => void;
    tileLayer?: MapTileLayer;           // 特定レイヤー強制
    tileCategories?: SpotCategory[];
    tilePremiumOnly?: boolean;
    authToken?: string;
};
```

### レイヤー設定詳細

**ファイル**: `useMapLayerLogic.ts`

**Clusterレイヤー** (lines 219-231):
- 青い円、count(1-200)による半径補間
- 表現式による視覚サイズ計算
- 不透明度: 0.75

**Pulseレイヤー** (lines 249-321):
- カテゴリベースの色分け（live: 赤, event: オレンジ, cafe: 緑, etc.）
- ズームレスポンシブなサイズと不透明度
- ズームによるストローク幅変動

**スタイリング** (`MapView.css`):
```css
.map-callout-layer {
    position: absolute;
    contain: layout size;
    pointer-events: none;
    z-index: 10;
}
```

### コールアウト管理

**ファイル**: `frontend/src/lib/map/SpotCalloutManager.ts`

`SpotCalloutManager` クラス:
- コールアウト用DOM要素プール管理（デフォルト最大64）
- パフォーマンス向上のための要素再利用/リサイクル
- クリックされたスポット上部へのコールアウト配置
- オーナー名、ステータス時間、ライブインジケーター表示

---

## 5. フック・ユーティリティアーキテクチャ

### コアフック一覧

#### useMapInitialization.ts
- グローバルマップインスタンス初期化（`GlobalMapProvider`経由）
- コールアウトレイヤーとマネージャーのセットアップ
- レスポンシブリサイズ用ResizeObserver作成
- 初期タイル座標ロードの管理

#### useMapTileWatcher.ts
- マップ移動・ズームイベントの監視
- `getVisibleTiles()`による可視タイル計算
- `deriveLayerForZoom()`によるレイヤー変更トリガー

#### useInteractiveMap.ts
- コールアウトマネージャーとballoonレイヤー候補の同期
- スポットクリック・クラスタズームインのハンドリング
- キャンバスクリック検出（フォールバックモード）
- 選択マーカーの表示/非表示

#### useMapRenderer.ts

3つの専門フック:
1. **useCanvasRenderer**: DOMバジェット超過時のフォールバックスポット描画
2. **useGeoJsonSource**: GeoJSONソースデータ更新（レンダーモード別フィルタ）
3. **useCanvasContextSetup**: 2Dキャンバスコンテキストの初期化・リサイズ

#### useInteractiveCursor.ts
- インタラクティブレイヤー上でのカーソルをポインターに変更

### ユーティリティクラス

#### TaskScheduler

**ファイル**: `frontend/src/lib/map/TaskScheduler.ts`

`requestIdleCallback`を使用したパフォーマンス重視のタスクバッチング:

```typescript
export type TaskPriority = 'high' | 'normal' | 'low';

export interface Task {
    id: string;
    priority: TaskPriority;
    execute: () => void;
    deadline?: number;
}
```

- 優先度によるタスクソート（high > normal > low）
- 非対応ブラウザ向け`setTimeout`フォールバック
- 16msフレームあたり3タスクバッチ（60fps目標）
- マップインタラクション中のDOM更新に使用

#### PremiumLRUCache

**ファイル**: `frontend/src/lib/map/PremiumLRUCache.ts`

プレミアムスポット用LRUキャッシュ（最大50アイテム）:
- 満杯時の最長未使用アイテム退避
- MRU/LRUクエリ用アクセス順序追跡
- LRU順での全値返却

#### FPSMonitor

**ファイル**: `frontend/src/lib/map/FPSMonitor.ts`

フレームレート監視と劣化トリガー:
- 60フレームサンプリング、60フレームごとにチェック
- 平均/最小/最大FPSメトリクス提供
- 閾値超過時のコールバックトリガー（デフォルト: 30 FPS）

#### time.ts

ISOタイムスタンプ文字列のミリ秒変換:
```typescript
export const parseLocalTimestamp = (value?: string) => {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    // タイムスタンプまたはnullを返却
};
```

---

## 6. グローバルマッププロバイダー

**ファイル**: `frontend/src/features/map/GlobalMapProvider.tsx`

マップインスタンスの**シングルトンパターン**実装:

```typescript
type GlobalMapContextType = {
    map: mapboxgl.Map | null;
    attach: (container: HTMLElement) => void;
    detach: () => void;
    isReady: boolean;
};
```

特徴:
- セッションごとに1つのマップインスタンス作成
- ページ間再利用のための`attach()`/`detach()`メソッド
- `useGlobalMap()`フックによるコンテキストベースアクセス
- Mapboxトークンと渋谷中心座標(139.700571, 35.659108)で初期化

---

## 7. フィーチャーコレクション・フィルタリングロジック

### フィーチャー構築（buildRenderingData）

**DOMバジェット優先順位**:
1. 全クラスタフィーチャーをレンダリング
2. 全プレミアムスポットをレンダリング（制限なし）
3. 残りバジェットで通常スポットを制限

**重複排除**: レンダリング前にIDでフィーチャーを重複排除

**コールアウト候補**: balloonタイプのフィーチャーのみコールアウト対象

### キャンバスフォールバックモード

DOMバジェット超過時:
- クラスタとプレミアムスポットはGeoJSONに残留
- 通常スポットはキャンバス上に円として描画（サイズ4-6px）
- 移動/ズーム/リサイズイベントでキャンバス更新

---

## 8. 使用されている設計パターン

| パターン | 適用箇所 | 説明 |
|----------|----------|------|
| **Providerパターン** | GlobalMapProvider | シングルトンマップインスタンス |
| **Compound Hooks** | useMapRenderer等 | 単一コンポーネント用の複数専門フック（関心の分離） |
| **LRU Cacheパターン** | PremiumLRUCache | プレミアムスポット制限 |
| **Object Poolパターン** | CalloutManager | DOM要素リサイクル |
| **Task Schedulerパターン** | TaskScheduler | パフォーマンス向上のためのDOM更新バッチ処理 |
| **Adaptive Rendering** | MapView | メトリクスに基づくDOMからキャンバスへの劣化 |
| **Ref-based State Sync** | MapView | イベントハンドラ内での安全な使用のためのprops→ref同期 |

---

## 9. パフォーマンス最適化

| 最適化 | 説明 |
|--------|------|
| **RequestIdleCallback** | ブラウザアイドル時間中のタスクスケジューリング |
| **キャンバスフォールバック** | 高データ密度時のDOM削減 |
| **Premium LRUキャッシュ** | プレミアムスポットDOM要素制限 |
| **要素リサイクル** | コールアウトDOM要素の再利用 |
| **FPSモニタリング** | パフォーマンス劣化の自動検出 |
| **デバイス適応型DOMバジェット** | DPRとデバイスタイプに基づく調整 |
| **デバウンスタイルフェッチ** | 座標変更時の150msデバウンス |
| **遅延コールアウト配置** | requestAnimationFrameによる再配置 |

### デバイス別DOMバジェット

| デバイス | バジェット |
|----------|-----------|
| モバイル | 220-260 |
| タブレット | 280 |
| デスクトップ | 300 |

---

## 10. ファイル構成サマリー

| ファイル | 役割 |
|----------|------|
| `MapView.tsx` | メインコンポーネント、状態管理、フックオーケストレーション |
| `GlobalMapProvider.tsx` | シングルトンマップインスタンス、コンテキストプロバイダー |
| `useMapLayerLogic.ts` | レイヤー選択、フィーチャー構築、タイル計算 |
| `useMapInitialization.ts` | マップセットアップ、コールアウトマネージャー作成 |
| `useInteractiveMap.ts` | クリックハンドラー、コールアウト同期 |
| `useMapRenderer.ts` | キャンバス/GeoJSONレンダリング |
| `SpotCalloutManager.ts` | DOMプール、コールアウト配置 |
| `TaskScheduler.ts` | アイドル時タスクバッチング |
| `PremiumLRUCache.ts` | プレミアムスポット制限 |
| `FPSMonitor.ts` | フレームレート監視 |
| `useMapTiles.ts` | キャッシュ付きタイルデータフェッチ |
| `MapView.css` | レイヤー配置とポインターイベント |

---

## 11. データフロー図

```
┌─────────────────────────────────────────────────────────────────┐
│                         MapView.tsx                             │
│  (状態管理: renderMode, activeLayer, tileCoordinates)           │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│ useMapTile    │    │ useMapLayer    │    │ useInteractive │
│ Watcher       │    │ Logic          │    │ Map            │
│ (座標監視)    │    │ (レイヤー決定) │    │ (操作処理)     │
└───────────────┘    └────────────────┘    └────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│ useMapTiles   │    │ buildRendering │    │ SpotCallout    │
│ (データ取得)  │    │ Data()         │    │ Manager        │
└───────────────┘    └────────────────┘    └────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌────────────────┐
                    │ useMapRenderer │
                    │ (描画処理)     │
                    └────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     ┌────────────────┐              ┌────────────────┐
     │ GeoJSON Source │              │ Canvas         │
     │ (DOM描画)      │              │ (フォールバック)|
     └────────────────┘              └────────────────┘
```

---

*分析日: 2025-01-25*
*分析対象: コードベースのみ（要件定義書除外）*
