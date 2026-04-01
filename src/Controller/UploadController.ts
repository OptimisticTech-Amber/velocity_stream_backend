import { uploadVideo } from "../services/UploadServices";
import { Request, Response } from "express";
export const uploadMovie = async (req: Request, res: Response) => {
  const result = await uploadVideo(req.file, {
    type: "movie",
    title: req.body.title,
  });

  res.json(result);
};

export const uploadEpisode = async (req: Request, res: Response) => {
  const result = await uploadVideo(req.file, {
    type: "episode",
    title: req.body.title,
    seasonId: req.body.seasonId,
    episodeNo: Number(req.body.episodeNo),
  });

  res.json(result);
};