import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { WebClient } from "@slack/web-api";
import crypto from "crypto";

const app = express();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// ✅ Verify requests are genuinely from Slack
function verifySlackRequest(req) {
  const signature = req.headers["x-slack-signature"];
  const timestamp = req.headers["x-slack-request-timestamp"];
  const body = req.rawBody;

  const hmac = crypto.createHmac("sha256", process.env.SLACK_SIGNING_SECRET);
  hmac.update(`v0:${timestamp}:${body}`);
  const expected = `v0=${hmac.digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Parse raw body (needed for Slack signature verification)
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// Track processed events to avoid duplicate replies
const processedEvents = new Set();

app.post("/slack/events", async (req, res) => {
  // 1. Slack URL verification challenge (one-time setup)
  if (req.body.type === "url_verification") {
    return res.json({ challenge: req.body.challenge });
  }

  // 2. Verify the request is from Slack
  if (!verifySlackRequest(req)) {
    return res.status(401).send("Unauthorized");
  }

  // 3. Acknowledge immediately (Slack requires response within 3 seconds)
  res.sendStatus(200);

  const event = req.body.event;
  if (!event) return;

  // 4. Only handle app_mention events
  if (event.type !== "app_mention") return;

  // 5. Avoid processing duplicate events
  if (processedEvents.has(event.event_ts)) return;
  processedEvents.add(event.event_ts);

  // 6. Remove the bot mention from the message (e.g. "<@U123> hello" → "hello")
  const userMessage = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();

  try {
    // 7. Call Claude API
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: userMessage }],
    });

    const reply = response.content[0].text;

    // 8. Post reply back to Slack in the same thread
    await slack.chat.postMessage({
      channel: event.channel,
      text: reply,
      thread_ts: event.ts, // keeps it in a thread
    });
  } catch (err) {
    console.error("Error:", err);
    await slack.chat.postMessage({
      channel: event.channel,
      text: "Sorry, I ran into an error. Please try again!",
      thread_ts: event.ts,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Bot running on port ${PORT}`));
