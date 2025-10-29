# Spots Map UI — Performance-First Spec v0.2

## 0. ゴール（SLO & 予算）
- **初期描画（p75）**: 1.2s 以内で地図・最初のピンを表示（LTE/中端末）。
- **操作応答（パン/ズーム）**: フレーム **45–60fps** を維持。
- **視点変更後の更新**: 200ms 以内に“仮の結果”（プレースホルダ）→ 800ms 以内に確定描画。
- **ネットワーク**: 1視点あたり API 1リクエスト（最大2、並列3以下）。
- **DOM**: 同時アクティブ Marker DOM 要素 **≤ 300**。それ以上はクラスタ/点群に自動切替。

## 1. レイヤー構成（LOD：Level of Detail）
ズーム・密度（件数/画面）で**自動段階切替**。

| ズーム/密度 | レイヤ | 仕様 | 目的 |
|---|---|---|---|
| **広域** (Z ≤ 8 or density>1000) | **Cluster Aggregation** | バブル/グリッドで件数・人気度表示（数値/熱量） | 俯瞰＋最小DOM |
| **中域** (8 < Z ≤ 12, density 200–1000) | **Pulse Pin** | CSS/GLの軽量アニメ。クリックで軽ポップ | 臨場感と軽さの両立 |
| **近距離** (Z > 12, density < 200) | **Callout Balloon** | 吹き出し出現（3sローテのダイナミズム）※プレミアム常時表示 | 発見と訴求 |
| **過密時** (どこでも density > 300) | **Auto-Degrade** | DOMを300上限に抑制。余剰は点/ヒートへ | FPS維持最優先 |

**切替ロジック（擬似コード）**
```ts
const MAX_MARKERS = 300;

function resolveLayer(zoom, density) {
  if (density > 1000 || zoom <= 8) return "cluster";
  if (density > 300) return "autoDegrade"; // 常にDOM制限
  if (zoom <= 12) return "pulse";
  return "balloon";
}
```

## 2. データ取得とキャッシュ（タイル/タイル内集約）
- **APIは bbox ではなく “タイル座標” で取得**（Z/X/Y）。  
  - サーバ側で**タイル内クラスタリング**（件数・代表座標・人気集約）を返す。
- **視点変化は 150ms デバウンス** → 直近のタイルキャッシュを即時描画 → **差分のみ取得**。
- **キャッシュ層**  
  1) **メモリ**（タイル→GeoJSON）、  
  2) **IndexedDB**（最近使ったタイル 100枚）、  
  3) **CDN**（読み取り専用タイルを短時間Cache-Control）。  
- **増分配信**: `since=timestamp` で“同タイルの差分イベント”のみ返す。


## 3. Marker/DOM 戦略（プール & 仮想化）
- **Marker プーリング**: 使い回しで DOM 再生成を削減（表示切替は class 変更のみ）。
- **手前300件**に限り DOM に実体化。残りは **WebGL 点群** or **canvas** レイヤで表現。
- **吹き出し**は**デタッチ可能な軽量テンプレート**（Mapbox Marker + CSS）でアニメ演出。  
  - “3秒ごとのローテ表示”は**Active率 10–20%**を上限に。

**スケジューラ（描画負荷を均し、jank回避）**
```ts
function schedulePaint(tasks) {
  const q = [...tasks]; // 小タスクに分割済み
  function step(deadline: IdleDeadline) {
    while (deadline.timeRemaining() > 3 && q.length) q.shift()!();
    if (q.length) requestIdleCallback(step, {timeout: 50});
  }
  requestIdleCallback(step);
}
```

## 4. アニメーション最適化
- **CSS transform / opacity** のみで表現（layout/paintを避ける）。
- **will-change** は限定的に使用（上限100要素）。
- **RAF 同期**：パン/ズーム中はアニメ**減速/停止**、停止後に再開（電池持ちも改善）。
- **プレミアム常時表示**は**最大50要素**までに制限（優先順位で入替）。

## 5. ネットワーク最適化
- **視点更新中はリクエスト中止**（AbortController）。最後のリクエストだけ有効。
- **HTTP/2 + 圧縮（gzip/br）**、**GeoJSONを Protocol Buffers へ置換**（将来）。
- **画像**: サムネは WebP/AVIF、`srcset` で密度別。  
- **エッジキャッシュ**：人気タイルを CDN で短期キャッシュ。

## 6. 既存仕様との合流点（差分の明文化）
- 既存の**吹き出し/パルス/クラスタの三段設計**は維持しつつ、  
  **タイルAPI + DOM上限 + プーリング + スケジューラ**を追加して“常時60fpsに寄せる”。
- **プレミアム＝常時浮遊**、**通常＝ズームインで吹き出し**、**中域＝パルス**のルールはそのまま。

