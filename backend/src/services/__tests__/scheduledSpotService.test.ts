import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reviewScheduledSpot } from "../scheduledSpotService.js";

const firestoreMocks = {
  collection: vi.fn()
};

vi.mock("../../services/firebaseAdmin.js", () => ({
  firestore: {
    collection: (...args: Parameters<typeof firestoreMocks.collection>) =>
      firestoreMocks.collection(...args)
  }
}));

const updateMock = vi.fn();
const docGetMock = vi.fn();
const promotionSetMock = vi.fn();
const reviewAddMock = vi.fn();
const notificationsAddMock = vi.fn();

const scheduledCollection = {
  doc: vi.fn()
};

const promotionsCollection = {
  doc: vi.fn()
};

const reviewCollection = {
  add: reviewAddMock
};

const notificationsCollection = {
  add: notificationsAddMock
};

describe("reviewScheduledSpot", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    scheduledCollection.doc.mockImplementation(() => ({
      get: docGetMock,
      update: updateMock
    }));

    promotionsCollection.doc.mockImplementation(() => ({
      set: promotionSetMock
    }));

    firestoreMocks.collection.mockImplementation((name: string) => {
      switch (name) {
        case "scheduled_spots":
          return scheduledCollection;
        case "promotions":
          return promotionsCollection;
        case "scheduled_spot_review_logs":
          return reviewCollection;
        case "notifications":
          return notificationsCollection;
        default:
          throw new Error(`Unhandled collection: ${name}`);
      }
    });

    docGetMock.mockResolvedValue({
      exists: true,
      data: () => ({
        title: "テストイベント",
        description: "詳細",
        category: "event",
        lat: 35.0,
        lng: 139.0,
        start_time: Timestamp.fromDate(new Date()),
        end_time: Timestamp.fromDate(new Date()),
        publish_at: Timestamp.fromDate(new Date()),
        owner_id: "owner-uid",
        announcement_type: "short_term_notice",
        status: "pending",
        created_at: Timestamp.fromDate(new Date())
      })
    });
  });

  it("approves a scheduled spot and notifies owner", async () => {
    await reviewScheduledSpot(
      "spot-1",
      {
        status: "approved",
        reviewNotes: "承認済み",
        promotion: {
          headline: "ライブ開催",
          priority: 1
        }
      },
      {
        uid: "admin-uid",
        email: "admin@example.com"
      }
    );

    expect(updateMock).toHaveBeenCalledWith({
      status: "approved",
      review_notes: "承認済み"
    });
    expect(promotionSetMock).toHaveBeenCalledTimes(1);
    expect(reviewAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        spot_id: "spot-1",
        next_status: "approved",
        review_template_id: null
      })
    );
    expect(notificationsAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "owner-uid",
        priority: "standard",
        metadata: expect.objectContaining({ reviewTemplateId: null })
      })
    );
  });

  it("rejects a scheduled spot and marks notification high priority", async () => {
    await reviewScheduledSpot(
      "spot-2",
      {
        status: "rejected",
        reviewNotes: "騒音懸念",
        templateId: "policy-violation"
      },
      {
        uid: "admin-uid",
        email: "admin@example.com"
      }
    );

    expect(promotionSetMock).not.toHaveBeenCalled();
    expect(reviewAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        spot_id: "spot-2",
        next_status: "rejected",
        review_notes: "騒音懸念",
        review_template_id: "policy-violation"
      })
    );
    expect(notificationsAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "owner-uid",
        priority: "high",
        metadata: expect.objectContaining({ reviewTemplateId: "policy-violation" })
      })
    );
  });
});
