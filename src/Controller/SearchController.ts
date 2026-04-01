import { esClient } from "../config/elasticSearch";

export const searchMovies = async (req: any, res: any) => {
  try {
    const { q, genre, page = 1, limit = 10 } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const from = (page - 1) * limit;

    const result = await esClient.search({
      index: "movies",
      from,
      size: limit,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: q.trim(),
                fields: ["title^3", "description", "genre"],
                fuzziness: "AUTO",
              },
            },
          ],
          filter: [
            ...(genre
              ? [
                  {
                    term: {
                      "genre.keyword": genre,
                    },
                  },
                ]
              : []),
          ],
        },
      },
    });

    const hits = result.hits.hits.map((hit) => ({
      id: hit._id,
      ...(hit._source as Record<string, any>),
    }));

    res.json({
      total: result.hits.total,
      page,
      limit,
      data: hits,
    });

    console.log(
      `✅ Movies found for query "${q}": ${hits.length}`
    );
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
};