import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { firestore } from "./firebaseAdmin.js";

const COLLECTION = "spot_reports";

export type SpotReportStatus = "open" | "resolved";

export type SpotReportRecord = {
  id: string;
  spotId: string;
  reason: string;
  details: string | null;
  status: SpotReportStatus;
  reporterUid: string | null;
  createdAt: string;
  resolvedAt?: string;
};

export const createSpotReport = async ({
  spotId,
  reporterUid,
  reason,
  details
}: {
  spotId: string;
  reporterUid: string | null;
  reason: string;
  details: string | null;
}) => {
  await firestore.collection(COLLECTION).add({
    spot_id: spotId,
    reporter_uid: reporterUid,
    reason,
    details,
    status: "open",
    created_at: Timestamp.now()
  });
};

export const fetchSpotReports = async ({ status, limit }: { status?: SpotReportStatus; limit?: number }) => {
  let query = firestore.collection(COLLECTION).orderBy("created_at", "desc").limit(Math.max(1, Math.min(limit ?? 50, 100)));
  if (status) {
    query = query.where("status", "==", status);
  }
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() as {
      spot_id: string;
      reason: string;
      details?: string | null;
      status: SpotReportStatus;
      reporter_uid?: string | null;
      created_at: Timestamp;
      resolved_at?: Timestamp;
    };
    return {
      id: doc.id,
      spotId: data.spot_id,
      reason: data.reason,
      details: data.details ?? null,
      status: data.status,
      reporterUid: data.reporter_uid ?? null,
      createdAt: data.created_at.toDate().toISOString(),
      resolvedAt: data.resolved_at ? data.resolved_at.toDate().toISOString() : undefined
    } satisfies SpotReportRecord;
  });
};

export const updateSpotReportStatus = async (
  reportId: string,
  status: SpotReportStatus,
  resolverUid?: string | null
) => {
  const ref = firestore.collection(COLLECTION).doc(reportId);
  const updates: Record<string, unknown> = {
    status
  };
  if (status === "resolved") {
    updates.resolved_at = Timestamp.now();
    updates.resolved_by = resolverUid ?? null;
  } else {
    updates.resolved_at = FieldValue.delete();
    updates.resolved_by = resolverUid ?? null;
  }
  await ref.update(updates);
};
