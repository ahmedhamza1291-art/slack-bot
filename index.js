import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { WebClient } from "@slack/web-api";
import crypto from "crypto";

const app = express();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const DELAY_MS = 15 * 60 * 1000; // 15 minutes
// Check-in schedule: twice a week (every 3-4 days alternating)
const CHECKIN_INTERVALS = [
  3 * 24 * 60 * 60 * 1000 + Math.floor(Math.random() * 4 * 60 * 60 * 1000), // ~3 days + random hours
  4 * 24 * 60 * 60 * 1000 + Math.floor(Math.random() * 4 * 60 * 60 * 1000), // ~4 days + random hours
];
let checkinIntervalIndex = 0;

const PROGRAM_CONTEXT = `
AMIRIS is a 12-week science-backed performance protocol for executives and high performers.
Phase 1 (Weeks 1-4): HARDWARE — Body: sleep, gut, hormones, bloodwork, nutrition, supplements
Phase 2 (Weeks 5-8): SOFTWARE — Brain: dopamine, focus, ADHD management, neuroplasticity
Phase 3 (Weeks 9-12): SYSTEMS — Architecture: calendar, environment, identity-level habits

Ahmed's role as Fitness Coach:
- Builds each client's personalized training plan, nutrition framework, and supplement stack
- Runs bi-weekly 30-minute 1-on-1 with each client to review and adjust
- Available daily on Slack for fitness and diet questions
- If a question is medical/bloodwork related: defer to Dr. Abdullah on the group call
- If a question is about general program/scheduling: defer to Hannah
`;

const CLIENT_DATA = {
  "raeed-aldossary-private": {
    name: "Raeed",
    fullName: "Raeed Al-Dossary",
    background: "Saudi Arabia, self-development coach, 20+ years in inner awareness and emotional healing",
    goals: "Performance optimization, energy, physical transformation",
    protocol: `
Daily Calories: 1,850 | Protein: 180g | BMR: 1,800 | TDEE: 2,400
Breakfast (750 cal): 4 whole eggs + 250g beef tenderloin OR 300g round eye OR 300g lean ground beef + 200g mixed berries
Lunch (500 cal): 230g beef tenderloin OR 280g rib eye OR 280g lean ground beef + 1 tsp honey + 4 dates
Dinner (500 cal): 230g beef tenderloin OR 280g rib eye OR 280g lean ground beef + 1 medium banana
Morning supplements: Omega-3 EPA (1-2g), Vitamin D3-K2 (5000 IU), Fadogia Agrestis (600mg), Tongkat Ali (400mg), Electrolyte Powder (3-5g in 500ml water), Boron (1 capsule). No coffee for first 90-120 mins.
Pre-workout: Creatine (5g), Coffee optional (150-250mg caffeine)
Evening: Magnesium Threonate/Glycinate (140-350mg), 60-120 mins before bed
Training: Resistance training 3x/week (1-1.5 hrs, full body) + Running 2x/week + 30 min sauna weekly`
  },
  "mariam-al-hammadi-private": {
    name: "Mariam",
    fullName: "Mariam Al-Hammadi",
    background: "UAE, born 1988, working, studying, and building her own brand.",
    goals: "Level up wellbeing — mind, body, life.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "wafaa-khattab-private": {
    name: "Wafaa",
    fullName: "Wafaa Khattab",
    background: "Lebanon, based in Dubai. Arabic language teacher, educational content creator.",
    goals: "Improve quality of life, become 1% better every day.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "nouf-almarri-private": {
    name: "Nouf",
    fullName: "Nouf Almarri",
    background: "Qatar, founder of Banan Ventures.",
    goals: "Performance optimization, identity-rooted growth.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "majed-private": {
    name: "Majed",
    fullName: "Majed Baswied",
    background: "Saudi Arabia, management and operations.",
    goals: "More discipline, consistency, energy, clarity.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "ghadah-abdulrahman-private": {
    name: "Ghadah",
    fullName: "Ghadah Abdulrahman",
    background: "Saudi Arabia, investment attraction, national team weightlifter.",
    goals: "Become a better version of herself.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "abdallah-abdulbasit-alqassimi-private": {
    name: "Abdallah",
    fullName: "Abdallah Abdulbasit AlQassimi",
    background: "26 years old, commercial manager, passionate about health and fitness.",
    goals: "Health, fitness, wellness optimization.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "waseem-alammar-ptivate": {
    name: "Waseem",
    fullName: "Waseem Alammar",
    background: "Saudi Arabia, finance and investment.",
    goals: "Develop physically, mentally, and emotionally.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "reem-aldosari-private": {
    name: "Reem",
    fullName: "Reem Aldosari",
    background: "Qatar, marketing and business, building her own company.",
    goals: "Build stronger foundation for wellbeing.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "loulwa-alshalan-1-1": {
    name: "Loulwa",
    fullName: "Loulwa Alshalan",
    background: "AMIRIS client.",
    goals: "Performance optimization and transformation.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "mohammed-sultan-private": {
    name: "Mohammed",
    fullName: "Mohammed Sultan",
    background: "AMIRIS client.",
    goals: "Performance optimization and transformation.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "private-أحمد-حمود-المقبل": {
    name: "Ahmed",
    fullName: "Ahmed Hamoud Al-Muqbil",
    background: "AMIRIS client.",
    goals: "Performance optimization and transformation.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "هنوف-محمد-احمد-البريكي-private": {
    name: "Hnouf",
    fullName: "Hnouf Mohammed Al-Buraiki",
    background: "AMIRIS client.",
    goals: "Performance optimization and transformation.",
    protocol: "Individual protocol being built based on bloodwork results."
  }
};

