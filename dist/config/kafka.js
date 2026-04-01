"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKafka = void 0;
require("dotenv/config");
const kafkajs_1 = require("kafkajs");
const brokers = (process.env.KAFKA_BROKERS ?? "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
const getKafka = (clientId) => new kafkajs_1.Kafka({
    clientId,
    brokers,
});
exports.getKafka = getKafka;
const kafka = (0, exports.getKafka)(process.env.KAFKA_CLIENT_ID ?? "video-streaming-app");
exports.default = kafka;