## 7. 失敗時/低性能端末フォールバック
- **Low-End モード**（自動検知 or ユーザー設定）  
  - WebGL無効 → すべて canvas 点群＋固定ピン。  
  - アニメOFF、出現率 0%、プレミアムのみ簡易ハイライト。
- **オフライン/低速**: タイルキャッシュから表示、最新差分だけ後追い。

## 8. メトリクス & 監視
- **RUM**: 初期描画時間、視点更新→確定描画時間、FPS、ネットワーク失敗率。
- **負荷テスト**: 1, 3, 5, 10 万件のモックデータで FPS/CPU/メモリを CI で計測。
- **アラート**: p75 初期描画 > 1.2s（24h移動平均）、FPS < 40 が5秒以上。

## 9. 実装ルール（React/MapboxGL 前提）
- **React は“外枠”のみ**。ピン/吹き出しは Mapbox Layer/Marker で直接制御（再レンダ禁）。
- **ステートは Store に集約**（視点、タイルキャッシュ、選択ID）。  
- **イベント（hover/click）は委譲**。個別 handler 乱立禁止。
- **Feature Flag** で LOD 切替や Low-End を段階ロールアウト。

## 10. データスキーマ（抜粋）
```ts
type TileResponse = {
  z: number; x: number; y: number; 
  features: Array<{
    id: string;
    type: "cluster"|"pin"|"balloon";
    c?: number;           // cluster count
    p?: number;           // popularity (likes, trust)
    lat: number; lng: number;
    premium?: boolean;
    status?: "upcoming"|"live"|"ended"; // 吹き出し文言に利用
  }>;
  nextSyncAt: number;
}
```

## 11. QA チェックリスト（性能中心）
- [ ] 低性能端末でZ8→Z14のパン/ズームが **45fps以上**  
- [ ] 10,000件密集で **DOM ≤ 300** 維持（クラスタ/点群に自動移行）  
- [ ] 視点変更中のリクエストが **確実に中止**  
- [ ] 初期描画 p75 **≤ 1.2s**（キャッシュヒット時は **≤ 0.6s**）  
- [ ] プレミアム常時表示が **50要素以内** に保たれる  
- [ ] 3秒ローテ演出の Active 率が **20%以内**（過密時は自動0%）

## 12. ローンチ順序（リスク低）
1. **クラスタ/点群 & DOM上限**（すぐにFPSが安定）  
2. **タイルAPI + キャッシュ**（ネットワーク削減）  
3. **プール & スケジューラ**（jank除去）  
4. **演出（ローテ/プレミアム演出）**（負荷を見ながら段階投入）

---
# 🆕 インライン拡大プレビュー（Tap-to-Grow）UI 仕様追加

## 概要
スポットをタップした際、モーダルではなくその場で吹き出しが「一回り大きくなる」軽量なプレビューUIを採用。  
地図上の探索体験を中断せず、軽快な操作でスポットを比較できる。

## 状態遷移
```
[通常表示] --(タップ)--> [拡大表示]
[拡大表示] --(他をタップ/地図操作)--> [通常表示]
```
- 常に1スポットのみ拡大可能。
- 地図操作（パン/ズーム）または他のスポットタップで解除。

## 見た目
| 状態 | サイズ | 表示情報 |
|------|--------|-----------|
| 通常 | 標準サイズ（24pxピン） | タイトル・カテゴリ色のみ |
| 拡大 | 約1.18倍に拡大 | 開始時刻、距離、評価、詳細ボタンなど2行以内で表示 |

- 拡大時は影とスケールを強調し前景感を出す。
- 重なり時はFocused状態のみZ-indexを前面に。

## アニメーション
- プロパティ：`transform: scale()` と `opacity`
- 時間：120ms、イージング：`cubic-bezier(0.2, 0.9, 0.2, 1)`
- パン・ズーム中は一時停止し、操作終了後も復帰しない（探索優先）

## 実装メモ（React + Mapbox）
```tsx
const [focusedId, setFocusedId] = useState<string | null>(null);

function onSpotTap(id: string) {
  setFocusedId(prev => prev === id ? null : id);
}

map.on('dragstart zoomstart', () => setFocusedId(null));
```
CSS:
```css
.spot { transition: transform 120ms ease, box-shadow 120ms ease; }
.spot--focused { transform: scale(1.18); box-shadow: 0 6px 16px rgba(0,0,0,.18); z-index: 3; }
```

## UX設計意図
- モーダルを開かずに「気軽に覗ける」体験を実現。  
- 他の部分をタップ/パンすると即座に閉じ、探索リズムを妨げない。  
- スマホでも軽快に動作し、FPSを維持（45以上を目標）。

## パフォーマンス条件
- 描画上限：300スポット（既存仕様に準拠）
- Focus切替応答：<50ms
- 地図操作時の解除遅延：0.2s以内

---
