// import kafka from "../config/kafka";
// import { VideoJob } from "../types/VideoTypes";

// const producer = kafka.producer();

// export async function sendVideoJob(payload: VideoJob) {
//   await producer.connect();

//   await producer.send({
//     topic: "video-processing",
//     messages: [
//       {
//         value: JSON.stringify(payload),
//       },
//     ],
//   });

//   await producer.disconnect();
// }

// kafka/producer.ts
import { getKafka } from "../config/kafka";

const kafka = getKafka("video-service");

export const producer = kafka.producer();

let isConnected = false;

const connectWithRetry = async (maxRetries = 15, baseDelay = 2000) => {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await producer.connect();
      console.log("✅ Kafka producer connected successfully");
      return;
    } catch (error: any) {
      lastError = error;
      const delay = baseDelay * Math.pow(2, attempt - 1); // exponential backoff
      const delaySeconds = Math.round(delay / 1000);
      console.warn(
        `⚠️  Producer connection attempt ${attempt}/${maxRetries} failed. Retrying in ${delaySeconds}s...`,
      );
      console.warn(`   Error: ${error?.message || error}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(
    `Failed to connect producer to Kafka after ${maxRetries} attempts: ${lastError?.message || lastError}`,
  );
};

export const connectProducer = async () => {
  if (!isConnected) {
    await connectWithRetry();
    isConnected = true;
  }
};


export const sendMessage = async (topic: string, metadata: any) => {
  try {
    await connectProducer();

    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(metadata),
        },
      ],
    });

    console.log(`✅ Message sent to topic: ${topic}`);
  } catch (error) {
    console.error("❌ Error sending message to Kafka:", error);
    throw error;
  }
};
