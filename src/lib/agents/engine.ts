import { PLAYBOOK } from "@/lib/agents/playbook";
import type { ReportSpec } from "@/lib/agents/pdf";
import {
  createRecord,
  crmBySlug,
  deleteRecord,
  isLive,
  readAcross,
  readTable,
  saveTraining,
  updateRecord,
} from "@/lib/crm/data";
import {
  askableFields,
  requiredFields,
  tableById,
  tableBySingular,
  type FieldDef,
  type Row,
  type TableDef,
} from "@/lib/crm/schema";
import type { Mind, PendingTask, Specialist, TrainingDoc } from "@/lib/store";
import { useAidyl } from "@/lib/store";
import { engagement } from "@/lib/instagram";
import { answerOperations } from "@/lib/intelligence";
import { fileSpokenCampaign } from "@/lib/campaign-desk";
import { campaignIntent, spokenBrief } from "@/lib/campaigns";
import { formatWhen, parseReminder, scheduleReminder } from "@/lib/reminders";
import { asNumber, cellText, money } from "@/lib/utils";

export type Persona = {
  id: string;
  name: string;
  kind: "randolph" | "maya" | "specialist";
  scope: string | "*";
  brief?: string;
  specialist?: Specialist;
};

export type Turn = {
  text: string;
  aether?: string;
  peer?: { name: string; text: string };
  mind: Mind;
};