function buildSystemPrompt(channelName) {
  const client = CLIENT_DATA[channelName];
  const clientSection = client ? `
YOU ARE SPEAKING WITH: ${client.fullName}
Background: ${client.background}
Goals: ${client.goals}
Their Protocol: ${client.protocol}
` : `General AMIRIS channel.`;

  return `You are Ahmed, the fitness coach in the AMIRIS performance protocol program.
${PROGRAM_CONTEXT}
${clientSection}
HOW TO RESPOND:
- Write as Ahmed personally — warm, direct, like a coach who genuinely knows this client
- Short and natural — like a real text message, not an essay
- Reference their specific goals and protocol when relevant
- Be encouraging: "Trust the process", "Let's dial this in"
- Never mention you are AI or a bot
- If medical/bloodwork question: "That's one for Dr. Abdullah on the group call"
- If scheduling question: "Hannah will sort that in your 1-on-1"`;
}

// ─── CHECK-IN MESSAGES ─────────────────────────────────────────────────────────
// Simple check-ins (sent first of the week)
const simpleCheckIns = [
  (name) => `Hello ${name}!\nhow things are going with you until now`,
  (name) => `Hey ${name}, how has your week been so far?`,
  (name) => `${name}, how are you feeling today?`,
  (name) => `Hey ${name}, how is everything going?`,
  (name) => `${name}, just checking in. How have things been?`,
  (name) => `Hey ${name}, how did your training go this week?`,
  (name) => `${name}, how has your energy been lately?`,
  (name) => `Hey ${name}, how has your sleep been?`,
  (name) => `${name}, how are you doing today?`,
  (name) => `Hey ${name}, any updates on your end?`,
  (name) => `${name}, how is everything looking from your side?`,
  (name) => `Hey ${name}, how has your nutrition been this week?`,
  (name) => `${name}, how are you holding up?`,
  (name) => `Hey ${name}, good to check in. How are things?`,
  (name) => `${name}, how was your weekend?`,
];

// Detailed check-ins (sent second of the week)
const detailedCheckIns = [
  (name) => `${name}, quick check-in for this week:\n\n1. What is your current weight?\n2. From 0 to 10, how would you rate your workout performance this week?\n3. How has your sleep been?`,
  (name) => `Hey ${name}, let's do a quick weekly check-in:\n\n1. Current weight?\n2. Rate your training this week from 0 to 10\n3. How is your energy levels been overall?`,
  (name) => `${name}, end of week check-in:\n\n1. What is your weight right now?\n2. Workout performance this week — 0 to 10?\n3. Anything feeling off or worth flagging?`,
  (name) => `Hey ${name}, checking in properly this week:\n\n1. Current weight?\n2. How would you rate your training — 0 to 10?\n3. How has recovery been?`,
  (name) => `${name}, weekly check-in time:\n\n1. Weight this week?\n2. Training performance — 0 to 10?\n3. How is your nutrition consistency been?`,
  (name) => `Hey ${name}, let's track where you are this week:\n\n1. Current weight?\n2. Rate your workouts this week — 0 to 10?\n3. How are you feeling mentally?`,
  (name) => `${name}, quick update needed:\n\n1. What is the scale saying this week?\n2. Training this week — 0 to 10?\n3. Any challenges you want to talk through?`,
  (name) => `Hey ${name}, check-in time:\n\n1. Current weight?\n2. How did your workouts feel this week — 0 to 10?\n3. How has your sleep quality been?`,
  (name) => `${name}, weekly progress check:\n\n1. Weight right now?\n2. Workout rating this week — 0 to 10?\n3. What is one thing you want to improve next week?`,
  (name) => `Hey ${name}, let's see where we are:\n\n1. Current weight?\n2. Performance in training this week — 0 to 10?\n3. How is your motivation been?`,
  (name) => `${name}, end of week review:\n\n1. What is your current weight?\n2. How would you rate your training — 0 to 10?\n3. How has your energy been throughout the day?`,
  (name) => `Hey ${name}, checking in on your progress:\n\n1. Weight this week?\n2. Training performance — 0 to 10?\n3. How are you managing stress levels?`,
  (name) => `${name}, weekly check-in:\n\n1. Current weight?\n2. Rate your workouts this week — 0 to 10?\n3. How has your digestion and gut been?`,
  (name) => `Hey ${name}, let's track your week:\n\n1. What is the weight right now?\n2. Training this week — 0 to 10?\n3. How is your consistency been with supplements?`,
  (name) => `${name}, progress check:\n\n1. Current weight?\n2. Workout performance — 0 to 10?\n3. How are you feeling overall going into next week?`,
];

