"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadEpisode = exports.uploadMovie = void 0;
const UploadServices_1 = require("../services/UploadServices");
const uploadMovie = async (req, res) => {
    const result = await (0, UploadServices_1.uploadVideo)(req.file, {
        type: "movie",
        title: req.body.title,
    });
    res.json(result);
};
exports.uploadMovie = uploadMovie;
const uploadEpisode = async (req, res) => {
    const result = await (0, UploadServices_1.uploadVideo)(req.file, {
        type: "episode",
        title: req.body.title,
        seasonId: req.body.seasonId,
        episodeNo: Number(req.body.episodeNo),
    });
    res.json(result);
};
exports.uploadEpisode = uploadEpisode;