const YES = /^(yes|y|yeah|yep|confirm|do it|write it|go ahead|send it|please do|ok|okay|ship it)\b/i;
const NO = /^(no|nope|cancel|stop|never mind|nevermind|abort|drop it)\b/i;
const SUBMIT = /^(submit|that'?s (all|everything)|thats all|skip the rest|write it|looks good|nothing else)\b/i;

async function maybeReminder(persona: Persona, text: string): Promise<string | null> {
  if (!/\b(remind me|set (?:a |an )?reminder|notify me|ping me|alert me|tap me)\b/i.test(text)) return null;
  const parsed = parseReminder(text);
  if (parsed === "when") {
    if (/\b(post|video|milestone|instagram|betterdeal)\b/i.test(text)) {
      return "That's already running. While this desk is open I check @betterdealtv and I'll notify you when a new post or video shows up, and when a public milestone is crossed — followers, posts, likes, or views. If you also want a tap at a specific time, say when. For example: remind me in 2 hours to review the page.";
    }
    return "When should I tap you? Give me a duration or a clock time — “in 30 minutes”, “in 2 hours”, or “tomorrow at 9am” — and what it's about.";
  }
  if (!parsed) return null;
  await scheduleReminder({ title: parsed.title, note: parsed.note, fireAt: parsed.fireAt, createdBy: persona.name });
  return `I'll notify you ${formatWhen(parsed.fireAt)} about “${parsed.title}”. It lands in Activity, and on the phone it also rings. Nothing was written to the books.`;
}

function instagramReply(persona: Persona, text: string): string | null {
  const lower = text.toLowerCase();
  const asks =
    /\b(instagram|youtube|tiktok|betterdealtv\.com|@betterdealtv|betterdeal)\b/.test(lower) &&
    /\b(how|performance|analytics|followers|posts|doing|update|page|video|views|likes|watch|subscribers|report)\b/.test(lower);
  if (!asks) return null;
  if (persona.kind === "maya") {
    return "I don't keep the media pages — I stay on Carshipy. Randolph watches YouTube, Instagram, TikTok, and the site. Say “ask Randolph” if you want his read.";
  }
  const social = useAidyl.getState().socialWatch?.snapshot;
  const snap = useAidyl.getState().igWatch?.snapshot;
  const bits: string[] = [];
  if (social?.youtube) {
    const subs = social.youtube.subscribers == null ? "a subscriber count the page did not show" : `${social.youtube.subscribers.toLocaleString()} subscribers`;
    const videos = social.youtube.videos == null ? "a video count the page did not show" : `${social.youtube.videos.toLocaleString()} public videos`;
    const latest = social.youtube.latest[0];
    bits.push(
      `YouTube @betterdealtv: ${subs}, ${videos}.${latest ? ` Newest public title: “${latest.title}”.` : ""} The public feed does not include view counts, so I am not scoring reach.`,
    );
  }
  if (snap) {
    const stats = engagement(snap);
    const rate = stats.rate == null ? "" : ` Average engagement on the latest ${stats.sample} posts is ${stats.rate.toFixed(1)}% of the follower count.`;
    bits.push(`Instagram @${snap.username}: ${snap.followers.toLocaleString()} followers, ${snap.following.toLocaleString()} following, ${snap.posts.toLocaleString()} posts.${rate}`);
  }
  if (social?.tiktok) {
    bits.push(
      `TikTok @${social.tiktok.username}: ${social.tiktok.followers.toLocaleString()} followers, ${social.tiktok.following.toLocaleString()} following, ${social.tiktok.likes.toLocaleString()} likes, ${social.tiktok.videos.toLocaleString()} videos. Per-video plays were not on the public profile.`,
    );
  }
  if (social?.site) {
    bits.push(`Site: ${social.site.title}. ${social.site.description} ${social.site.pages.length} public guide or watch paths were on the homepage.`);
  }
  if (!bits.length) {
    return "I read BetterDealTV from the public YouTube, Instagram, TikTok, and website pages. I don't have a pull yet. Open that module and I'll keep the counts that those pages actually return. Private Insights stay inside each platform.";
  }
  return `${bits.join(" ")} I only describe what those public pages returned.`;
}

function socialReply(persona: Persona, text: string, operator: string): string | null {
  const who = persona.kind === "maya" ? "Maya" : persona.kind === "specialist" ? persona.name : "Randolph";
  const you = operator && operator.toLowerCase() !== "admin" ? operator : "";
  const nameBit = you ? `, ${you}` : "";
  const lower = text.toLowerCase().replace(/[!?.]+$/g, "").trim();

  if (/^(hi|hello|hey|hiya|yo|good (morning|afternoon|evening)|morning|evening)\b/.test(lower)) {
    if (persona.kind === "maya") {
      return `Hey${nameBit}. I'm with you on Carshipy. We can just talk, or we can look at a buyer if something's moving.`;
    }
    return `Hello${nameBit}. I'm Randolph. Happy to talk, or to walk the companies with you whenever you want the books.`;
  }
  if (
    /how (are|r) (you|u)|how('?s| is) it going|how('?s| is) your day|you (ok|okay|alright|good)\b|what'?s up|how do you feel|how have you been/.test(
      lower,
    )
  ) {
    if (persona.kind === "maya") {
      return `I'm well${nameBit}, thank you. The book is busy in a useful way — buyers, deposits, sailings. How are you holding up?`;
    }
    return `Steady${nameBit}. I keep an eye on the group so you don't have to hold every company at once. How's your day actually going?`;
  }
  if (
    /^(i('?m| am)|im) (fine|good|ok|okay|great|tired|busy|alright|well)/.test(lower) ||
    /^(not bad|pretty good|doing (ok|okay|fine|well)|all good)\b/.test(lower)
  ) {
    return persona.kind === "maya"
      ? `Glad you said. We can stay on that, or I can pull whoever is waiting on a deposit.`
      : `I'm here either way — conversation, or the books, whenever you want to switch.`;
  }
  if (/thank(s| you)|appreciate (it|you)|cheers\b/.test(lower)) {
    return `You're welcome${nameBit}. I'll stay on the line.`;
  }
  if (/^(bye|goodbye|good night|see you|talk later|that'?s all for now)\b/.test(lower)) {
    return `Talk soon${nameBit}. I'll keep this thread.`;
  }
  if (/^(lol|haha|hah|hehe|nice|cool|great|awesome|love it|got it|sure|ok|okay|alright|yep|yeah)\b/.test(lower)) {
    const thread = useAidyl.getState().threads[persona.id] ?? [];
    const last = [...thread].reverse().find((item) => item.role === "agent" && item.text && !item.text.startsWith("…"));
    const bit = last?.text.split(/(?<=\.)\s/)[0];
    if (bit && bit.length > 12) {
      if (/cp-[a-z0-9]+/i.test(last.text)) {
        return persona.kind === "maya"
          ? `Good. That proposal stays on Campaigns until you approve it. I still have not contacted anyone.`
          : `Good. I'm holding that proposal on Campaigns. Approving it is still yours, and nothing has been published.`;
      }
      return persona.kind === "maya"
        ? `Good. I'll stay with that, then: ${bit} If you want it as a campaign instead of a note, say so and I'll file the proposal.`
        : `Alright. The part I'm holding is this: ${bit} Tell me if you want that turned into a campaign, or if we should keep talking it through.`;
    }
    return persona.kind === "maya"
      ? `I'm with you. Say the buyer's name, or describe the campaign, and I'll work from that instead of guessing.`
      : `I'm with you. Give me the company, the place, or the campaign you have in mind and I'll answer that, not a stock line.`;
  }
  if (/joke|make me laugh|something funny/.test(lower)) {
    return persona.kind === "maya"
      ? `A buyer once put their whole instruction manual in the credit field. I still have the row. The lesson stuck: one human question at a time.`
      : `The companies argue about who owns a truck until someone writes the lead id down. It stops being funny the moment Aether files it.`;
  }
  if (/who am i|what('?s| is) my name|do you know me/.test(lower)) {
    return you
      ? `You're ${you} on this desk. Change Signing as if you'd rather I use another name.`
      : `You're signed in as Admin. Put your name in Signing as and I'll use it.`;
  }
  if (/what('?s| is) your name|who are you/.test(lower)) {
    return `I'm ${who}. ${
      persona.kind === "maya"
        ? "I stay with Carshipy — the buyers, the money, and the sailings."
        : "I look across every Aidyl company, and I'll ask Maya when a question is really hers."
    } Aether is the one who actually writes a row. We can talk like this any time.`;
  }
  if (/who (is|are) aether|what does aether/.test(lower)) {
    return `Aether doesn't make small talk. He is the one who creates, updates, and deletes, and he writes the log. I stay with you until the record is complete, then he files it.`;
  }
  if (/what'?s new|anything new|what have you been/.test(lower)) {
    return persona.kind === "maya"
      ? `The book moves every day${nameBit}. Want the pipeline in one breath, or shall we just talk?`
      : `Quiet until you ask${nameBit}. I can brief the companies, or we can stay right here.`;
  }
  if (/can we (just )?talk|let'?s (just )?talk|just chatting|small talk|talk to me/.test(lower)) {
    return `Of course${nameBit}. I'm not only the books. What's actually on your mind?`;
  }
  if (/^(sorry|my bad|apologies)\b/.test(lower)) {
    return `No harm. Take your time.`;
  }
  if (/nice to meet|good to (see|meet) you|pleasure/.test(lower)) {
    return `Likewise${nameBit}. I'll be on this desk whenever you are.`;
  }
  if (/how (do you|can i) (train|teach)|where (is|do i) train|training section|teach you/.test(lower)) {
    return `Hit Train in this chat, or open the studio from the top of the desk. Write the rule in plain language and pick who should learn it. Or just say “remember that …” and I'll keep it.`;
  }
  if (/^(what can you do|help|capabilities)\b/.test(lower)) {
    return persona.kind === "maya"
      ? `We can talk, look up a buyer, walk a shipment, or file a campaign from a sentence you actually say. If you tell me who it is for and what the line should say, I will put the proposal on Campaigns. I will not call them from this chat. Train is there when you want a rule remembered.`
      : `Talk to me like a chief of staff. I can brief the companies, ask Maya about Carshipy, draft a report, or turn a brief you describe into a campaign proposal. Approving that proposal is still yours — I do not publish it here. Teach either of us from Train.`;
  }
  return null;
}

function personaVoice(p: Persona) {
  if (p.kind === "maya") return "Maya";
  if (p.kind === "specialist") return p.name;
  return "Randolph";
}

function allows(p: Persona, slug: string) {
  if (p.scope === "*") return true;
  return p.scope === slug;
}

function knowledgeFor(p: Persona, docs: TrainingDoc[]) {
  return docs.filter((d) => {
    if (p.kind === "maya") return d.agent === "maya" || d.agent === "both";
    if (p.kind === "specialist") return true;
    return d.agent === "randolph" || d.agent === "both";
  });
}

async function rowsFor(persona: Persona, crm: string, table: string) {
  if (persona.scope === "*" && (crm === "*" || crm === "all")) {
    return readAcross(table);
  }
  const slug = persona.scope === "*" ? crm : persona.scope;
  const rows = await readTable(slug, table);
  const name = crmBySlug(slug)?.name ?? slug;
  return rows.map((row) => ({ crm: slug, crmName: name, row }));
}

function findLeads(list: { crm: string; crmName: string; row: Row }[], q: string) {
  const n = q.trim().toLowerCase();
  return list.filter(({ row }) => {
    const name = String(row.name ?? "").toLowerCase();
    const id = String(row.lead_id ?? "").toLowerCase();
    const email = String(row.email ?? "").toLowerCase();
    return id === n || email === n || name === n || (n.length > 2 && (name.includes(n) || n.includes(name)));
  });
}

function fieldByText(table: TableDef, word: string): FieldDef | undefined {
  const w = word.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return table.fields.find((f) => {
    const key = f.key.toLowerCase();
    const label = f.label.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return key === w || label === w || label.includes(w) || w.includes(label);
  });
}

function grabLabeled(text: string, table: TableDef) {
  const found: Record<string, string> = {};
  const parts = text.split(/\n|;|\|/);
  for (const field of table.fields) {
    if (!field.ask) continue;
    const labels = [field.label, field.key.replace(/_/g, " ")];
    for (const label of labels) {
      const re = new RegExp(`(?:^|,)\\s*${label}\\s*(?:is|:|=)\\s*([^,\\n]+)`, "i");
      const m = text.match(re);
      if (m?.[1]) found[field.key] = m[1].trim();
    }
  }
  for (const part of parts) {
    const m = part.match(/^\s*([a-z][a-z0-9 _-]{1,30})\s*[:=]\s*(.+)$/i);
    if (!m) continue;
    const field = fieldByText(table, m[1]);
    if (field?.ask) found[field.key] = m[2].trim();
  }
  return found;
}

function shipmentHints(text: string) {
  const out: Record<string, string> = {};
  const lead = text.match(/\b(?:for|lead)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
  if (lead) out.lead_id = lead[1];
  const from = text.match(/\bfrom\s+([A-Za-z][^,.]{2,40}?)(?=\s+to\b|,|\.|$)/i);
  if (from) out.origin_location = from[1].trim();
  const to = text.match(/\bto\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (to) out.destination_country = to[1];
  const line = text.match(/\b(?:on|line|with)\s+([A-Z][\w&.-]+(?:\s+[A-Z][\w&.-]+)?)/);
  if (line && !/^(Aisha|The|This|That)/.test(line[1])) out.shipping_line = line[1];
  const vessel = text.match(/\bvessel\s+([^,.]{2,40})/i);
  if (vessel) out.vessel_name = vessel[1].trim();
  const status = text.match(/\bstatus\s+([A-Za-z ]{3,30})/i);
  if (status) out.shipment_status = status[1].trim();
  const dep = text.match(/\b(?:depart(?:s|ure)?|sails?)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (dep) out.departure_date = dep[1];
  const arr = text.match(/\b(?:arriv(?:es|al)?)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (arr) out.arrival_date = arr[1];
  const port = text.match(/\bport\s+(?:of\s+)?([A-Za-z ]{3,30})/i);
  if (port) out.port_used = port[1].trim();
  const ocean = text.match(/\b(?:ocean|freight)\s+\$?([\d,]+)/i);
  if (ocean) out.ocean_freight_cost = ocean[1].replace(/,/g, "");
  const inland = text.match(/\binland\s+\$?([\d,]+)/i);
  if (inland) out.inland_transport_cost = inland[1].replace(/,/g, "");
  return out;
}

function leadHints(text: string) {
  const out: Record<string, string> = {};
  const named = text.match(/\b(?:named|called)\s+([A-Za-z][A-Za-z .'-]{1,40})/i);
  if (named) out.name = named[1].trim();
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) out.email = email[0];
  const phone = text.match(/\+?\d[\d\s().-]{7,}\d/);
  if (phone) out.phone = phone[0].trim();
  return out;
}

function applySums(table: TableDef, values: Record<string, string>) {
  const next = { ...values };
  if (table.id !== "tbl_shipment" && table.id !== "tbl_logistics") return next;
  if (next.total_logistics_cost) return next;
  const keys =
    table.id === "tbl_shipment"
      ? ["ocean_freight_cost", "inland_transport_cost"]
      : ["ocean_freight_cost", "inland_transport_cost", "clearance_cost", "insurance_cost", "other_fees"];
  const nums = keys.map((k) => asNumber(next[k])).filter((n): n is number => n != null);
  if (nums.length >= 1 && keys.some((k) => next[k])) {
    next.total_logistics_cost = String(nums.reduce((a, b) => a + b, 0));
  }
  return next;
}

function missingRequired(table: TableDef, values: Record<string, string>) {
  return requiredFields(table).filter((f) => !values[f.key]);
}

function missingOptional(table: TableDef, values: Record<string, string>) {
  return askableFields(table).filter((f) => !f.required && !values[f.key]);
}

function summary(table: TableDef, values: Record<string, string>) {
  return askableFields(table)
    .map((f) => `${f.label}: ${values[f.key] || "not set"}`)
    .join("\n");
}

function knownPhrase(table: TableDef, values: Record<string, string>) {
  const bits = table.fields.filter((f) => f.ask && values[f.key]).slice(0, 4).map((f) => `${f.label.toLowerCase()} ${values[f.key]}`);
  return bits.length ? `I've got ${bits.join(", ")}. ` : "";
}

async function resolveLeadField(
  persona: Persona,
  crm: string,
  raw: string,
): Promise<{ id?: string; error?: string; matches?: { id: string; label: string }[] }> {
  const list = await rowsFor(persona, crm, "tbl_leads");
  if (/^lead[-_a-z0-9]+$/i.test(raw.trim()) || /^[a-z]+-\d+$/i.test(raw.trim())) {
    const exact = list.find((r) => String(r.row.lead_id).toLowerCase() === raw.trim().toLowerCase());
    if (exact) return { id: String(exact.row.lead_id) };
  }
  const hits = findLeads(list, raw);
  if (hits.length === 1) return { id: String(hits[0].row.lead_id) };
  if (hits.length > 1) {
    return {
      matches: hits.slice(0, 6).map((h) => ({
        id: String(h.row.lead_id),
        label: `${h.row.name ?? "Unnamed"} · ${h.row.lead_id} · ${h.crmName}`,
      })),
    };
  }
  return { error: `I can't find a lead called “${raw}”. Another name, or the id if you have it?` };
}

function scoreText(q: string, text: string) {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const hay = text.toLowerCase();
  return words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
}

function advise(persona: Persona, text: string, docs: TrainingDoc[]) {
  const docsHit = knowledgeFor(persona, docs)
    .map((d) => ({ d, s: scoreText(text, `${d.title} ${d.body}`) }))
    .sort((a, b) => b.s - a.s)[0];
  const book = PLAYBOOK.filter((p) => p.agents.includes(persona.kind === "maya" ? "maya" : "randolph"))
    .map((p) => ({
      p,
      s: scoreText(text, `${p.title} ${p.keys.join(" ")} ${p.body}`) + (p.keys.some((k) => text.toLowerCase().includes(k)) ? 2 : 0),
    }))
    .sort((a, b) => b.s - a.s)[0];
  const bits: string[] = [];
  if (persona.brief) bits.push(persona.brief);
  if (docsHit && docsHit.s >= 2) bits.push(docsHit.d.body);
  if (book && book.s >= 2) bits.push(book.p.body);
  if (!bits.length) return null;
  const who = persona.kind === "maya" ? "On Carshipy I treat it like this." : "Before I ask anyone to act, this is the rule I use.";
  return `${who}\n\n${bits.join("\n\n")}\n\nIf you want that written up as a campaign, say who it is for and I'll file the proposal. I will not publish it from this chat.`;
}

async function summarize(persona: Persona, crm: string) {
  const leads = await rowsFor(persona, crm, "tbl_leads");
  const ships = await rowsFor(persona, crm, "tbl_shipment");
  const fins = await rowsFor(persona, crm, "tbl_financing");
  const budgets = leads.map((l) => asNumber(l.row.budget)).filter((n): n is number => n != null);
  const stages = new Map<string, number>();
  for (const l of leads) {
    const s = String(l.row.stage ?? "unset");
    stages.set(s, (stages.get(s) ?? 0) + 1);
  }
  const stageLine = [...stages.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => `${k} (${v})`)
    .join(", ");
  const rates = fins.map((f) => asNumber(f.row.interest_rate)).filter((n): n is number => n != null);
  const avg = rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2) : "n/a";
  const pipe = budgets.reduce((a, b) => a + b, 0);
  const where = crm === "*" || crm === "all" ? "across the companies" : `at ${crmBySlug(crm)?.name ?? crm}`;
  return `Looking at ${where}: ${leads.length} leads. The stages I see most are ${stageLine || "still empty"}. Numeric pipeline is about ${money(pipe)}. ${ships.length} shipments on the books, and the lenders I can price average ${avg}%. Want me to go into any of that?`;
}

function hotLeads(list: { crm: string; crmName: string; row: Row }[]) {
  return list.filter(({ row }) => {
    const blob = `${cellText(row.statuses)} ${cellText(row.stage)}`.toLowerCase();
    return blob.includes("hot") || blob.includes("deposit");
  });
}

async function buildReport(persona: Persona, crm: string, kind: string, operator: string): Promise<ReportSpec> {
  if (crm === "betterdealtv") {
    const { mediaPublicSection } = await import("@/lib/media-report");
    const leadTable = tableById("tbl_leads");
    const data = leadTable ? await rowsFor(persona, crm, "tbl_leads") : [];
    const sections: ReportSpec["sections"] = [];
    if (leadTable) {
      sections.push({
        heading: "Leads",
        columns: ["Company", ...leadTable.fields.slice(0, 6).map((f) => f.label)],
        rows: data.slice(0, 40).map(({ crmName, row }) => [crmName, ...leadTable.fields.slice(0, 6).map((f) => cellText(row[f.key]))]),
      });
    }
    sections.push(mediaPublicSection());
    return {
      title: "BetterDealTV · media report",
      subtitle: "Public accounts and any media leads in this workspace. Shipments, financing, ports, and logistics are not part of BetterDealTV.",
      preparedBy: operator,
      agent: personaVoice(persona),
      notes: "Counts are what the public pages showed. Reach, impressions, and other platforms' private insights are not in this file.",
      sections,
    };
  }
  const want =
    kind === "business" || kind === "all"
      ? ["tbl_leads", "tbl_shipment", "tbl_logistics", "tbl_financing", "tbl_ports"]
      : [tableBySingular(kind)?.id ?? "tbl_leads"];
  const sections = [];
  for (const id of want) {
    const table = tableById(id);
    if (!table) continue;
    const data = await rowsFor(persona, crm, id);
    const cols = ["Company", ...table.fields.slice(0, 6).map((f) => f.label)];
    const body = data.slice(0, 40).map(({ crmName, row }) => [crmName, ...table.fields.slice(0, 6).map((f) => cellText(row[f.key]))]);
    sections.push({ heading: table.label, columns: cols, rows: body });
  }
  const scopeName = crm === "*" || crm === "all" ? "Aidyl Systems" : crmBySlug(crm)?.name ?? crm;
  return {
    title: `${scopeName} · ${kind} report`,
    subtitle: `Cut prepared for the operating desk. ${isLive(crm) || crm === "*" ? "Carshipy figures are live from DynamoDB." : "Workspace figures are local to this desk."}`,
    preparedBy: operator,
    agent: personaVoice(persona),
    notes: "Measured rows are listed below. Maya stays on Carshipy. Randolph can include the other modules. Aether did not change any rows to produce this file. Interpretation is separate from the table figures.",
    sections,
  };
}

export async function respond(input: {
  persona: Persona;
  text: string;
  crm: string;
  mind: Mind;
  operator: string;
  training: TrainingDoc[];
  depth?: number;
}): Promise<Turn> {
  const text = input.text.trim();
  const persona = input.persona;
  const depth = input.depth ?? 0;
  const mind: Mind = input.mind ?? {};

  if (!text) return { text: "I missed that. Say it once more?", mind };

  if (mind.pending && NO.test(text)) {
    return { text: "Alright, I'll leave that alone. Nothing was written.", mind: {} };
  }

  if (mind.pending) return continuePending(input, text);

  if (mind.campaign) return continueCampaignTalk(input, text);

  if (NO.test(text)) return { text: "Nothing in flight. What's on your mind?", mind };

  const lower = text.toLowerCase();
  const ops = await answerOperations(text);
  if (ops) return { text: ops, mind };

  const social = socialReply(persona, text, input.operator);
  if (social) return { text: social, mind };

  const consult = text.match(/\b(?:ask|tell|consult|loop in|hand(?: this)? to|what would|what does)\s+(maya|randolph)\b[:\s,-]*(.*)$/i);
  if (consult && depth < 1) {
    const who = consult[1].toLowerCase();
    const rest = consult[2]?.trim() || text;
    if (persona.kind === "maya" && who === "maya") return { text: "That's me. Ask it straight.", mind };
    if (persona.kind === "randolph" && who === "randolph") return { text: "I'm already here. What's the question?", mind };
    if (who === "maya") {
      const peer = await respond({
        ...input,
        persona: { id: "maya", name: "Maya", kind: "maya", scope: "carshipy" },
        text: rest,
        crm: "carshipy",
        mind: {},
        depth: depth + 1,
      });
      return {
        text: "I checked with Maya. She keeps the Carshipy book, so I left the question with her.",
        peer: { name: "Maya", text: peer.text },
        mind,
      };
    }
    const peer = await respond({
      ...input,
      persona: { id: "randolph", name: "Randolph", kind: "randolph", scope: "*" },
      text: rest,
      crm: "*",
      mind: {},
      depth: depth + 1,
    });
    return { text: "Randolph has the wider view. This is what he said.", peer: { name: "Randolph", text: peer.text }, mind };
  }

  const reminder = await maybeReminder(persona, text);
  if (reminder) return { text: reminder, mind };

  if (campaignIntent(text) && (persona.kind === "maya" || persona.kind === "randolph")) return startCampaignTalk(input, text);

  const instagram = instagramReply(persona, text);
  if (instagram) return { text: instagram, mind };

  if (persona.kind === "maya" && /\b(betterdeal|tiktok|youtube|associate logistics)\b/i.test(lower)) {
    return {
      text: "That one isn't mine — I stay on Carshipy. Randolph watches BetterDealTV and Associate Logistics. Say “ask Randolph” and I'll hand it over.",
      mind,
    };
  }

  if (/^(remember|learn this|note that|train)\b/i.test(lower) || /\bremember that\b/i.test(lower)) {
    const body = text.replace(/^(please\s+)?(remember( that)?|learn this|note that|train)\s*:?\s*/i, "").trim();
    if (body.length < 8) return { text: "Tell me the rule in a sentence. I'll keep it.", mind };
    const title = body.split(/[.!?]/)[0].slice(0, 80);
    const agent = persona.kind === "maya" ? "maya" : "randolph";
    await saveTraining({ agent, title, body });
    return {
      text: `I'll remember that. Next time it comes up, I'll use it. You can also edit it under Train.`,
      aether: "Aether filed that note in tbl_maya.",
      mind,
    };
  }

  if (/\b(pdf|report|export)\b/i.test(lower)) {
    let kind = "business";
    if (/lead/.test(lower)) kind = "lead";
    else if (/ship/.test(lower)) kind = "shipment";
    else if (/logistic/.test(lower)) kind = "logistics";
    else if (/financ|partner|lender/.test(lower)) kind = "financing";
    else if (/port/.test(lower)) kind = "port";
    else if (/whole|business|everything|all companies|master/.test(lower)) kind = "business";
    const scope = persona.scope === "*" && /\b(all|every|master|aidyl|business)\b/i.test(lower) ? "*" : input.crm === "*" ? "*" : input.crm;
    if (!allows(persona, scope === "*" ? "carshipy" : scope) && scope !== persona.scope) {
      return { text: "I can only report the company I sit on.", mind };
    }
    const { publishReport } = await import("@/lib/reports");
    const spec = await buildReport(persona, persona.scope === "*" ? scope : persona.scope, kind, input.operator);
    const moduleName = scope === "*" ? "all" : scope;
    await publishReport(spec, moduleName);
    return { text: `The report is downloading — ${spec.title}. I didn't change any records to make it.`, mind };
  }

  if (/\b(how many|count|number of)\b/i.test(lower) || /\b(pipeline|overview|how are we|summarize|summary|status of)\b/i.test(lower)) {
    const tableWord = lower.match(/\b(leads?|shipments?|ports?|calls?|partners?|financing|logistics)\b/);
    if (tableWord && /\b(how many|count|number of)\b/i.test(lower)) {
      const table = tableBySingular(tableWord[1]);
      if (table) {
        const data = await rowsFor(persona, persona.scope === "*" ? input.crm : persona.scope, table.id);
        const where = input.crm === "*" ? "across the companies I can see" : "on this desk";
        return { text: `I've got ${data.length} ${table.label.toLowerCase()} ${where}.`, mind };
      }
    }
    return { text: await summarize(persona, persona.scope === "*" ? input.crm : persona.scope), mind };
  }

  if (/\b(hot leads?|who(?:'s| is) waiting|deposit)\b/i.test(lower) && !/\b(add|create|update|delete)\b/i.test(lower)) {
    const leads = await rowsFor(persona, persona.scope === "*" ? input.crm : persona.scope, "tbl_leads");
    const hot = hotLeads(leads).slice(0, 8);
    if (!hot.length) return { text: "Nobody's tagged hot or sitting on a deposit right now.", mind };
    const lines = hot.map((h) => `${h.row.name ?? "Unnamed"} — ${h.row.stage ?? "no stage"} (${h.crmName})`);
    return { text: `These are the ones I'd call first:\n${lines.join("\n")}`, mind };
  }

  const find = text.match(/\b(?:find|look up|lookup|search|who is|show me)\s+(.+)/i);
  if (find) {
    const q = find[1].replace(/\?$/, "").trim();
    const leads = await rowsFor(persona, persona.scope === "*" ? input.crm : persona.scope, "tbl_leads");
    const hits = findLeads(leads, q);
    if (!hits.length) {
      const ships = await rowsFor(persona, persona.scope === "*" ? input.crm : persona.scope, "tbl_shipment");
      const shipHits = ships.filter((s) => cellText(s.row).toLowerCase().includes(q.toLowerCase())).slice(0, 5);
      if (!shipHits.length) return { text: `I looked, and nothing matched “${q}”.`, mind };
      return {
        text: shipHits
          .map((s) => `${s.row.shipment_id} going to ${s.row.destination_country ?? "an unset country"}, status ${s.row.shipment_status ?? "unset"}, lead ${s.row.lead_id}`)
          .join("\n"),
        mind,
      };
    }
    const lines = hits.slice(0, 5).map((h) => {
      const r = h.row;
      return `${r.name} (${r.lead_id}) is in ${r.location ?? "an unset city"}, wants ${r.preferredVehicle ?? "a vehicle we haven't named"}, stage ${r.stage ?? "unset"}, budget ${cellText(r.budget)}. That's ${h.crmName}.`;
    });
    return { text: lines.join("\n\n"), mind };
  }

  const list = text.match(/\b(?:list|show)\s+(?:all\s+)?(?:the\s+)?(hot\s+|active\s+)?(leads|shipments|ports|calls|financing|partners|logistics)\b/i);
  if (list) {
    const table = tableBySingular(list[2]);
    if (table) {
      let data = await rowsFor(persona, persona.scope === "*" ? input.crm : persona.scope, table.id);
      if (list[1]?.includes("hot")) data = hotLeads(data);
      if (list[1]?.includes("active")) {
        data = data.filter(
          (d) =>
            String(d.row.active_status ?? d.row.shipment_status ?? "").toLowerCase().includes("active") ||
            String(d.row.active_status ?? "") === "Active",
        );
      }
      const lines = data.slice(0, 12).map((d) => {
        const label = d.row.name || d.row.partner_name || d.row.port_name || d.row.shipment_number || d.row[table.pk];
        return `${label} · ${d.row[table.pk]} · ${d.crmName}`;
      });
      return { text: lines.length ? `Here's what I have:\n${lines.join("\n")}` : `Nothing in ${table.label.toLowerCase()} yet.`, mind };
    }
  }

  const create = text.match(/\b(?:add|create|new|open|book)\b(?:\s+a)?(?:\s+new)?\s+(lead|shipment|port|financing partner|financing|partner|logistics(?: record)?|call)\b/i);
  if (create) {
    const table = tableBySingular(create[1].replace(" partner", ""));
    if (!table) return { text: "A lead, a shipment, a port, financing, logistics, or a call?", mind };
    const slug = persona.scope === "*" ? (input.crm === "*" ? "carshipy" : input.crm) : persona.scope;
    if (!allows(persona, slug)) return { text: "That desk isn't mine.", mind };
    let values: Record<string, string> = { ...grabLabeled(text, table) };
    if (table.id === "tbl_shipment") values = { ...shipmentHints(text), ...values };
    if (table.id === "tbl_leads") values = { ...leadHints(text), ...values };
    if (values.lead_id && table.pk !== "lead_id") {
      const resolved = await resolveLeadField(persona, slug, values.lead_id);
      if (resolved.id) values.lead_id = resolved.id;
      else if (resolved.matches) {
        const pending: PendingTask = {
          kind: "create",
          table: table.id,
          crm: slug,
          values,
          phase: "collect",
          asking: "lead_id",
          matches: resolved.matches,
        };
        return {
          text: `A few people match. Which one?\n${resolved.matches.map((m, i) => `${i + 1}. ${m.label}`).join("\n")}`,
          mind: { pending },
        };
      }
    }
    return kickoffCollect(persona, table, slug, values);
  }

  const update = text.match(/\b(?:update|change|set)\b\s+(.+)/i);
  if (update) return startUpdate(persona, input.crm, text);

  const del = text.match(/\b(?:delete|remove)\b\s+(?:the\s+)?(?:a\s+)?(lead|shipment|port|financing partner|financing|partner|logistics(?: record)?|call)?\s*(.*)/i);
  if (del && del[0].length > 8) return startDelete(persona, input.crm, del[1], del[2] || text);

  if (/\b(average|rate|interest)\b/i.test(lower)) {
    const fins = await rowsFor(persona, persona.scope === "*" ? input.crm : persona.scope, "tbl_financing");
    const rates = fins
      .map((f) => ({ name: String(f.row.partner_name ?? f.row.financing_id), rate: asNumber(f.row.interest_rate) }))
      .filter((f) => f.rate != null);
    if (!rates.length) return { text: "I don't have numeric rates on this desk yet.", mind };
    const avg = rates.reduce((a, b) => a + (b.rate ?? 0), 0) / rates.length;
    return {
      text: `The average rate I can see is ${avg.toFixed(2)}% across ${rates.length} partners.\n${rates.map((r) => `${r.name}: ${r.rate}%`).join("\n")}`,
      mind,
    };
  }

  if (/\b(risk|what could go wrong|what should i watch|worried)\b/i.test(lower) && !campaignIntent(text)) {
    const snap = await summarize(persona, persona.scope === "*" ? input.crm : persona.scope);
    const voice =
      persona.kind === "maya"
        ? `The risk I actually worry about is a late stage with a thin row: someone asks for a deposit before the vehicle, the place, and the budget are written down. I won't invent a failure rate.`
        : `The risk across the group is treating a public count, or a stage name, as if it were a promise. Carshipy is the live book. BetterDealTV only shows what the public pages return.`;
    return { text: `${voice}\n\n${snap}\n\nIf you want a campaign aimed at the thin rows, tell me who it is for and I'll file it.`, mind };
  }

  const trained = advise(persona, text, input.training);
  if (trained) return { text: trained, mind };

  const looksData = /\b(lead|shipment|port|budget|nigeria|ghana|savannah|finance|logistic)\b/i.test(lower);
  if (looksData && !campaignIntent(text)) {
    const snap = await summarize(persona, persona.scope === "*" ? input.crm : persona.scope);
    const heard = text.length > 160 ? `${text.slice(0, 160)}…` : text;
    return {
      text: `I took that as a question about the book, not a campaign yet. You said: “${heard}”\n\n${snap}\n\nIf you wanted a proposal instead, say “make that a campaign” and name who it is for. I'll file it and leave it for you to approve.`,
      mind,
    };
  }

  const heard = text.length > 180 ? `${text.slice(0, 180)}…` : text;
  const you = input.operator && input.operator.toLowerCase() !== "admin" ? input.operator : "";
  return {
    text:
      persona.kind === "maya"
        ? `${you ? `${you}, ` : ""}I don't want to answer that with a stock line. You said: “${heard}”\n\nOn my side that can mean a buyer, a deposit, a sailing, or a campaign. Tell me which, and if it's a campaign I'll write the proposal from your words and from the Carshipy rows I can actually see. I won't contact anyone from this chat.`
        : `${you ? `${you}, ` : ""}I'm not going to pretend that was a report request. You said: “${heard}”\n\nI can brief the companies, ask Maya to read Carshipy, or turn what you just said into a campaign proposal. Say which. A campaign stays a proposal until you approve it. Nothing is published from the chat.`,
    mind,
  };
}

async function countForPlace(place: string) {
  const leads = await readTable("carshipy", "tbl_leads").catch(() => [] as Row[]);
  const ships = await readTable("carshipy", "tbl_shipment").catch(() => [] as Row[]);
  const needle = place.toLowerCase();
  const leadHits = needle
    ? leads.filter((row) => `${row.location ?? ""} ${row.preferredVehicle ?? ""} ${row.name ?? ""} ${row.notes ?? ""}`.toLowerCase().includes(needle)).length
    : 0;
  const shipHits = needle
    ? ships.filter((row) => `${row.destination_country ?? ""} ${row.destination_port ?? ""} ${row.origin_location ?? ""}`.toLowerCase().includes(needle)).length
    : 0;
  return { leads: leads.length, ships: ships.length, leadHits, shipHits };
}

async function fileTalk(
  input: { persona: Persona; text: string; mind: Mind },
  brief: { title: string; audience: string; message: string; place: string },
): Promise<Turn> {
  const maya = input.persona.kind === "maya";
  const message = brief.message.trim().slice(0, 400);
  const counts = await countForPlace(brief.place);
  const place = brief.place;
  const leadNoun = counts.leadHits === 1 ? "lead" : "leads";
  const shipNoun = counts.shipHits === 1 ? "shipment" : "shipments";
  const evidence = [
    `You said: ${input.text.slice(0, 280)}`,
    place
      ? `Carshipy book: ${counts.leadHits} ${leadNoun} mention ${place}, and ${counts.shipHits} ${shipNoun} list ${place}. ${counts.leads} leads and ${counts.ships} shipments are on the book in total.`
      : `No place was named. The book has ${counts.leads} leads and ${counts.ships} shipments. This proposal is from the conversation, not from a counted segment.`,
    "No reach, impressions, conversion rate, CAC, ROAS, or revenue was estimated.",
  ];
  const why = place
    ? `You asked in conversation about ${place}. Those counts are rows that mention it, not a forecast.`
    : "You asked in conversation. No place was named, so this is not tied to a counted segment.";
  const prior = new Set(useAidyl.getState().campaigns.map((item) => item.cp_id));
  const saved = await fileSpokenCampaign({
    analyst: maya ? "maya" : "randolph",
    title: brief.title,
    audience: brief.audience,
    message,
    why,
    evidence,
  });
  const created = !prior.has(saved.cp_id);
  const voice = maya
    ? "I wrote this as a Carshipy proposal, not a promise to a buyer."
    : "I took what you said as a campaign, not a side comment.";
  if (!created) {
    return {
      text: `${voice} “${saved.title}” is already on Campaigns as ${saved.cp_id}. I did not file it twice.\n\nAudience: ${saved.audience}\nLine: ${saved.message.slice(0, 180)}\n\nIt is still a proposal. I did not call anyone, publish it, or spend anything.`,
      mind: {},
    };
  }
  const countLine = place
    ? `On the book I can see ${counts.leadHits} ${leadNoun} mentioning ${place} and ${counts.shipHits} ${shipNoun} listing ${place}, out of ${counts.leads} leads and ${counts.ships} shipments.`
    : `I did not pin this to one place. The book currently has ${counts.leads} leads and ${counts.ships} shipments, and I did not invent a segment.`;
  return {
    text: `${voice}\n\n${countLine}\nAudience: ${saved.audience}\nWhat it should say: ${message.slice(0, 220)}\n\nI filed “${saved.title}” as ${saved.cp_id}. The forecast stays labelled insufficient until you record a real result. It is on Campaigns for you to approve, refuse, or rewrite. Approving it still does not publish it, contact anyone, or spend money.`,
    mind: {},
  };
}

async function startCampaignTalk(input: { persona: Persona; text: string; mind: Mind }, text: string): Promise<Turn> {
  const brief = spokenBrief(text);
  const maya = input.persona.kind === "maya";
  if (brief.thin) {
    return {
      text: maya
        ? "I can write that. Who is it for — a place, a stage, or the buyers you have in mind? One line is enough. I will not contact them."
        : "I can file that as a proposal. Who should it speak to? Name a place, a company, or the people you mean. I will not publish it from this chat.",
      mind: {
        campaign: { title: brief.title, audience: "", message: "", place: brief.place, waiting: "audience" },
      },
    };
  }
  return fileTalk(input, brief);
}

async function continueCampaignTalk(input: { persona: Persona; text: string; mind: Mind }, text: string): Promise<Turn> {
  const talk = input.mind.campaign;
  if (!talk) return { text: "I lost the brief. Say it again and I'll start clean.", mind: {} };
  if (NO.test(text) || /\b(forget it|drop the campaign|leave it)\b/i.test(text)) {
    return {
      text: input.persona.kind === "maya" ? "Dropped. I didn't file a campaign, and I didn't write to a lead." : "Dropped. No proposal, and nothing was published.",
      mind: {},
    };
  }
  if (talk.waiting === "audience") {
    const next = spokenBrief(text);
    const audience = (next.audience || text.trim()).slice(0, 240);
    const place = next.place || talk.place;
    const hasLine = text.trim().length > 48 || /\b(tell|say|warn|never|don't|do not|message|line|pay)\b/i.test(text);
    if (hasLine) {
      const filed = spokenBrief(text);
      return fileTalk(input, {
        title: filed.thin ? talk.title : filed.title,
        audience: filed.thin ? audience : filed.audience,
        message: text.trim().slice(0, 400),
        place,
      });
    }
    return {
      text: input.persona.kind === "maya"
        ? `For ${audience}. What should the line actually say? I'll use your words, then file it as a proposal.`
        : `I'll aim it at ${audience}. What line should they hear? I'll file that wording as a proposal, and I won't send it.`,
      mind: {
        campaign: {
          title: place ? `A ${place} note from this conversation` : talk.title,
          audience,
          message: "",
          place,
          waiting: "offer",
        },
      },
    };
  }
  const message = text.trim().slice(0, 400);
  if (message.length < 8) {
    return { text: "Give me the line in a sentence. I'll file it as soon as I have the words.", mind: input.mind };
  }
  const place = talk.place || spokenBrief(message).place;
  const titleBase = place ? `${place}: ${message}` : message;
  return fileTalk(input, {
    title: titleBase.slice(0, 90),
    audience: talk.audience || spokenBrief(message).audience,
    message,
    place,
  });
}

async function kickoffCollect(persona: Persona, table: TableDef, slug: string, values: Record<string, string>): Promise<Turn> {
  values = applySums(table, values);
  const need = missingRequired(table, values);
  const ack = knownPhrase(table, values);
  if (need.length) {
    const pending: PendingTask = { kind: "create", table: table.id, crm: slug, values, phase: "collect", asking: need[0].key };
    const left = need.length > 1 ? ` After this I still need ${need.length - 1} more.` : "";
    return {
      text: `${ack}${need[0].prompt ?? need[0].label}${left} I'll stamp the dates and the id myself.`,
      mind: { pending },
    };
  }
  const optional = missingOptional(table, values);
  const pending: PendingTask = { kind: "create", table: table.id, crm: slug, values, phase: "optional" };
  const blanks = optional.length
    ? `I can still take ${optional
        .slice(0, 6)
        .map((f) => f.label.toLowerCase())
        .join(", ")}${optional.length > 6 ? ", and a few more" : ""}. Add any of those, or say submit and I'll leave the rest blank.`
    : "Say submit and I'll have Aether write it.";
  return {
    text: `${ack}I think I have enough to file this ${table.singular}.\n${summary(table, values)}\n\n${blanks}`,
    mind: { pending },
  };
}

async function continuePending(
  input: { persona: Persona; crm: string; mind: Mind; operator: string; training: TrainingDoc[] },
  text: string,
): Promise<Turn> {
  const pending = input.mind.pending!;
  const table = tableById(pending.table);
  if (!table) return { text: "I lost the thread on that record. Start it again and I'll follow.", mind: {} };
  const persona = input.persona;

  if (pending.phase === "confirm") {
    if (YES.test(text) || SUBMIT.test(text)) {
      try {
        if (pending.kind === "create") {
          const item = await createRecord({ slug: pending.crm, table: table.id, values: pending.values, agent: personaVoice(persona) });
          return {
            text: `It's in. ${table.singular} ${String(item[table.pk])} is on ${crmBySlug(pending.crm)?.name ?? pending.crm}.`,
            aether: `Aether created ${table.id} ${String(item[table.pk])}.`,
            mind: {},
          };
        }
        if (pending.kind === "update" && pending.key) {
          await updateRecord({ slug: pending.crm, table: table.id, key: pending.key, patch: pending.values, agent: personaVoice(persona) });
          return {
            text: `Updated. ${String(pending.key[table.pk])} now has what you asked for.`,
            aether: `Aether patched ${table.id} ${String(pending.key[table.pk])}.`,
            mind: {},
          };
        }
        if (pending.kind === "delete" && pending.key) {
          await deleteRecord({ slug: pending.crm, table: table.id, key: pending.key, agent: personaVoice(persona) });
          return {
            text: `Gone. I removed ${String(pending.key[table.pk])}.`,
            aether: `Aether removed ${table.id} ${String(pending.key[table.pk])}.`,
            mind: {},
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Write failed";
        return { text: `Aether couldn't finish that. ${message}`, mind: input.mind };
      }
    }
    return { text: "Say yes and I'll write it, or cancel and I'll drop it.", mind: input.mind };
  }

  let values = { ...pending.values };
  if (pending.matches && pending.asking === "lead_id") {
    const n = Number(text);
    const chosen = Number.isFinite(n)
      ? pending.matches[n - 1]
      : pending.matches.find((m) => m.id.toLowerCase() === text.trim().toLowerCase() || m.label.toLowerCase().includes(text.toLowerCase()));
    if (!chosen) {
      return { text: `Just the number is enough:\n${pending.matches.map((m, i) => `${i + 1}. ${m.label}`).join("\n")}`, mind: input.mind };
    }
    values.lead_id = chosen.id;
    return kickoffCollect(persona, table, pending.crm, values);
  }

  if (SUBMIT.test(text) && pending.phase === "optional") {
    values = applySums(table, values);
    return {
      text: `Here's what I'll hand Aether. Dates get stamped as of now.\n${summary(table, values)}\n\nShall I write it?`,
      mind: { pending: { ...pending, values, phase: "confirm" } },
    };
  }

  const labeled = grabLabeled(text, table);
  if (table.id === "tbl_shipment") {
    for (const [k, v] of Object.entries(shipmentHints(text))) if (v) labeled[k] = labeled[k] || v;
  }
  if (table.id === "tbl_leads") {
    for (const [k, v] of Object.entries(leadHints(text))) if (v) labeled[k] = labeled[k] || v;
  }
  if (pending.asking && !labeled[pending.asking] && !/^\s*(skip|unknown|n\/a|none)\s*$/i.test(text)) {
    labeled[pending.asking] = text.replace(/^it(?:'s| is)\s+/i, "").trim();
  }
  if (/^\s*(skip|unknown|n\/a|none)\s*$/i.test(text) && pending.asking) {
    const field = table.fields.find((f) => f.key === pending.asking);
    if (field?.required) return { text: `I do need ${field.label.toLowerCase()} before this can be filed. ${field.prompt ?? ""}`.trim(), mind: input.mind };
    values[pending.asking] = "";
  }
  for (const [k, v] of Object.entries(labeled)) {
    if (!v || /^skip$/i.test(v)) continue;
    values[k] = v;
  }
  if (values.lead_id && table.fields.some((f) => f.key === "lead_id") && table.pk !== "lead_id") {
    const raw = values.lead_id;
    if (!/^(lead|bd-lead|cs-lead|L-)/i.test(raw) || raw.includes(" ")) {
      const resolved = await resolveLeadField(persona, pending.crm, raw);
      if (resolved.error) return { text: resolved.error, mind: { pending: { ...pending, values } } };
      if (resolved.matches) {
        return {
          text: `Which of these?\n${resolved.matches.map((m, i) => `${i + 1}. ${m.label}`).join("\n")}`,
          mind: { pending: { ...pending, values, asking: "lead_id", matches: resolved.matches, phase: "collect" } },
        };
      }
      if (resolved.id) values.lead_id = resolved.id;
    }
  }
  if (pending.kind === "update") {
    const lines = Object.entries(values)
      .filter(([, v]) => v)
      .map(([k, v]) => {
        const field = table.fields.find((f) => f.key === k);
        return `${field?.label ?? k} → ${v}`;
      })
      .join("\n");
    return {
      text: `I'll change ${pending.key?.[table.pk]} like this:\n${lines}\n\nConfirm?`,
      mind: { pending: { ...pending, values, phase: "confirm", matches: undefined } },
    };
  }
  return kickoffCollect(persona, table, pending.crm, values);
}

async function startUpdate(persona: Persona, crm: string, text: string): Promise<Turn> {
  const slug = persona.scope === "*" ? (crm === "*" ? "carshipy" : crm) : persona.scope;
  const tableMatch = text.match(/\b(lead|shipment|port|financing|partner|logistics|call)\b/i);
  const table = tableBySingular(tableMatch?.[1] ?? "lead") ?? tableById("tbl_leads")!;
  const set = text.match(/\b(?:set|change|update)\s+(.+?)(?:'s|’s)?\s+([a-z][a-z0-9 _-]{1,30})\s+(?:to|=)\s+(.+)$/i);
  if (!set) return { text: "Tell me who and what. For example: update Aisha Mohammed's stage to deposit_paid.", mind: {} };
  const query = set[1].replace(/\b(the|lead|shipment|port|partner|financing|logistics|call)\b/gi, "").trim();
  const field = fieldByText(table, set[2]);
  const rawValue = set[3].trim();
  const data = await rowsFor(persona, slug, table.id);
  const hits = data.filter(({ row }) => {
    const blob = `${row.name ?? ""} ${row.partner_name ?? ""} ${row.port_name ?? ""} ${row.shipment_number ?? ""} ${row[table.pk] ?? ""} ${row.Caller ?? ""}`.toLowerCase();
    return blob.includes(query.toLowerCase());
  });
  if (!hits.length) return { text: `I can't find a ${table.singular} matching “${query}”.`, mind: {} };
  if (hits.length > 1) {
    return {
      text: `A few match. Give me the id:\n${hits
        .slice(0, 6)
        .map((h) => `${h.row[table.pk]} · ${h.row.name ?? h.row.partner_name ?? h.row.port_name ?? h.row.Caller ?? ""}`)
        .join("\n")}`,
      mind: {},
    };
  }
  if (!field || field.kind === "auto-id" || field.kind === "auto-now") {
    return { text: `I won't touch ${set[2]}. That one is stamped, or it isn't a field I edit.`, mind: {} };
  }
  const row = hits[0].row;
  const key: Record<string, string> = { [table.pk]: String(row[table.pk] ?? "") };
  if (table.sk) key[table.sk] = String(row[table.sk] ?? "");
  return {
    text: `${row.name ?? row.partner_name ?? row[table.pk]} — set ${field.label.toLowerCase()} to “${rawValue}”?`,
    mind: { pending: { kind: "update", table: table.id, crm: slug, values: { [field.key]: rawValue }, phase: "confirm", key } },
  };
}

async function startDelete(persona: Persona, crm: string, kind: string | undefined, rest: string): Promise<Turn> {
  const slug = persona.scope === "*" ? (crm === "*" ? "carshipy" : crm) : persona.scope;
  const table = tableBySingular(kind ?? "lead") ?? tableById("tbl_leads")!;
  const q = rest.replace(/\b(the|record|please|from the table)\b/gi, "").trim();
  if (!q) return { text: `Which ${table.singular}? A name or an id is enough.`, mind: {} };
  const data = await rowsFor(persona, slug, table.id);
  const hits = data.filter(({ row }) => {
    const blob = `${row.name ?? ""} ${row.partner_name ?? ""} ${row.port_name ?? ""} ${row[table.pk] ?? ""} ${row.Caller ?? ""}`.toLowerCase();
    return blob.includes(q.toLowerCase());
  });
  if (!hits.length) return { text: `No ${table.singular} matched “${q}”.`, mind: {} };
  if (hits.length > 1) {
    return {
      text: `Be a bit more specific:\n${hits
        .slice(0, 6)
        .map((h) => `${h.row[table.pk]} · ${h.row.name ?? h.row.partner_name ?? ""}`)
        .join("\n")}`,
      mind: {},
    };
  }
  const row = hits[0].row;
  const key: Record<string, string> = { [table.pk]: String(row[table.pk] ?? "") };
  if (table.sk) key[table.sk] = String(row[table.sk] ?? "");
  return {
    text: `Delete ${row.name ?? row.partner_name ?? row[table.pk]} (${row[table.pk]}) from ${crmBySlug(slug)?.name}? I can't undo that.`,
    mind: { pending: { kind: "delete", table: table.id, crm: slug, values: {}, phase: "confirm", key } },
  };
}
