import "dotenv/config";

export * from "./services/spotReportService.js";
export * from "./services/archiveService.js";
export * from "./services/analyticsService.js";

import { createApp } from "./app.js";

const app = createApp();
const port = process.env.PORT ?? 4000;

app.listen(port, () => {
  console.log(`Shibuya LiveMap API listening on port ${port}`);
});
