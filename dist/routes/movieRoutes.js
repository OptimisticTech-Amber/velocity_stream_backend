"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const movieConroller_1 = require("../Controller/movieConroller");
const router = (0, express_1.Router)();
// Ensure upload directory exists
const uploadDir = path_1.default.join(process.cwd(), "uploads");
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB
});
// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === "LIMIT_PART_COUNT") {
            return res.status(400).json({ error: "Too many parts" });
        }
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "File too large" });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({ error: "Too many files" });
        }
        if (err.code === "LIMIT_FIELD_KEY") {
            return res.status(400).json({ error: "Field name too long" });
        }
        if (err.code === "LIMIT_FIELD_COUNT") {
            return res.status(400).json({ error: "Too many fields" });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res
                .status(400)
                .json({ error: "Unexpected file field. Use 'video' as field name" });
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
// Movie CRUD endpoints
// router.post("/", createMovie);
router.get("/", movieConroller_1.getMovies);
router.get("/:id", movieConroller_1.getMovieById);
router.put("/:id", movieConroller_1.updateMovie);
router.delete("/:id", movieConroller_1.deleteMovie);
// Video upload endpoint - accepts file from any field name
router.post("/upload", uploadAnyVideo, movieConroller_1.uploadMovieVideo);
exports.default = router;
