# Spots Map UI — Performance & Cost Spec v0.4 (Finalized)

## 0. 方針 (Strategy)
v0.4では **「運用コスト削減 (Global Map)」** と **「レンダリングパフォーマンスの最大化 (TaskScheduler)」** の2点に集中し、UX拡張 (Tap-to-Grow) や高度なキャッシュ (IndexedDB) は将来の実装とする。

---

## 1. 現状の課題と対策 (Gap Analysis)

### A. コスト: Mapbox API Call の無駄
ユーザーがタブを切り替えるたびに `MapView` がアンマウントされ、再マウント時に `new MapboxMap()` が走るため、**Map Load料金 (Session Start)** が無駄に課金される。

**対策:**
- **Mapインスタンスの永続化 (Keep-Alive)**:
    - 画面遷移しても `MapView` (DOM + Mapインスタンス) を破棄せず、`display: none` で隠すだけに留める（Global Map Context）。

### B. パフォーマンス: 大量DOM更新のブロッキング
`SpotCalloutManager.sync` が同期的に大量のDOM操作を行うため、マーカー密集時にフレーム落ち（Jank）が発生する。

**対策:**
- **TaskSchedulerの完全適用**:
    - DOM更新を1フレームあたり少量ずつ行うバッチ処理に変更。メインスレッドをブロックしない。

### C. メンテナンス性: MapViewの肥大化
`MapView.tsx` が1300行を超え、機能追加が困難。

**対策:**
- **Hooks分離 (Refactoring)**:
    - レイヤーロジック、イベントハンドラ、レンダラーを分離。

---

## 2. 実装計画 (Implementation Plan)

### Step 1: TaskScheduler の適用 (Speed)
`SpotCalloutManager` に `TaskScheduler` を注入し、`sync` メソッドを非同期バッチ化する。
- 削除は即時実行。
- 新規作成・更新は `scheduler.schedule()` で分散実行。

### Step 2: グローバルマップインスタンス化 (Cost)
`GlobalMapProvider` を導入し、ページ遷移でMapインスタンスを破棄しない設計にする。
- ContextでMapインスタンスとContainer (`div`) を保持。
- 各ページのマウント時に、ContainerをDOMツリー上の適切な場所に `appendChild` で移動させる（Portal的な挙動）。

### Step 3: MapView リファクタリング (Maintainability)
`MapView.tsx` を以下のHooksに分割する。
- `useMapLayerLogic.ts`: LOD計算。
- `useInteractiveMap.ts`: クリック・ホバー系イベント。
- `useMapRenderer.ts`: Canvas等の描画系。

---

## 3. 技術仕様 (Technical Spec)

### SpotCalloutManager with Scheduler
```typescript
class SpotCalloutManager {
  constructor(..., private scheduler: TaskScheduler) {}

  sync(features: MapTileFeature[]) {
    // 1. Identify removals (Immediate)
    const activeIds = new Set(features.map(f => f.id));
    this.entries.forEach((entry, id) => {
      if (!activeIds.has(id)) this.remove(id);
    });

    // 2. Schedule updates (Batched)
    const center = this.map.getCenter();
    features.forEach(feature => {
       const priority = isNearCenter(feature, center) ? 'high' : 'normal';
       this.scheduler.schedule({
         id: `marker-${feature.id}`,
         priority,
         execute: () => this.updateOrCreate(feature)
       });
    });
  }
}
```

### GlobalMapArchitecture
```tsx
// GlobalMapProvider.tsx
export const GlobalMapProvider = ({ children }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);

  // 初回マウント時のみ Mapbox インスタンス生成
  useEffect(() => {
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new mapboxgl.Map({ ... });
    }
  }, []);

  const attach = (parent: HTMLElement) => {
    parent.appendChild(mapContainerRef.current);
    mapInstanceRef.current?.resize();
  };

  return <Context.Provider value={{ attach }}>{children}</Context.Provider>;
};
```

---

## 4. 将来の実装予定 (Future Roadmap)

### Tap-to-Grow (インライン拡大)
- 探索体験を阻害しない、軽量な詳細プレビューUI。
- モーダル遷移なしで、ピンをタップするとその場で拡大・詳細表示。

### 高度なキャッシュ戦略
- **IndexedDB**: タイルデータの大規模永続キャッシュ。

### その他
- **Vector Tile の完全自前配信**: Mapbox APIへの依存度をさらに下げ、自社サーバーからProtobuf形式でタイル配信。
- **3D建物表示**: Mapbox Standard Style を活用したリッチな表現。