let simpleIndex = 0;
let detailedIndex = 0;

// Alternate between simple and detailed check-ins
// Add random offset (0-3 hours) so messages don't always arrive at the same time
async function sendCheckIns(type) {
  const result = await slack.conversations.list({ types: "private_channel", limit: 200 });

  for (const [channelName, client] of Object.entries(CLIENT_DATA)) {
    try {
      const channel = result.channels?.find(c => c.name === channelName);
      if (!channel) continue;

      // Random delay per client (0-30 mins) so messages stagger naturally
      const randomDelay = Math.floor(Math.random() * 30 * 60 * 1000);
      await new Promise(r => setTimeout(r, randomDelay));

      let message;
      if (type === "simple") {
        message = simpleCheckIns[simpleIndex % simpleCheckIns.length](client.name);
        simpleIndex++;
      } else {
        message = detailedCheckIns[detailedIndex % detailedCheckIns.length](client.name);
        detailedIndex++;
      }

      await slack.chat.postMessage({
        channel: channel.id,
        text: message,
      });
    } catch (err) {
      console.error(`Check-in failed for ${channelName}:`, err.message);
    }
  }
}

// Schedule twice a week with different intervals and alternating types
function scheduleNextCheckIn(type) {
  // Random time offset between 1-4 hours so it never feels automated
  const randomHours = Math.floor(Math.random() * 3 + 1) * 60 * 60 * 1000;
  const nextType = type === "simple" ? "detailed" : "simple";
  const baseInterval = type === "simple" ? 3 * 24 * 60 * 60 * 1000 : 4 * 24 * 60 * 60 * 1000;
  const interval = baseInterval + randomHours;

  setTimeout(async () => {
    await sendCheckIns(type);
    scheduleNextCheckIn(nextType);
  }, interval);
}

// Start with simple check-in
scheduleNextCheckIn("simple");

// ─── SERVER ────────────────────────────────────────────────────────────────────
function verifySlackRequest(req) {
  const signature = req.headers["x-slack-signature"];
  const timestamp = req.headers["x-slack-request-timestamp"];
  const body = req.rawBody;
  const hmac = crypto.createHmac("sha256", process.env.SLACK_SIGNING_SECRET);
  hmac.update(`v0:${timestamp}:${body}`);
  const expected = `v0=${hmac.digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf.toString(); }
}));

const processedEvents = new Set();

app.post("/slack/events", async (req, res) => {
  if (req.body.type === "url_verification") {
    return res.json({ challenge: req.body.challenge });
  }
  if (!verifySlackRequest(req)) return res.status(401).send("Unauthorized");
  res.sendStatus(200);

  const event = req.body.event;
  if (!event || event.type !== "app_mention") return;
  if (processedEvents.has(event.event_ts)) return;
  processedEvents.add(event.event_ts);

  const userMessage = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();

  let channelName = "";
  try {
    const channelInfo = await slack.conversations.info({ channel: event.channel });
    channelName = channelInfo.channel?.name || "";
  } catch (e) { console.log("Could not get channel name"); }

  const systemPrompt = buildSystemPrompt(channelName);

  setTimeout(async () => {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      await slack.chat.postMessage({
        channel: event.channel,
        text: response.content[0].text,
        thread_ts: event.ts,
      });
    } catch (err) {
      console.error("Error:", err);
    }
  }, DELAY_MS);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ AMIRIS bot running on port ${PORT}`));
