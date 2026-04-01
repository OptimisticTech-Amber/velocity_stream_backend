"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMovieVideo = exports.deleteMovie = exports.updateMovie = exports.getMovieById = exports.getMovies = exports.createMovie = void 0;
const prisma_1 = require("../config/prisma");
const UploadServices_1 = require("../services/UploadServices");
const s3_1 = require("../shared/s3");
// Create Movie
const createMovie = async (req, res) => {
    try {
        const { title, description, genre, thumbnail, videoUrl } = req.body;
        const movie = await prisma_1.prisma.movie.create({
            data: {
                title: Array.isArray(title) ? title[0] : title,
                description: Array.isArray(description) ? description[0] : description,
                genre: Array.isArray(genre) ? genre[0] : genre,
                thumbnail: Array.isArray(thumbnail) ? thumbnail[0] : thumbnail,
                videoUrl: Array.isArray(videoUrl) ? videoUrl[0] : videoUrl,
            },
        });
        res.status(201).json(movie);
    }
    catch (error) {
        res.status(400).json({ error: "Failed to create movie" });
    }
};
exports.createMovie = createMovie;
// Get All Movies
const getMovies = async (req, res) => {
    try {
        const movies = await prisma_1.prisma.movie.findMany({
            orderBy: {
                createdAt: "desc",
            },
        });
        // Generate presigned URLs for all ready movies
        const moviesWithUrls = await Promise.all(movies.map(async (movie) => {
            if (movie.videoUrl && movie.status === "READY") {
                try {
                    const streamUrl = await (0, s3_1.getPresignedReadUrl)(movie.videoUrl, 60 * 60 * 24); // 24 hours
                    return { ...movie, streamUrl };
                }
                catch (error) {
                    console.error(`Error generating presigned URL for movie ${movie.id}:`, error);
                    return movie;
                }
            }
            return movie;
        }));
        res.json(moviesWithUrls);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch movies" });
    }
};
exports.getMovies = getMovies;
// Get Single Movie by ID
const getMovieById = async (req, res) => {
    try {
        const { id } = req.params;
        const movieId = Array.isArray(id) ? id[0] : id;
        const movie = await prisma_1.prisma.movie.findUnique({
            where: { id: movieId },
        });
        if (!movie) {
            return res.status(404).json({ error: "Movie not found" });
        }
        // Generate presigned URL if video is ready
        let movieWithStreamUrl = { ...movie };
        if (movie.videoUrl && movie.status === "READY") {
            try {
                const streamUrl = await (0, s3_1.getPresignedReadUrl)(movie.videoUrl, 60 * 60 * 24); // 24 hours
                movieWithStreamUrl = { ...movie, streamUrl };
            }
            catch (error) {
                console.error("Error generating presigned URL:", error);
            }
        }
        res.json(movieWithStreamUrl);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch movie" });
    }
};
exports.getMovieById = getMovieById;
// Update Movie
const updateMovie = async (req, res) => {
    try {
        const { id } = req.params;
        const movieId = Array.isArray(id) ? id[0] : id;
        const { title, description, genre, thumbnail, videoUrl } = req.body;
        const movie = await prisma_1.prisma.movie.update({
            where: { id: movieId },
            data: {
                title: Array.isArray(title) ? title[0] : title,
                description: Array.isArray(description) ? description[0] : description,
                genre: Array.isArray(genre) ? genre[0] : genre,
                thumbnail: Array.isArray(thumbnail) ? thumbnail[0] : thumbnail,
                videoUrl: Array.isArray(videoUrl) ? videoUrl[0] : videoUrl,
            },
        });
        res.json(movie);
    }
    catch (error) {
        res.status(400).json({ error: "Failed to update movie" });
    }
};
exports.updateMovie = updateMovie;
// Delete Movie
const deleteMovie = async (req, res) => {
    try {
        const { id } = req.params;
        const movieId = Array.isArray(id) ? id[0] : id;
        await prisma_1.prisma.movie.delete({
            where: { id: movieId },
        });
        res.json({ message: "Movie deleted successfully" });
    }
    catch (error) {
        res.status(400).json({ error: "Failed to delete movie" });
    }
};
exports.deleteMovie = deleteMovie;
// Upload Movie Video
const uploadMovieVideo = async (req, res) => {
    try {
        console.log("📹 Movie upload request received");
        console.log("Files:", req.file);
        console.log("Body:", req.body);
        if (!req.file) {
            return res.status(400).json({ error: "No file provided" });
        }
        const { title, description, genre, thumbnail } = req.body;
        if (!title || !genre) {
            return res
                .status(400)
                .json({ error: "Missing required fields: title, genre" });
        }
        console.log(`🎬 Processing movie: ${title} (${genre})`);
        // Create movie entry immediately
        const movie = await prisma_1.prisma.movie.create({
            data: {
                title,
                description: description || "",
                genre,
                thumbnail: thumbnail || null,
                status: "UPLOADING",
            },
        });
        console.log(`✅ Movie created with ID: ${movie.id}`);
        // Send to Kafka producer for processing
        await (0, UploadServices_1.uploadVideo)(req.file, {
            type: "movie",
            movieId: movie.id,
            title,
            description: description || "",
            genre,
            thumbnail: thumbnail || null,
        });
        res.status(202).json({
            message: "Movie video processing started",
            movieId: movie.id,
            title,
            genre,
            status: "UPLOADING",
        });
    }
    catch (error) {
        console.error("❌ Error uploading movie video:", error);
        res.status(500).json({
            error: "Failed to upload movie video",
            details: error?.message || String(error),
        });
    }
};
exports.uploadMovieVideo = uploadMovieVideo;
