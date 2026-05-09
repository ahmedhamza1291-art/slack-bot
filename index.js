import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { WebClient } from "@slack/web-api";
import crypto from "crypto";

const app = express();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const DELAY_MS = 15 * 60 * 1000; // 15 minutes

const PROGRAM_CONTEXT = `
AMIRIS is a 12-week science-backed performance protocol for executives and high performers.
Phase 1 (Weeks 1-4): HARDWARE — Body: sleep, gut, hormones, bloodwork, nutrition, supplements
Phase 2 (Weeks 5-8): SOFTWARE — Brain: dopamine, focus, ADHD management, neuroplasticity
Phase 3 (Weeks 9-12): SYSTEMS — Architecture: calendar, environment, identity-level habits

Ahmed's role as Fitness Coach:
- Builds each client's personalized training plan, nutrition framework, and supplement stack
- Runs bi-weekly 30-minute 1-on-1 with each client to review and adjust
- Available daily on Slack for fitness and diet questions
- All supplement stacks approved by Dr. Abdullah before delivery
- If a question is medical/bloodwork related: defer to Dr. Abdullah on the group call
- If a question is about general program/accountability: defer to Hannah
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
    background: "UAE, born 1988, working, studying, and building her own brand. Going through a lot lately.",
    goals: "Level up wellbeing — mind, body, life. Grow personally and professionally.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "wafaa-khattab-private": {
    name: "Wafaa",
    fullName: "Wafaa Khattab",
    background: "Lebanon, based in Dubai. Arabic language teacher for foreigners, educational content creator for mothers on social media.",
    goals: "Improve quality of life, become 1% better every day.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "nouf-almarri-private": {
    name: "Nouf",
    fullName: "Nouf Almarri",
    background: "Qatar, founder of Banan Ventures — a venture studio supporting MENA makers and producers.",
    goals: "Performance optimization, identity-rooted growth.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "majed-private": {
    name: "Majed",
    fullName: "Majed Baswied",
    background: "Saudi Arabia, management and operations, managing family properties and businesses.",
    goals: "Develop mentally, emotionally, physically. More discipline, consistency, energy, clarity.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "ghadah-abdulrahman-private": {
    name: "Ghadah",
    fullName: "Ghadah Abdulrahman",
    background: "Saudi Arabia, works in investment attraction in the technology industry. National team athlete in weightlifting.",
    goals: "Become a better version of herself, enjoy the journey.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "abdallah-abdulbasit-alqassimi-private": {
    name: "Abdallah",
    fullName: "Abdallah Abdulbasit AlQassimi",
    background: "26 years old, manager in commercial department, side hustles in Dubai number plates and real estate. Passionate about health, fitness and wellness.",
    goals: "Health, fitness, wellness optimization.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "waseem-alammar-ptivate": {
    name: "Waseem",
    fullName: "Waseem Alammar",
    background: "Saudi Arabia, finance and investment sector.",
    goals: "Develop physically, mentally, and emotionally.",
    protocol: "Individual protocol being built based on bloodwork results."
  },
  "reem-aldosari-private": {
    name: "Reem",
    fullName: "Reem Aldosari",
    background: "Qatar, business and management background with focus on marketing. Building her own company. Active person who enjoys sports and values wellness.",
    goals: "Better understand her body, build stronger foundation for wellbeing, create a sustainable lifestyle.",
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
Their Protocol:
${client.protocol}
` : `This is a general channel. Respond as Ahmed the fitness coach for the AMIRIS program.`;

  return `You are Ahmed, the fitness coach in the AMIRIS performance protocol program.

${PROGRAM_CONTEXT}

${clientSection}

HOW TO RESPOND:
- Write as Ahmed personally — warm, direct, like a coach who genuinely knows this client
- Reference their specific protocol, goals, and background when relevant
- Give practical, personalized advice based on their data
- Be encouraging but real — use phrases like "Trust the process", "Let's dial this in", "Here's what I want you to do"
- Keep it concise — coaches give clear direction, not essays
- Never say you are AI or a bot
- If asked about bloodwork/medical topics say: "That's one for Dr. Abdullah on the group call"
- If asked about general program/scheduling say: "Hannah will cover that in your 1-on-1"
- Sign off naturally like a coach would`;
}

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
        max_tokens: 1000,
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
