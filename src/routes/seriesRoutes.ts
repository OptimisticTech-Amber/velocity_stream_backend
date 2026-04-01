import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import {
  createSeries,
  getSeries,
  getSeriesById,
  createSeason,
  createEpisode,
  uploadEpisodeVideo,
} from "../Controller/seriesController";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB
});

// Error handling middleware for multer
const handleMulterError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res
        .status(400)
        .json({ error: "Unexpected file field. Use 'video' as field name" });
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large" });
    }
  }
  next(err);
};

// Custom multer middleware to accept any file field name
const uploadAnyVideo = (req: Request, res: Response, next: NextFunction) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }

    // Extract the file from any field
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      // Find the first file field
      const file = req.files[0];
      req.file = file as Express.Multer.File;
    }

    next();
  });
};

router.post("/", createSeries);
router.get("/", getSeries);
router.get("/:id", getSeriesById);

router.post("/:seriesId/seasons", createSeason);
router.get("/:seriesId/seasons", (req, res) => {
  // Route to get seasons - will be implemented with getSeasons function
  res.status(501).json({ error: "Not implemented" });
});

router.post("/seasons/:seasonId/episodes", createEpisode);
router.post(
  "/seasons/:seasonId/episodes/upload",
  uploadAnyVideo,
  uploadEpisodeVideo,
);

export default router;
