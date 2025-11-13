import { rebuildPopularSpotsLeaderboard } from "../services/firestoreService.js";
import { publishDueScheduledSpots, expirePromotions } from "../services/scheduledSpotService.js";

const run = async () => {
  console.info("[maintenance] Starting maintenance tasks");

  const publishResult = await publishDueScheduledSpots();
  console.info(
    `[maintenance] Published ${publishResult.publishedSpotIds.length} scheduled spots, activated ${publishResult.activatedPromotionIds.length} promotions`
  );

  await expirePromotions();
  console.info("[maintenance] Expired promotions cleanup completed");

  const leaderboard = await rebuildPopularSpotsLeaderboard();
  console.info(`[maintenance] Rebuilt popular spots leaderboard with ${leaderboard.length} entries`);

  console.info("[maintenance] All tasks finished");
};

run().catch((error) => {
  console.error("[maintenance] Failed", error);
  process.exitCode = 1;
});
