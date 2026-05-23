export default async function handler(req, res) {
  const IG_USER_ID = process.env.IG_USER_ID;
  const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;

  const allowedOriginsRaw =
    process.env.ALLOWED_ORIGINS ||
    process.env.ALLOWED_ORIGIN ||
    "*";

  const requestOrigin = req.headers.origin || "";
  const allowedOrigins = allowedOriginsRaw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowAll = allowedOrigins.includes("*");

  const corsOrigin =
    allowAll || !requestOrigin
      ? "*"
      : allowedOrigins.includes(requestOrigin)
        ? requestOrigin
        : allowedOrigins[0];

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!IG_USER_ID || !IG_ACCESS_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "Missing IG_USER_ID or IG_ACCESS_TOKEN environment variable."
    });
  }

  try {
    const limit = Math.min(Number(req.query.limit || 12), 24);

    const fields = [
      "id",
      "caption",
      "media_type",
      "media_product_type",
      "media_url",
      "thumbnail_url",
      "permalink",
      "timestamp"
    ].join(",");

    const url =
      `https://graph.facebook.com/v25.0/${IG_USER_ID}/media` +
      `?fields=${encodeURIComponent(fields)}` +
      `&limit=${limit}` +
      `&access_token=${encodeURIComponent(IG_ACCESS_TOKEN)}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        ok: false,
        error: "Instagram API request failed.",
        details: errorText
      });
    }

    const data = await response.json();

    const items = (data.data || [])
      .map((item) => {
        const isVideo = item.media_type === "VIDEO";

        return {
          id: item.id,
          caption: item.caption || "",
          media_type: item.media_type,
          media_product_type: item.media_product_type || "",
          image_url: isVideo ? item.thumbnail_url || item.media_url : item.media_url,
          video_url: isVideo ? item.media_url : "",
          permalink: item.permalink,
          timestamp: item.timestamp,
          is_video: isVideo
        };
      })
      .filter((item) => item.image_url && item.permalink);

    res.setHeader(
      "Cache-Control",
      "s-maxage=21600, stale-while-revalidate=86400"
    );

    return res.status(200).json({
      ok: true,
      count: items.length,
      items
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Server error while fetching Instagram feed.",
      details: error.message
    });
  }
}
