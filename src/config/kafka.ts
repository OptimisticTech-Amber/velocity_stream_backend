import "dotenv/config";
import { Kafka } from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS ?? "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

export const getKafka = (clientId: string) =>
  new Kafka({
    clientId,
    brokers,
  });

const kafka = getKafka(process.env.KAFKA_CLIENT_ID ?? "video-streaming-app");

export default kafka;
