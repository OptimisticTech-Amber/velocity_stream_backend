"use strict";
// import kafka from "../config/kafka";
// import { VideoJob } from "../types/VideoTypes";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = exports.connectProducer = exports.producer = void 0;
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
const kafka_1 = require("../config/kafka");
const kafka = (0, kafka_1.getKafka)("video-service");
exports.producer = kafka.producer();
let isConnected = false;
const connectWithRetry = async (maxRetries = 15, baseDelay = 2000) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await exports.producer.connect();
            console.log("✅ Kafka producer connected successfully");
            return;
        }
        catch (error) {
            lastError = error;
            const delay = baseDelay * Math.pow(2, attempt - 1); // exponential backoff
            const delaySeconds = Math.round(delay / 1000);
            console.warn(`⚠️  Producer connection attempt ${attempt}/${maxRetries} failed. Retrying in ${delaySeconds}s...`);
            console.warn(`   Error: ${error?.message || error}`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error(`Failed to connect producer to Kafka after ${maxRetries} attempts: ${lastError?.message || lastError}`);
};
const connectProducer = async () => {
    if (!isConnected) {
        await connectWithRetry();
        isConnected = true;
    }
};
exports.connectProducer = connectProducer;
const sendMessage = async (topic, metadata) => {
    try {
        await (0, exports.connectProducer)();
        await exports.producer.send({
            topic,
            messages: [
                {
                    value: JSON.stringify(metadata),
                },
            ],
        });
        console.log(`✅ Message sent to topic: ${topic}`);
    }
    catch (error) {
        console.error("❌ Error sending message to Kafka:", error);
        throw error;
    }
};
exports.sendMessage = sendMessage;
