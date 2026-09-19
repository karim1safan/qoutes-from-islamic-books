require("dotenv").config();

const express = require("express");
const { TelegramClient } = require("teleproto");
const { StringSession } = require("teleproto/sessions");

const cors = require("cors");
const app = express();
const path = require("path");

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(cors());

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const session = new StringSession(process.env.TELEGRAM_SESSION_STRING);

const client = new TelegramClient(session, apiId, apiHash, {
  connectionRetries: 5,
});

const channel = process.env.TELEGRAM_CHANNEL;
const POSTS_PER_PAGE = 12;

// --- In-memory cache ---
let cachedPosts = [];
let lastCacheRefresh = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function refreshCache() {
  try {
    console.log("Refreshing posts cache...");
    let allMessages = [];
    let lastId = undefined;

    while (true) {
      const batch = await client.getMessages(channel, {
        limit: 100,
        offsetId: lastId,
      });
      if (batch.length === 0) break;
      allMessages.push(...batch);
      lastId = batch[batch.length - 1].id;
    }

    cachedPosts = allMessages
      .filter((message) => message.media)
      .map((message) => ({
        id: message.id,
        title: message.message || "",
        date: message.date,
        image: `/api/posts/${message.id}/image`,
      }));

    lastCacheRefresh = Date.now();
    console.log(`Cache refreshed: ${cachedPosts.length} posts`);
  } catch (error) {
    console.error("Cache refresh failed:", error);
  }
}

// --- Paginated posts endpoint ---
app.get("/api/posts", async (req, res) => {
  try {
    // Refresh cache if expired or empty
    if (cachedPosts.length === 0 || Date.now() - lastCacheRefresh > CACHE_TTL) {
      await refreshCache();
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || POSTS_PER_PAGE);
    const search = (req.query.search || "").trim();
    const sort = req.query.sort === "oldest" ? "oldest" : "newest";

    // Filter by search term
    let filtered = cachedPosts;
    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = cachedPosts.filter((post) =>
        post.title.toLowerCase().includes(lowerSearch)
      );
    }

    // Sort
    if (sort === "oldest") {
      filtered = [...filtered].reverse();
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const posts = filtered.slice(start, start + limit);

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch posts",
    });
  }
});

app.get("/api/posts/:id/image", async (req, res) => {
  try {
    const messageId = Number(req.params.id);

    const messages = await client.getMessages(channel, {
      ids: messageId,
    });

    const message = messages[0];

    if (!message || !message.media) {
      return res.status(404).send("Image not found");
    }

    const buffer = await client.downloadMedia(message);

    if (!buffer) {
      return res.status(404).send("Could not download image");
    }

    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

async function start() {
  await client.start({
    phoneNumber: () => Promise.resolve(),
    password: () => Promise.resolve(),
    phoneCode: () => Promise.resolve(),
    onError: console.error,
  });

  // Initial cache load
  await refreshCache();

  // Background refresh every 5 minutes
  setInterval(refreshCache, CACHE_TTL);

  app.listen(process.env.PORT || 3000, () => {
    console.log(
      `Server running on http://localhost:${process.env.PORT || 3000}`,
    );
  });
}

start();
