# Map Tile API Design (Spots)

最終更新: 2025-10-30

## 目的
Map UI Performance Spec v0.2/v0.3 で要求されるタイルベースのデータ配信・LOD 切替・差分配信・ドメイン上限 300 の制御を実現するためのバックエンド設計を定義する。既存の `/api/spots` はクライアント側フィルタに依存しており、地図パン/ズーム時の応答性と帯域が課題となっている。本設計では以下を満たす。

- `z/x/y` タイル単位でスポット集合を配信し、ズーム・密度に応じてクラスタ/ピン/吹き出しを出し分ける。
- 視点更新時は 150ms デバウンスで最新のタイルのみを取得し、中断されたリクエストは Abort により破棄する。
- DOM 表示上限 300 件を維持するため、タイルレスポンスに `domBudget` メタデータを含め、クライアントが余剰を WebGL/canvas にフォールバックできるようにする。
- 差分配信 (`since` パラメータ) により同じタイルの更新を効率化し、IndexedDB キャッシュ/Cloud CDN と併用して帯域を最適化する。

## エンドポイント概要
```
GET /api/map/tiles/:z/:x/:y
```

### 必須パラメータ
| 名前 | 型 | 説明 |
| --- | --- | --- |
| `:z` | number | ズームレベル (5–18 の整数)。 |
| `:x` | number | Web Mercator tile X。 |
| `:y` | number | Web Mercator tile Y。 |

### クエリパラメータ
| 名前 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `layer` | `cluster` \| `pulse` \| `balloon` | 任意 | LOD 指定。省略時はタイル内の密度から自動判定。 |
| `since` | unix ms timestamp | 任意 | 差分取得の基準時刻。`nextSyncAt` より古い場合はフルレスポンス。 |
| `categories` | comma string | 任意 | カテゴリフィルタ。Frontend のアクティブカテゴリと同期。 |
| `viewerId` | string | 任意 | オーセンティケーション済み UID。Firebase Auth を経由し、一部メタデータ (like/favorite 状態) を付与。 |
| `premiumOnly` | boolean | 任意 | プレミアムスポットのみに絞る。Promotion ビュー等で使用。 |

### レスポンススキーマ
```ts
type TileResponse = {
  z: number;
  x: number;
  y: number;
  generatedAt: number;      // ms timestamp
  nextSyncAt: number;       // 差分取得の推奨しきい値 (ms)
  domBudget: number;        // 推奨 DOM ピン数 (標準 300 / タイル密度に応じて配分)
  features: Array<{
    id: string;             // cluster -> artificial id / spot -> Firestore id
    type: "cluster" | "pin" | "balloon";
    geometry: {
      lat: number;
      lng: number;
    };
    count?: number;         // cluster 用: 子要素数
    popularity?: number;    // likes/comments/trust_score 合成スコア
    premium?: boolean;      // プレミアム枠フラグ
    status?: "upcoming" | "live" | "ended";
    spot?: {
      title: string;
      category: SpotCategory;
      startTime: string;
      endTime: string;
      ownerPhoneVerified: boolean;
      promotion?: {
        id: string;
        priority: number;
      };
    };
  }>;
  diffs?: Array<{
    id: string;
    op: "upsert" | "delete";
    feature?: TileResponse["features"][number];
  }>;                        // since パラメータが有効な場合に差分のみ返却
};
```

- `features` はフルレスポンス時のみ含め、差分レスポンス時は `diffs` を返却する。クライアントは `generatedAt` を `since` に指定し直す。
- `status` は開始・終了時刻と現在時刻から算出し、吹き出しメッセージに利用。

## クラスタリング戦略
- `supercluster` (GeoJSON) を Node.js で使用し、クラスタと単体ピンを生成する。
- タイルロード毎に `supercluster` インスタンスを再構築するとコストが高いため、Firestore から取得した範囲内スポットを LRU キャッシュ (メモリ) に保持し、同一ズームでの連続アクセスを amortize する。
- `clusterRadius` はズームごとに最適化 (例: z=8: 80px, z=14: 40px)。
- Premium スポットはクラスタ内でも `premium` を引き継ぎ、クライアントが常時表示を判断できるようにする。

## Firestore データ取得
1. タイル境界を Web Mercator → 緯度経度に変換し、`spots` コレクションを `lat` / `lng` の範囲でクエリ。必要に応じて geohash ライブラリを利用し、最小限のドキュメントを取得。
2. `promotions` / `leaderboards/popular_spots` を参照して `popularity` や `promotion` メタを付加。
3. `viewerId` が存在する場合は `likes` コレクション、`favorite_spot_ids` などを参照して `spot` 部分に `likedByViewer` などを追加（ただし TileResponse では最小限に留める）。

