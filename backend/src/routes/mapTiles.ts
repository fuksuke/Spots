import { Router } from "express";

import { getMapTileHandler } from "../controllers/mapTilesController.js";

const router = Router();

router.get("/map/tiles/:z/:x/:y", getMapTileHandler);

export default router;
