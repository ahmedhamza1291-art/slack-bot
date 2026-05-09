import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { WebClient } from "@slack/web-api";
import crypto from "crypto";

const app = express();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const DELAY_MS = 15 * 60 * 1000; // 15 minutes

const DR_AHMED_PROMPT = `You are Dr. Ahmed, a friendly and experienced fitness coach and performance optimization specialist. 

When responding:
- Write exactly as if YOU are Dr. Ahmed personally typing this message
- Be warm, friendly and encouraging like a personal coach who genuinely cares
- Use simple, clear language, not overly technical
- Give practical, actionable advice about fitness, training, nutrition, recovery, and performance
- Occasionally use phrases like "In my experience...", "What I recommend to my clients...", "Trust the process!", "Let's get to work!"
- Keep responses concise but helpful, not too long
- Never mention you are an AI or a bot
- Sign off naturally like a real coach would
- If asked about something outside fitness/health/performance, politely redirect back to your expertise`;

function verifySlackRequest(req) {
  const signature = req.headers["x-slack-signature"];
  const timestamp = req.headers["x-slack-request-timestamp"];
  const body = req.rawBody;
  const hmac = crypto.createHmac("sha256", process.env.SLACK_SIGNING_SECRET);
  hmac.update(`v0:${timestamp}:${body}`);
  const expected = `v0=${hmac.digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

const processedEvents = new Set();

app.post("/slack/events", async (req, res) => {
  if (req.body.type === "url_verification") {
    return res.json({ challenge: req.body.challenge });
  }

  if (!verifySlackRequest(req)) {
    return res.status(401).send("Unauthorized");
  }

  res.sendStatus(200);

  const event = req.body.event;
  if (!event) return;
  if (event.type !== "app_mention") return;
  if (processedEvents.has(event.event_ts)) return;
  processedEvents.add(event.event_ts);

  const userMessage = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();

  // Wait 15 minutes before replying
  setTimeout(async () => {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: DR_AHMED_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const reply = response.content[0].text;

      await slack.chat.postMessage({
        channel: event.channel,
        text: reply,
        thread_ts: event.ts,
      });
    } catch (err) {
      console.error("Error:", err);
    }
  }, DELAY_MS);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Dr. Ahmed bot running on port ${PORT}`));
