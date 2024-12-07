require("dotenv").config();
const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

// Initialize Express server
const app = express();
app.listen(3000, () => {
  console.log("Project is running on http://localhost:3000");
});

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

// Initialize Discord bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Required to read message content
  ],
});

// Load environment variables
const {
  HYPIXEL_API_KEY,
  BOT_TOKEN,
  UUID1,
  UUID2,
  UUID3,
  USER_ID,
  Channel_ID,
  Channel_ID2,
} = process.env;

// Usernames associated with the UUIDs
const usernames = {
  [UUID1]: "YMCAJason1910",
  [UUID2]: "Justtokyo",
  [UUID3]: "OompaLoompaman69",
};

// Track users who are being monitored
let monitoredUUIDs = new Set(); // Set to track UUIDs being monitored
let stoppedUUIDs = new Set(); // Track UUIDs that have been stopped from monitoring

// Cache to store the Hypixel API responses
const cache = new Map(); // A simple cache using JavaScript's Map

// Function to fetch status from Hypixel API for multiple UUIDs
async function fetchHypixelStatus() {
  const fetch = (await import("node-fetch")).default;

  const uuids = [UUID1, UUID2, UUID3];
  for (const uuid of uuids) {
    if (stoppedUUIDs.has(uuid)) continue; // Skip stopped UUIDs

    const username = usernames[uuid];
    const cached = cache.get(uuid);
    const now = Date.now();

    // Use cache if available and not expired
    if (cached && now - cached.timestamp < 300000) {
      console.log(`Using cached data for ${uuid}`);
      handleStatusData(cached.data, username, uuid);
      continue;
    }

    // Fetch from the Hypixel API
    const url = `https://api.hypixel.net/status?key=${HYPIXEL_API_KEY}&uuid=${uuid}`;
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        // If the API key is expired, we handle it
        if (data.cause === "Invalid API key") {
          console.error("The Hypixel API key has expired or is invalid.");
          await notifyUserExpiredAPIKey();  // Notify user about the API key expiration
        } else {
          console.error(`Error fetching status for ${uuid}: ${data.cause}`);
        }
        continue;
      }

      // Cache the response
      cache.set(uuid, { data, timestamp: now });
      handleStatusData(data, username, uuid);
    } catch (error) {
      console.error(`Error fetching data for ${uuid}:`, error);
    }
  }
}

// Function to handle status data
async function handleStatusData(data, username, uuid) {
  const dynamicChannel1 = await client.channels.fetch(Channel_ID);
  const dynamicChannel2 = await client.channels.fetch(Channel_ID2);

  if (data.session.online) {
    const gameType = data.session.gameType;

    if (gameType === "SKYBLOCK") {
      await dynamicChannel2.send(`${username} is playing Skyblock!`);
    } else {
      await dynamicChannel1.send(
        `<@${USER_ID}> ${username} is **NOT** playing Skyblock! Currently playing ${gameType}.`
      );
      await dynamicChannel2.send(
        `${username} is **NOT** playing Skyblock! Currently playing ${gameType}.`
      );
      stoppedUUIDs.add(uuid); // Stop further checks for this UUID
    }
  } else {
    await dynamicChannel1.send(`<@${USER_ID}> ${username} is currently offline.`);
    await dynamicChannel2.send(`${username} is currently offline.`);
    stoppedUUIDs.add(uuid);
  }
}

// Function to notify user about API key expiration
async function notifyUserExpiredAPIKey() {
  const user = await client.users.fetch(USER_ID);
  await user.send("⚠️ Your Hypixel API key has expired or is invalid! Please update it.");
}

// Event: Bot ready
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  setInterval(fetchHypixelStatus, 300000); // Check every 5 minutes
});

// Event: Message received
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Handle the "!reset" command
  if (message.content.toLowerCase() === "!reset") {
    stoppedUUIDs.clear(); // Clear stopped UUIDs
    await message.channel.send("The status monitoring has been reset for all users.");
  }

  // Handle the "!test" command to check status instantly
  if (message.content.toLowerCase() === "!test") {
    await message.channel.send("Checking the status of all users...");
    await fetchHypixelStatus(); // Call the function to check the status instantly
  }
});

// Log in the bot
client.login(BOT_TOKEN);
