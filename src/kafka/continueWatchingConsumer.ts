import { getKafka } from "../config/kafka";
import { getPrisma } from "../config/prisma";

const kafka = getKafka("video-service");
const consumer = kafka.consumer({ groupId: "videoservice-consumer-group" });

const connectWithRetry = async (maxRetries = 15, baseDelay = 2000) => {
  let lastError: any;
  const maxDelay = 60000; // Cap delay at 60 seconds
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await consumer.connect();
      console.log("✅ Consumer connected successfully");
      return;
    } catch (error: any) {
      lastError = error;
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
      const delay = Math.min(exponentialDelay, maxDelay); // Cap at maxDelay
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
      topic: "watch-progress",
      fromBeginning: false,
    });
    console.log("✅ Subscribed to topic: watch-progress");

    await consumer.run({
      eachMessage: async ({ message, topic }) => {
        try {
          console.log("🔥 Message received");
          console.log("Topic:", topic);
          console.log("Message:", message.value?.toString());

          const data = JSON.parse(message.value!.toString());
          console.log("Parsed data:", data);
          const { deviceId, contentId, progressSeconds, durationSeconds } =
            data;
          const db = getPrisma();
          await db.watchProgress.upsert({
            where: {
              deviceId_contentId: {
                deviceId,
                contentId,
              },
            },
            update: {
              progressSeconds,
              durationSeconds,
            },
            create: {
              deviceId,
              contentId,
              progressSeconds,
              durationSeconds,
            },
          });
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