### インデックス要件
- `spots` に `lat` / `lng` の複合インデックス (range) を追加。例: `lat` asc, `lng` asc。
- `scheduled_spots` / `promotions` は既存インデックスを流用。`promotion.active == true` のフィルタが必要な場合は複合インデックスを追加。
- `likes` は `user_id` で 500 件まで取得する現行方式を継続。

## キャッシュと有効期限
- Functions 層では 60 秒の in-memory キャッシュ (LRU, 最大 100 タイル) を持ち、`since` と整合するように `generatedAt` を保持。
- CDN (Firebase Hosting + Cloud CDN) を利用する場合は `Cache-Control: public, max-age=30, stale-while-revalidate=120` を推奨。ただし `viewerId` ありのリクエストは `private`。
- クライアント側は `TileCache` interface を設け、メモリ + IndexedDB で最大 100 タイル保存。`nextSyncAt` を過ぎたら差分取得を試み、失敗した場合はフル取得。

## エラーハンドリング
- out-of-range パラメータ (z <5 or z>20 等) は 400。
- 差分取得で `generatedAt` が古すぎる場合は 205 Reset Content を返却し、クライアントがフル取得する。
- Firestore quota 超過を検知した場合は 503 を返し、クライアントは指数バックオフ。

## セキュリティ
- 認証不要のリクエストは公開スポットのみ返却。`viewerId` を伴う場合は Firebase Auth 署名を `Authorization: Bearer` で検証。
- 管理者専用の非公開ポリゴン等は別エンドポイントに切り出す。

## 今後の拡張
- `tileMeta` としてイベント件数ヒートマップ用の統計 (件数、平均 trust_score 等) を返却する余地を残す。
- `since` 差分における TTL を 5 分とし、長時間接続時は WebSocket/SSE による push 配信も検討。
- Premium スポットの優先表示ロジックをサーバ側で制御し、常時表示数を 50 以下に制限。

## 開発タスク (Backend)
1. `TileId` ユーティリティと Web Mercator 変換関数を backend パッケージに追加。
2. Firestore 範囲クエリ + `supercluster` 統合を実装 (`mapTileService.ts` 仮称)。
3. Express ルーターに `/api/map/tiles/:z/:x/:y` を追加し、Zod 等でバリデーション。
4. Vitest: 低密度/高密度/差分のテストケース、DOM 上限配分のテストを作成。
5. Functions export に `mapTiles` HTTPS 関数を追加し、デプロイ設定を更新。

## モニタリング
- Cloud Logging で `tileId`, `duration`, `docReadCount`, `cacheHit` を計測。
- Sentry に `map_tile_fetch_failed` を送信し、RUM と照合。
- BigQuery Export を有効化し、ヒートマップでホットなタイルを可視化。

## フロントエンド統合メモ
- `frontend/src/hooks/useMapTiles.ts` が可視範囲タイルセットのフェッチと統合を担当。150ms デバウンス＋Abort 制御、並列取得に対応。
- `fetchMapTile` が差分 (`diffs`) を適用してキャッシュを更新しつつ `console.debug("mapTileFetch")` で fetch 時間とキャッシュヒット状態をログ。
- `frontend/src/lib/mapTileCache.ts` でメモリ + IndexedDB キャッシュを提供。`mapTileCache.clear()` をブラウザコンソールから呼べばクライアントキャッシュをリセット可能。
- `MapView` はビューポート周辺のタイルをまとめて取得し、クラスタ/パルス/バルーンの LOD レイヤーを自動切替。クライアント側でも DOM 上限 (300) を守るためにスライス処理・段階的デグレードを行う。
- DOM 300 を超えた場合は自動的に canvas フォールバックへ切り替え、クラスター/プレミアムのみ Mapbox レイヤに残し、通常スポットは canvas で描画して FPS を維持。
- カテゴリフィルタは `tileCategories` プロップに `SpotCategory[]` を渡すことで適用。複数カテゴリ指定時はカンマ連結されて送信される。
- ローカル検証: `npm run dev --workspace frontend` → マップ表示でパン/ズームし、Chrome DevTools の Network タブで `/api/map/tiles/...` を確認。IndexedDB の `spots-map-tiles/tiles` にキャッシュが保存される。
