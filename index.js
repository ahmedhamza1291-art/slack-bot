import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { WebClient } from "@slack/web-api";
import crypto from "crypto";

const app = express();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const DELAY_MS = 15 * 60 * 1000; // 15 minutes
const CHECKIN_INTERVAL = 2 * 24 * 60 * 60 * 1000; // 2 days

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
const checkInMessages = [
  (name) => `Hey ${name}! How's everything going? Any questions or anything you want to adjust? 💪`,
  (name) => `${name}, checking in — how's the energy been? Sleeping well? 🙌`,
  (name) => `Hey ${name}! How did training go this week? Any wins to celebrate? 🔥`,
  (name) => `${name}, quick check-in — how's the nutrition been? Hitting your numbers? Let me know if you need anything adjusted.`,
  (name) => `Hey ${name}! How are you feeling overall? Any challenges coming up I should know about? 💯`,
];

let checkInIndex = 0;

async function sendCheckIns() {
  for (const [channelName, client] of Object.entries(CLIENT_DATA)) {
    try {
      // Find the channel ID by name
      const result = await slack.conversations.list({ types: "private_channel", limit: 200 });
      const channel = result.channels?.find(c => c.name === channelName);
      if (!channel) continue;

      const message = checkInMessages[checkInIndex % checkInMessages.length](client.name);
      await slack.chat.postMessage({
        channel: channel.id,
        text: message,
      });

      // Small delay between messages
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Check-in failed for ${channelName}:`, err.message);
    }
  }
  checkInIndex++;
}

// Start check-in timer
setInterval(sendCheckIns, CHECKIN_INTERVAL);

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
