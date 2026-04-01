import { Router } from "express";
import {
  continueWatchingController,
  getContinueWatchingController,
} from "../Controller/continueWatchingController";

const router = Router();

router.post("/progress", continueWatchingController);
router.get("/progress/:deviceId", getContinueWatchingController);

export default router;
