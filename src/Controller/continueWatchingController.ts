import { Request, Response } from "express";
import { sendMessage } from "../kafka/producer";
import { redis } from "../config/redis";
import { getPrisma } from "../config/prisma";

const getSingleString = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const continueWatchingController = async (
  req: Request,
  res: Response,
) => {
  try {
    const { deviceId, contentId, progressSeconds, durationSeconds } = req.body;

    // Validation
    if (!deviceId || typeof deviceId !== "string") {
      return res.status(400).json({ error: "Missing or invalid deviceId" });
    }
    if (!contentId || typeof contentId !== "string") {
      return res.status(400).json({ error: "Missing or invalid contentId" });
    }
    if (typeof progressSeconds !== "number" || progressSeconds < 0) {
      return res.status(400).json({
        error: "Invalid progressSeconds: must be non-negative number",
      });
    }
    if (typeof durationSeconds !== "number" || durationSeconds <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid durationSeconds: must be positive number" });
    }
    if (progressSeconds > durationSeconds) {
      return res
        .status(400)
        .json({ error: "progressSeconds cannot exceed durationSeconds" });
    }

    const key = `progress:${deviceId}:${contentId}`;

    // Save in Redis (awaited for data consistency)
    await redis.set(
      key,
      JSON.stringify({
        contentId,
        progressSeconds,
        durationSeconds,
      }),
      "EX",
      86400,
    );

    // Send event to Kafka (fire and forget to avoid blocking client response)
    sendMessage("watch-progress", {
      deviceId,
      contentId,
      progressSeconds,
      durationSeconds,
    }).catch((error) => {
      console.error("⚠️  Kafka send failed:", error);
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Continue watching error:", error);
    res.status(500).json({ error: "Failed to save progress" });
  }
};

export const getContinueWatchingController = async (
  req: Request,
  res: Response,
) => {
  const deviceId =
    getSingleString(req.params.deviceId) ??
    getSingleString(req.query.deviceId as string | string[] | undefined);

  if (!deviceId) {
    return res.status(400).json({ error: "Missing deviceId" });
  }

  const prisma = getPrisma();

  try {
    // ⚡ Use SCAN instead of KEYS (production safe)
    const keys: string[] = [];
    let cursor = "0";

    do {
      const result = await redis.scan(
        cursor,
        "MATCH",
        `progress:${deviceId}:*`,
        "COUNT",
        100,
      );

      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== "0");

    console.log(`🔍 Redis search for "${deviceId}": found ${keys.length} keys`);

    // ⚡ Fetch all redis values in one call
    const values = keys.length > 0 ? await redis.mget(...keys) : [];

    const data: any[] = [];

    values.forEach((value, index) => {
      if (!value) return;

      const parsed = JSON.parse(value);

      const [, , contentId] = keys[index].split(":");

      // Ignore completed videos
      if (parsed.progressSeconds / parsed.durationSeconds > 0.9) return;

      data.push({
        contentId,
        progressSeconds: parsed.progressSeconds,
        durationSeconds: parsed.durationSeconds,
      });
    });

    if (data.length > 0) {
      return res.json(data);
    }

    // --------------------------
    // DB Fallback
    // --------------------------

    const dbData = await prisma.watchProgress.findMany({
      where: {
        deviceId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 20,
    });

    const filtered = dbData.filter(
      (item) => item.progressSeconds / item.durationSeconds < 0.9,
    );
    console.log(
      `📊 DB Fallback for "${deviceId}": found ${dbData.length} records, returned ${filtered.length} (${dbData.length - filtered.length} filtered as completed)`,
    );
    console.log("DB data:", filtered);
    return res.json(filtered);
  } catch (error) {
    console.error("Continue watching error:", error);

    return res.status(500).json({
      error: "Failed to fetch continue watching",
    });
  }
};
