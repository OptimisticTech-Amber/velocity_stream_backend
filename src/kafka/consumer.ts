// Video consumer - simplified with Cloudinary (no transcoding needed)
import { getKafka } from "../config/kafka";
import { getPrisma } from "../config/prisma";

const kafka = getKafka("video-consumer");
const consumer = kafka.consumer({ groupId: "video-upload-consumer-group" });

const connectWithRetry = async (maxRetries = 15, baseDelay = 2000) => {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await consumer.connect();
      console.log("✅ Consumer connected successfully");
      return;
    } catch (error: any) {
      lastError = error;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      const delaySeconds = Math.round(delay / 1000);
      console.warn(
        `⚠️  Connection attempt ${attempt}/${maxRetries} failed. Retrying in ${delaySeconds}s...`,
      );
      console.warn(`   Error: ${error?.message || error}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(
    `Failed to connect to Kafka after ${maxRetries} attempts: ${lastError?.message || lastError}`,
  );
};

const run = async () => {
  try {
    await connectWithRetry();
    console.log("✅ Consumer started successfully");

    await consumer.subscribe({
      topic: "video.upload",
      fromBeginning: false,
    });
    console.log("✅ Subscribed to topic: video.upload");

    await consumer.run({
      eachMessage: async ({ message, topic }) => {
        try {
          console.log("🔥 Message received");
          console.log("Topic:", topic);
          console.log("Message:", message.value?.toString());

          const data = JSON.parse(message.value!.toString());
          console.log("Parsed data:", data);

          const db = getPrisma();

          // Cloudinary already returns HLS-ready URLs, no transcoding needed!
          // Just update the database with the video URL and mark as ready
          console.log(`📝 Updating ${data.type} with video URL...`);
          console.log(`Video URL: ${data.url || data.videoUrl}`);

          const videoUrl = data.url || data.videoUrl;

          // if (data.type === "movie") {
          //   await db.movie.update({
          //     where: { id: data.movieId },
          //     data: {
          //       videoUrl: videoUrl,
          //       streamUrl: videoUrl,
          //       status: "READY",
          //     },
          //   });
          //   console.log(`✅ Movie ${data.movieId} marked as READY`);
          // } else if (data.type === "episode") {
          //   await db.episode.update({
          //     where: { id: data.episodeId },
          //     data: {
          //       videoUrl: videoUrl,
          //       streamUrl: videoUrl,
          //       status: "READY",
          //     },
          //   });
          //   console.log(`✅ Episode ${data.episodeId} marked as READY`);
          // }

          console.log(`✅ Video processing complete for: ${data.title}`);
        } catch (error) {
          console.error("❌ Error processing message:", error);
          console.error("Stack trace:", (error as Error).stack);
        }
      },
    });
  } catch (error) {
    console.error("❌ Fatal error in consumer:", error);
    process.exit(1);
  }
};

run().catch((error) => {
  console.error("❌ Consumer crashed:", error);
  process.exit(1);
});
