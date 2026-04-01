"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadEpisodeVideo = exports.getEpisodes = exports.createEpisode = exports.getSeasons = exports.createSeason = exports.deleteSeries = exports.updateSeries = exports.getSeriesById = exports.getSeries = exports.createSeries = void 0;
const prisma_1 = require("../config/prisma");
const UploadServices_1 = require("../services/UploadServices");
const s3_1 = require("../shared/s3");
// Create Series
const createSeries = async (req, res) => {
    try {
        const { title, description, genre, thumbnail } = req.body;
        const series = await prisma_1.prisma.series.create({
            data: {
                title: Array.isArray(title) ? title[0] : title,
                description: Array.isArray(description) ? description[0] : description,
                genre: Array.isArray(genre) ? genre[0] : genre,
                thumbnail: Array.isArray(thumbnail) ? thumbnail[0] : thumbnail,
            },
        });
        res.status(201).json(series);
    }
    catch (error) {
        res.status(400).json({ error: "Failed to create series" });
    }
};
exports.createSeries = createSeries;
// Get All Series
const getSeries = async (_, res) => {
    try {
        const series = await prisma_1.prisma.series.findMany({
            include: {
                seasons: {
                    include: {
                        episodes: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        // Generate presigned URLs for all ready episodes
        const seriesWithUrls = await Promise.all(series.map(async (s) => ({
            ...s,
            seasons: await Promise.all(s.seasons.map(async (season) => ({
                ...season,
                episodes: await Promise.all(season.episodes.map(async (episode) => {
                    if (episode.videoUrl && episode.status === "READY") {
                        try {
                            const streamUrl = await (0, s3_1.getPresignedReadUrl)(episode.videoUrl, 60 * 60 * 24);
                            return { ...episode, streamUrl };
                        }
                        catch (error) {
                            console.error(`Error generating presigned URL for episode ${episode.id}:`, error);
                            return episode;
                        }
                    }
                    return episode;
                })),
            }))),
        })));
        res.json(seriesWithUrls);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch series" });
    }
};
exports.getSeries = getSeries;
// Get Series by ID
const getSeriesById = async (req, res) => {
    try {
        const { id } = req.params;
        const seriesId = Array.isArray(id) ? id[0] : id;
        const series = await prisma_1.prisma.series.findUnique({
            where: { id: seriesId },
            include: {
                seasons: {
                    include: {
                        episodes: true,
                    },
                },
            },
        });
        if (!series) {
            return res.status(404).json({ error: "Series not found" });
        }
        // Generate presigned URLs for all ready episodes
        const seriesWithUrls = {
            ...series,
            seasons: await Promise.all(series.seasons.map(async (season) => ({
                ...season,
                episodes: await Promise.all(season.episodes.map(async (episode) => {
                    if (episode.videoUrl && episode.status === "READY") {
                        try {
                            const streamUrl = await (0, s3_1.getPresignedReadUrl)(episode.videoUrl, 60 * 60 * 24);
                            return { ...episode, streamUrl };
                        }
                        catch (error) {
                            console.error(`Error generating presigned URL for episode ${episode.id}:`, error);
                            return episode;
                        }
                    }
                    return episode;
                })),
            }))),
        };
        res.json(seriesWithUrls);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch series" });
    }
};
exports.getSeriesById = getSeriesById;
// Update Series
const updateSeries = async (req, res) => {
    try {
        const { id } = req.params;
        const seriesId = Array.isArray(id) ? id[0] : id;
        const { title, description, genre, thumbnail } = req.body;
        const series = await prisma_1.prisma.series.update({
            where: { id: seriesId },
            data: {
                title: Array.isArray(title) ? title[0] : title,
                description: Array.isArray(description) ? description[0] : description,
                genre: Array.isArray(genre) ? genre[0] : genre,
                thumbnail: Array.isArray(thumbnail) ? thumbnail[0] : thumbnail,
            },
        });
        res.json(series);
    }
    catch (error) {
        res.status(400).json({ error: "Failed to update series" });
    }
};
exports.updateSeries = updateSeries;
// Delete Series
const deleteSeries = async (req, res) => {
    try {
        const { id } = req.params;
        const seriesId = Array.isArray(id) ? id[0] : id;
        await prisma_1.prisma.series.delete({
            where: { id: seriesId },
        });
        res.json({ message: "Series deleted successfully" });
    }
    catch (error) {
        res.status(400).json({ error: "Failed to delete series" });
    }
};
exports.deleteSeries = deleteSeries;
// Create Season
const createSeason = async (req, res) => {
    try {
        const { seriesId } = req.params;
        const series = Array.isArray(seriesId) ? seriesId[0] : seriesId;
        const { number } = req.body;
        const num = Array.isArray(number)
            ? parseInt(number[0])
            : typeof number === "string"
                ? parseInt(number)
                : number;
        const season = await prisma_1.prisma.season.create({
            data: {
                number: num,
                seriesId: series,
            },
        });
        res.status(201).json(season);
    }
    catch (error) {
        res.status(400).json({ error: "Failed to create season" });
    }
};
exports.createSeason = createSeason;
// Get Seasons by Series ID
const getSeasons = async (req, res) => {
    try {
        const { seriesId } = req.params;
        const series = Array.isArray(seriesId) ? seriesId[0] : seriesId;
        const seasons = await prisma_1.prisma.season.findMany({
            where: { seriesId: series },
            include: {
                episodes: true,
            },
        });
        res.json(seasons);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch seasons" });
    }
};
exports.getSeasons = getSeasons;
// Create Episode
const createEpisode = async (req, res) => {
    try {
        const { seasonId } = req.params;
        const season = Array.isArray(seasonId) ? seasonId[0] : seasonId;
        const { title, number, videoUrl } = req.body;
        const episode = await prisma_1.prisma.episode.create({
            data: {
                title: Array.isArray(title) ? title[0] : title,
                number: Array.isArray(number)
                    ? parseInt(number[0])
                    : typeof number === "string"
                        ? parseInt(number)
                        : number,
                videoUrl: Array.isArray(videoUrl) ? videoUrl[0] : videoUrl,
                seasonId: season,
            },
        });
        res.status(201).json(episode);
    }
    catch (error) {
        res.status(400).json({ error: "Failed to create episode" });
    }
};
exports.createEpisode = createEpisode;
// Get Episodes by Season ID
const getEpisodes = async (req, res) => {
    try {
        const { seasonId } = req.params;
        const season = Array.isArray(seasonId) ? seasonId[0] : seasonId;
        const episodes = await prisma_1.prisma.episode.findMany({
            where: { seasonId: season },
        });
        res.json(episodes);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch episodes" });
    }
};
exports.getEpisodes = getEpisodes;
// Upload Episode Video
const uploadEpisodeVideo = async (req, res) => {
    try {
        console.log("📹 Episode upload request received");
        console.log("Files:", req.file);
        console.log("Body:", req.body);
        if (!req.file) {
            return res.status(400).json({ error: "No file provided" });
        }
        const { title, number, seasonId } = req.body;
        const season = Array.isArray(seasonId) ? seasonId[0] : seasonId;
        const num = Array.isArray(number)
            ? parseInt(number[0])
            : typeof number === "string"
                ? parseInt(number)
                : number;
        const titleVal = Array.isArray(title) ? title[0] : title;
        if (!titleVal || !num || !season) {
            return res
                .status(400)
                .json({ error: "Missing required fields: title, number, seasonId" });
        }
        // Verify season exists
        const seasonRecord = await prisma_1.prisma.season.findUnique({
            where: { id: season },
        });
        if (!seasonRecord) {
            return res.status(404).json({ error: "Season not found" });
        }
        console.log(`📺 Processing episode: ${titleVal} (Episode ${num})`);
        // Send to Kafka producer for processing
        await (0, UploadServices_1.uploadVideo)(req.file, {
            type: "episode",
            title: titleVal,
            number: num,
            seasonId: season,
        });
        res.status(202).json({
            message: "Episode video processing started",
            title: titleVal,
            number: num,
            seasonId: season,
        });
    }
    catch (error) {
        console.error("❌ Error uploading episode video:", error);
        res.status(500).json({
            error: "Failed to upload episode video",
            details: error?.message || String(error),
        });
    }
};
exports.uploadEpisodeVideo = uploadEpisodeVideo;
