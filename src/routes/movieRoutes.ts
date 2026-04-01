import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  createMovie,
  getMovies,
  getMovieById,
  updateMovie,
  deleteMovie,
  uploadMovieVideo,
} from "../Controller/movieConroller";
import { searchMovies } from "../Controller/SearchController";

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
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

// Movie CRUD endpoints
// router.post("/", createMovie);
router.get("/", getMovies);
router.get("/search", searchMovies);
router.get("/:id", getMovieById);
router.put("/:id", updateMovie);
router.delete("/:id", deleteMovie);
// Video upload endpoint - accepts file from any field name
router.post("/upload", uploadAnyVideo, uploadMovieVideo);

export default router;
