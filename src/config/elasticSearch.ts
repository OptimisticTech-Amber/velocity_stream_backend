import { Client } from "@elastic/elasticsearch";

export const esClient = new Client({
  node: "http://localhost:9200",
  maxRetries: 5,
  requestTimeout: 30000,
});
