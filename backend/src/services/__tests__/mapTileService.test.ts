import * as tilebelt from "@mapbox/tilebelt";
import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearMapTileCache, getMapTile } from "../mapTileService.js";

const firestoreMocks = {
  collection: vi.fn(),
  getAll: vi.fn()
};

vi.mock("../../services/firebaseAdmin.js", () => ({
  firestore: {
    collection: (...args: Parameters<typeof firestoreMocks.collection>) => firestoreMocks.collection(...args),
    getAll: (...args: Parameters<typeof firestoreMocks.getAll>) => firestoreMocks.getAll(...args)
  }
}));

const spotsCollection = {
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  get: vi.fn()
};

const usersCollection = {
  doc: vi.fn()
};

const ownerSnapshots = new Map<string, { phone_verified?: boolean }>();

const createSpotSnapshot = (
  id: string,
  overrides: {
    lat: number;
    lng: number;
    category?: string;
    ownerId?: string;
    likes?: number;
    commentsCount?: number;
    premium?: boolean;
    startOffsetMinutes?: number;
  }
) => {
  const now = Date.now();
  const start = new Date(now + (overrides.startOffsetMinutes ?? 15) * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    id,
    data: () => ({
      title: `${id}-title`,
      category: overrides.category ?? "event",
      lat: overrides.lat,
      lng: overrides.lng,
      start_time: Timestamp.fromDate(start),
      end_time: Timestamp.fromDate(end),
      owner_id: overrides.ownerId ?? "owner-default",
      likes: overrides.likes ?? 0,
      comments_count: overrides.commentsCount ?? 0,
      premium: overrides.premium ?? false
    })
  } satisfies DocumentSnapshot<FirebaseFirestore.DocumentData>;
};

const SHIBUYA_LAT = 35.6595;
const SHIBUYA_LNG = 139.7016;
const ZOOM = 15;
const [TILE_X, TILE_Y] = tilebelt.pointToTile(SHIBUYA_LNG, SHIBUYA_LAT, ZOOM);

let spotDocs: Array<DocumentSnapshot<FirebaseFirestore.DocumentData>> = [];

describe("getMapTile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMapTileCache();

    ownerSnapshots.clear();
    ownerSnapshots.set("owner-1", { phone_verified: true });
    ownerSnapshots.set("owner-2", { phone_verified: false });

    spotDocs = [
      createSpotSnapshot("spot-1", {
        lat: SHIBUYA_LAT,
        lng: SHIBUYA_LNG,
        ownerId: "owner-1",
        likes: 42,
        commentsCount: 5,
        premium: true
      }),
      createSpotSnapshot("spot-2", {
        lat: SHIBUYA_LAT + 0.0002,
        lng: SHIBUYA_LNG + 0.0002,
        ownerId: "owner-2",
        likes: 8,
        commentsCount: 1
      })
    ];

    spotsCollection.where.mockReturnValue(spotsCollection);
    spotsCollection.orderBy.mockReturnValue(spotsCollection);
    spotsCollection.limit.mockReturnValue(spotsCollection);
    spotsCollection.get.mockImplementation(async () => ({ docs: spotDocs }));

    usersCollection.doc.mockImplementation((id: string) => ({ id }));

    firestoreMocks.collection.mockImplementation((name: string) => {
      switch (name) {
        case "spots":
          return spotsCollection;
        case "users":
          return usersCollection;
        default:
          throw new Error(`Unhandled collection: ${name}`);
      }
    });

    firestoreMocks.getAll.mockImplementation(async (...docRefs: Array<{ id: string }>) => {
      return docRefs.map((ref) => ({
        id: ref.id,
        exists: true,
        data: () => ownerSnapshots.get(ref.id) ?? {}
      }));
    });
  });

  it("returns tile features with metadata", async () => {
    const response = await getMapTile(ZOOM, TILE_X, TILE_Y, {});

    expect(response.features).toHaveLength(spotDocs.length);
    const firstFeature = response.features.find((feature) => feature.id === "spot-1");
    expect(firstFeature).toBeDefined();
    expect(firstFeature).toMatchObject({
      type: "balloon",
      premium: true,
      popularity: 42,
      spot: expect.objectContaining({
        ownerId: "owner-1",
        ownerPhoneVerified: true
      })
    });
  });

  it("filters premium-only tiles", async () => {
    const response = await getMapTile(ZOOM, TILE_X, TILE_Y, { premiumOnly: true });
    expect(response.features).toHaveLength(1);
    expect(response.features[0]?.id).toBe("spot-1");
  });

  it("serves cached tile when since is recent", async () => {
    const initial = await getMapTile(ZOOM, TILE_X, TILE_Y, {});
    expect(initial.features).toHaveLength(2);

    spotsCollection.get.mockImplementation(async () => {
      throw new Error("Firetore should not be queried when cache is valid");
    });

    const cached = await getMapTile(ZOOM, TILE_X, TILE_Y, { since: initial.generatedAt });
    expect(cached.features).toHaveLength(2);
  });
});
