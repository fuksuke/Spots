import { randomUUID } from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";

import { firestore } from "../services/firebaseAdmin.js";

const ownerUid = process.env.SEED_OWNER_UID ?? "demo-owner";
const adminUid = process.env.SEED_ADMIN_UID ?? "demo-admin";
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";

const HOURS = 60 * 60 * 1000;
const addHours = (hours: number) => new Date(Date.now() + hours * HOURS);

const scheduledSpotFixtures = [
  {
    title: "【審査待ち】渋谷ライトアップ",
    description: "渋谷駅前で行われるライトアップイベント。",
    category: "event",
    lat: 35.6595,
    lng: 139.7005,
    startTime: addHours(8),
    endTime: addHours(10),
    publishAt: addHours(4),
    announcementType: "short_term_notice",
    status: "pending",
    reviewNotes: null
  },
  {
    title: "【承認済み】ストリートライブ",
    description: "井の頭通り沿いでのアコースティックライブ。",
    category: "live",
    lat: 35.661,
    lng: 139.704,
    startTime: addHours(20),
    endTime: addHours(22),
    publishAt: addHours(12),
    announcementType: "short_term_notice",
    status: "approved",
    reviewNotes: "運営ガイドラインに基づき許可済み"
  },
  {
    title: "【却下】深夜フードフェス",
    description: "深夜2時からのフードフェスティバル。騒音懸念あり。",
    category: "gourmet",
    lat: 35.657,
    lng: 139.702,
    startTime: addHours(30),
    endTime: addHours(34),
    publishAt: addHours(24),
    announcementType: "long_term_campaign",
    status: "rejected",
    reviewNotes: "近隣住民からの苦情が予想されるため却下"
  }
] as const;

const createScheduledSpotDoc = async () => {
  console.log("Seeding scheduled_spots fixtures...");

  await Promise.all(
    scheduledSpotFixtures.map(async (fixture) => {
      const docId = randomUUID();
      await firestore.collection("scheduled_spots").doc(docId).set({
        title: fixture.title,
        description: fixture.description,
        category: fixture.category,
        lat: fixture.lat,
        lng: fixture.lng,
        start_time: Timestamp.fromDate(fixture.startTime),
        end_time: Timestamp.fromDate(fixture.endTime),
        publish_at: Timestamp.fromDate(fixture.publishAt),
        owner_id: ownerUid,
        announcement_type: fixture.announcementType,
        status: fixture.status,
        created_at: Timestamp.now(),
        image_url: null,
        review_notes: fixture.status === "rejected" ? fixture.reviewNotes : null
      });

      if (fixture.status !== "pending") {
        await firestore.collection("scheduled_spot_review_logs").add({
          spot_id: docId,
          actor_uid: adminUid,
          actor_email: adminEmail,
          previous_status: "pending",
          next_status: fixture.status,
          review_notes: fixture.reviewNotes ?? null,
          created_at: Timestamp.fromDate(new Date())
        });

        if (fixture.status === "approved" || fixture.status === "rejected") {
          await firestore.collection("notifications").add({
            user_id: ownerUid,
            title: fixture.status === "approved" ? "予約告知が承認されました" : "予約告知が却下されました",
            body:
              fixture.status === "approved"
                ? `${fixture.title} の予約告知が承認されました。公開予定: ${fixture.publishAt.toLocaleString("ja-JP")}`
                : `${fixture.title} の予約告知は却下されました。理由: ${fixture.reviewNotes}`,
            category: "moderation",
            metadata: {
              spotId: docId,
              status: fixture.status,
              previousStatus: "pending"
            },
            read: false,
            created_at: Timestamp.now(),
            priority: fixture.status === "rejected" ? "high" : "standard"
          });
        }
      }

      console.log(`  - ${fixture.title} (${fixture.status})`);
    })
  );
};

const seed = async () => {
  await createScheduledSpotDoc();
  console.log("Seed data created. ownerUid=%s adminUid=%s", ownerUid, adminUid);
};

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed moderation fixtures", error);
    process.exit(1);
  });
