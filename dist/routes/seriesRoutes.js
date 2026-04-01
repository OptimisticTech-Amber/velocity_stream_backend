"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const seriesController_1 = require("../Controller/seriesController");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB
});
// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
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
const uploadAnyVideo = (req, res, next) => {
    upload.any()(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }
        // Extract the file from any field
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            // Find the first file field
            const file = req.files[0];
            req.file = file;
        }
        next();
    });
};
router.post("/", seriesController_1.createSeries);
router.get("/", seriesController_1.getSeries);
router.get("/:id", seriesController_1.getSeriesById);
router.post("/:seriesId/seasons", seriesController_1.createSeason);
router.get("/:seriesId/seasons", (req, res) => {
    // Route to get seasons - will be implemented with getSeasons function
    res.status(501).json({ error: "Not implemented" });
});
router.post("/seasons/:seasonId/episodes", seriesController_1.createEpisode);
router.post("/seasons/:seasonId/episodes/upload", uploadAnyVideo, seriesController_1.uploadEpisodeVideo);
exports.default = router;
