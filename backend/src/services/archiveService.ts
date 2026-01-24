import { Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { firestore } from "./firebaseAdmin.js";
import { notifySystemAlert } from "./notificationService.js";
import { COLLECTIONS } from "../constants/collections.js";
import { MS } from "../constants/time.js";

const SPOTS_COLLECTION = COLLECTIONS.SPOTS;
const ARCHIVED_SPOTS_COLLECTION = COLLECTIONS.ARCHIVED_SPOTS;

// アーカイブ時の保存データ型（最小限）
type ArchivedSpotDocument = {
    original_id: string;
    title: string;
    start_time: Timestamp;
    end_time: Timestamp;
    owner_id: string;
    image_url?: string | null;
    archived_at: Timestamp;
};

/**
 * 終了時刻を過ぎたスポットをアーカイブへ移動する
 */
export const archivePastSpots = async () => {
    const now = Timestamp.now();

    try {
        // 終了時刻を過ぎたスポットを取得
        const snapshot = await firestore
            .collection(SPOTS_COLLECTION)
            .where("end_time", "<=", now)
            .limit(100) // 1回の実行での処理上限
            .get();

        if (snapshot.empty) {
            return;
        }

        const batch = firestore.batch();
        let count = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // アーカイブドキュメントの作成
            const archivedRef = firestore.collection(ARCHIVED_SPOTS_COLLECTION).doc(doc.id);
            const archivedData: ArchivedSpotDocument = {
                original_id: doc.id,
                title: data.title,
                start_time: data.start_time,
                end_time: data.end_time,
                owner_id: data.owner_id,
                image_url: data.image_url ?? null,
                archived_at: now
            };

            batch.set(archivedRef, archivedData);

            // 元のスポットを削除
            batch.delete(doc.ref);
            count++;
        }

        await batch.commit();

        // システム通知（大量削除時のみなどの制御も可だが、一旦ログとして通知）
        if (count > 0) {
            console.log(`Archived ${count} spots.`);
        }

    } catch (error) {
        console.error("Error archiving spots:", error);
        await notifySystemAlert("アーカイブ処理でエラーが発生しました", { error: error instanceof Error ? error.message : "Unknown error" });
        throw error;
    }
};

/**
 * 終了から24時間経過したアーカイブの画像を削除する
 */
export const cleanupExpiredImages = async () => {
    // 現在時刻から24時間前
    const cleanupThreshold = new Date(Date.now() - MS.DAY);
    const thresholdTimestamp = Timestamp.fromDate(cleanupThreshold);

    try {
        // 終了時刻が24時間前より古く、かつ画像URLを持っているアーカイブを取得
        const snapshot = await firestore
            .collection(ARCHIVED_SPOTS_COLLECTION)
            .where("end_time", "<=", thresholdTimestamp)
            .where("image_url", "!=", null) // 画像があるものだけ
            .limit(50)
            .get();

        if (snapshot.empty) {
            return;
        }

        const bucket = getStorage().bucket();
        const batch = firestore.batch();
        let deletedCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data() as ArchivedSpotDocument;
            const imageUrl = data.image_url;

            if (imageUrl) {
                try {
                    // 画像URLからファイルパスを抽出する簡易ロジック
                    // Firebase Storage URL形式: https://firebasestorage.googleapis.com/v0/b/[bucket]/o/[path]?token=...
                    // または gs:// 形式など。ここでは標準的なURLを想定してパスを解析

                    let filePath = "";
                    if (imageUrl.includes("/o/")) {
                        // URLデコードしてパス部分を取得
                        const pathSegment = imageUrl.split("/o/")[1].split("?")[0];
                        filePath = decodeURIComponent(pathSegment);
                    }

                    if (filePath) {
                        const file = bucket.file(filePath);
                        const [exists] = await file.exists();
                        if (exists) {
                            await file.delete();
                        }
                    }

                    // DB上の画像URL情報を削除（またはnull更新）して、再処理されないようにする
                    batch.update(doc.ref, { image_url: null });
                    deletedCount++;

                } catch (err) {
                    console.error(`Failed to delete image for spot ${doc.id}:`, err);
                    // 画像削除に失敗しても、とりあえずログだけ出して続行（DB更新はしない＝リトライ対象になる）
                    // 永続的に失敗する場合は別途対応が必要だが、一旦スキップ
                }
            }
        }

        if (deletedCount > 0) {
            await batch.commit();
            console.log(`Cleaned up images for ${deletedCount} archived spots.`);
        }

    } catch (error) {
        console.error("Error cleaning up images:", error);
        await notifySystemAlert("画像削除処理でエラーが発生しました", { error: error instanceof Error ? error.message : "Unknown error" });
        throw error;
    }
};

export type ArchivedSpotResponse = {
    id: string;
    originalId: string;
    title: string;
    startTime: string;
    endTime: string;
    archivedAt: string;
};

/**
 * ユーザーのアーカイブ済みスポットを取得する
 */
export const fetchArchivedSpots = async (ownerId: string): Promise<ArchivedSpotResponse[]> => {
    const snapshot = await firestore
        .collection(ARCHIVED_SPOTS_COLLECTION)
        .where("owner_id", "==", ownerId)
        .orderBy("archived_at", "desc")
        .limit(50)
        .get();

    return snapshot.docs.map(doc => {
        const data = doc.data() as ArchivedSpotDocument;
        return {
            id: doc.id,
            originalId: data.original_id,
            title: data.title,
            startTime: data.start_time.toDate().toISOString(),
            endTime: data.end_time.toDate().toISOString(),
            archivedAt: data.archived_at.toDate().toISOString()
        };
    });
};
