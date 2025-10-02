import "dotenv/config";

import { resetPromotionQuotas } from "../services/quotaService.js";

const run = async () => {
  const results = await resetPromotionQuotas(new Date(), {
    dryRun: true,
    logger: (entry) => {
      console.log(
        `${entry.uid}: tier=${entry.tier} current=${JSON.stringify(entry.previousQuota ?? {})} -> next=${JSON.stringify(entry.nextQuota)}`
      );
    }
  });

  console.log(`\n対象ユーザー: ${results.length} 件`);
};

run().catch((error) => {
  console.error("Failed to preview quota reset", error);
  process.exit(1);
});
