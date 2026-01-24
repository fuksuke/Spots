import { Router } from "express";

import { getMapTileHandler, getMapTilesBatchHandler } from "../controllers/mapTilesController.js";

const router = Router();

router.get("/map/tiles/:z/:x/:y", getMapTileHandler);
router.post("/map/tiles/batch", getMapTilesBatchHandler);

export default router;
