const { TelegramClient } = require("teleproto");
const { StringSession } = require("teleproto/sessions");

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const session = new StringSession(process.env.TELEGRAM_SESSION_STRING);

const client = new TelegramClient(session, apiId, apiHash, {
  connectionRetries: 5,
});

module.exports = client;
