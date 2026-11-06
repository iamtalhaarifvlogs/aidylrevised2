import { readTable } from "./data";
import type { Row } from "./schema";
import { getState, pushActivity, pushNotice, upsertCampaign } from "./store";
import type { PhoneCampaign } from "./types";
import { nowIso } from "./utils";

const API = "https://mbz2lmd7ud.execute-api.us-east-2.amazonaws.com/default/crm_data";

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function campaignIntent(text: string) {
  if (/\b(campaigns?|promos?|promotions?|marketing|advertis\w*|adverts?|outreach|re-?engage|key visual|posters?)\b/i.test(text)) {
    return true;
  }
  if (
    /\b(pdf|reports?|export|how many|count|number of|remind me|add a |new lead|new shipment|update the|delete |remove the|look up|find |list |show me)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  if (/\b(shipment|financing|logistics)\b/i.test(text) && !/\b(tell|warn|message|buyers?|people|customers?)\b/i.test(text)) {
    return false;
  }
  if (/\b(tell|warn|message|brief|reach out to)\b(?:\s+\w+){0,8}\s+(buyers?|customers?|people|leads?|shippers?|them|everyone)\b/i.test(text)) {
    return true;
  }
  if (/\b(we should|let'?s|i want to|can you)\s+(tell|warn|message|brief|reach)\b/i.test(text)) return true;
  if (/\b(a|the)\s+(message|brief|line|warning|notice|headline)\s+(for|to|about)\b/i.test(text)) return true;
  if (/\b(draft|prepare|write|put together)\b.{0,60}\b(for|about)\b/i.test(text) && /\b(buyers?|customers?|people|shippers?|leads?)\b/i.test(text)) {
    return true;
  }
  const place = /\b(nigeria|ghana|lagos|accra|savannah|baltimore|south africa|kenya|dubai|united states|usa|uk|canada)\b/i.test(text);
  const instruction = /\b(never pay|don'?t pay|do not pay|not to pay|should hear|should say|should know|need to know|must not pay)\b/i.test(text);
  return place && instruction;
}

export function spokenBrief(text: string) {
  const cleaned = text.replace(/^(please\s+)?(hey\s+|hi\s+)?(randolph|maya)[,:]?\s*/i, "").trim();
  const place =
    cleaned.match(/\b(nigeria|ghana|lagos|accra|savannah|baltimore|south africa|kenya|dubai|united states|usa|uk|canada)\b/i)?.[1] ?? "";
  const aimed = cleaned.match(/\b(?:for|aimed at|targeting|to reach|about)\s+([^.]{3,80})/i)?.[1]?.trim() ?? "";
  const stripped = cleaned
    .replace(/\b(please|can you|could you|would you|i want you to|i need you to|let's|lets|make|create|draft|prepare|build|write|put together|a|an|the|me|us)\b/gi, " ")
    .replace(/\b(campaign|promo|promotion|marketing|advertisement|advertise|advert|outreach|poster)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const thin = stripped.length < 8 && aimed.length < 8 && !place;
  const audience = aimed || (place ? `People already tied to ${place} on the Carshipy book` : "The people you named in this conversation");
  const sentence = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
  const rest = cleaned.slice(sentence.length).replace(/^[\s.!?]+/, "").trim();
  const substance = sentence
    .replace(/^(please\s+)?(can you|could you|would you|i want you to|i need you to|let's|lets)\s+/i, "")
    .replace(
      /^(make|create|draft|prepare|build|write|put together)\s+(me\s+|us\s+)?(a|an|the)\s+(campaign|promo|promotion|brief|poster|message)\s*(for|about|aimed at|targeting|to reach|to)?\s*/i,
      "",
    )
    .trim();
  const lead = substance.length > 12 ? substance : sentence.length > 12 ? sentence : "";
  const titled = lead && rest ? `${lead}. ${rest}` : lead || rest;
  const titleSource = (titled || (place ? `A ${place} campaign from this conversation` : "A campaign from this conversation")).slice(0, 90);
  const messageBody = (lead && rest ? `${lead}. ${rest}` : lead || cleaned).slice(0, 400);
  return {
    thin,
    title: (titleSource.charAt(0).toUpperCase() + titleSource.slice(1)).slice(0, 90),
    audience: audience.slice(0, 240),
    message: messageBody,
    place,
  };
}

export function whereTo(text: string) {
  const lower = text.toLowerCase();
  const asks = /\b(where|how do i|how can i|open|take me|show me the)\b/.test(lower) || /\b(navbar|menu|section)\b/.test(lower);
  if (!asks) return null;
  if (/\breports?\b/.test(lower)) {
    return "Reports is in the bar across the top. Open it for the master file, or say “make a report” and I'll prepare one in this chat. I won't change a row to do it.";
  }
  if (/\bcampaigns?\b/.test(lower)) {
    return "Campaigns is in the top bar. Tell me who it is for and what the line should say, and I'll file a proposal. Approving it does not publish anything or spend money.";
  }
  if (/\b(workflow|activity|alerts?|train)\b/.test(lower)) {
    return "Those sit in the bar under the clock, and again along the bottom: Train, Activity, and Alerts. Workflow is the top bar. Scroll the bar sideways if a name is off the edge.";
  }
  if (/\b(carshipy|betterdeal|logistics|compan(y|ies))\b/.test(lower)) {
    return "Carshipy, BetterDealTV, and Logistics are in the top bar. Carshipy is the live book. BetterDealTV is the public media desk. Logistics is the US haulage desk kept on this phone.";
  }
  if (/\b(where|navbar|menu|section|everything|all the)\b/.test(lower)) {
    return "The bar under the clock is the whole desk. Scroll it: Command, Carshipy, BetterDealTV, Logistics, Reports, Campaigns, Workflow, Activity, Alerts, Train. The bottom row is Desk, Train, Activity, and Alerts.";
  }
  return null;
}

export async function countForPlace(place: string) {
  const leads = await readTable("carshipy", "tbl_leads").catch(() => [] as Row[]);
  const ships = await readTable("carshipy", "tbl_shipment").catch(() => [] as Row[]);
  const needle = place.toLowerCase();
  const leadHits = needle
    ? leads.filter((row) => `${row.location ?? ""} ${row.preferredVehicle ?? ""} ${row.name ?? ""}`.toLowerCase().includes(needle)).length
    : 0;
  const shipHits = needle ? ships.filter((row) => String(row.destination_country ?? "").toLowerCase().includes(needle)).length : 0;
  return { leads: leads.length, ships: ships.length, leadHits, shipHits };
}

export async function fileSpokenCampaign(input: {
  analyst: "maya" | "randolph";
  title: string;
  audience: string;
  message: string;
  why: string;
  evidence: string[];
}) {
  const fingerprint = `admin:${hash(`${input.title}|${input.audience}|${input.message}`)}`;
  const cp_id = `cp-${hash(fingerprint)}`;
  const existing = getState().campaigns.find((item) => item.fingerprint === fingerprint || item.cp_id === cp_id);
  if (existing) return { campaign: existing, created: false };
  const created_at = nowIso();
  const campaign: PhoneCampaign = {
    cp_id,
    title: input.title.trim().slice(0, 90),
    audience: input.audience.trim().slice(0, 240),
    message: input.message.trim().slice(0, 400),
    analyst: input.analyst,
    status: "proposed",
    evidence: input.evidence.slice(0, 6),
    why: input.why,
    fingerprint,
    created_at,
    decision_note: "",
    synced: false,
  };
  let synced = false;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        TableName: "tbl_campaigns",
        Item: {
          cp_id,
          company: "carshipy",
          title: campaign.title,
          status: "proposed",
          origin: "admin",
          analyst: input.analyst,
          objective: campaign.title,
          audience: campaign.audience,
          channels: "Chosen by the administrator",
          why_now: input.why,
          evidence_json: JSON.stringify(campaign.evidence),
          message: campaign.message,
          offer: campaign.message,
          activities: "Filed from the phone conversation. Approving it does not publish it or spend money.",
          schedule: "No schedule until you set one.",
          budget_note: "No budget was entered. None is assumed.",
          risks: "This is a proposal from the conversation. No conversion rate, CAC, ROAS, or revenue is estimated.",
          fingerprint,
          priority_score: "40",
          forecast_json: JSON.stringify({ label: "insufficient", method: "counted_rows", note: "Not a calibrated forecast." }),
          assets_json: "[]",
          lesson_in: "",
          decision: "",
          decision_note: "",
          decision_at: "",
          results_json: "",
          lesson: "",
          created_at,
          updated_at: created_at,
        },
      }),
    });
    synced = res.ok;
  } catch {
    synced = false;
  }
  const saved = { ...campaign, synced };
  upsertCampaign(saved);
  const who = input.analyst === "maya" ? "Maya" : "Randolph";
  pushNotice({
    title: `Campaign proposal: ${saved.title}`,
    body: `${who} filed this from the conversation. Nothing is published until you approve it.`,
  });
  pushActivity({
    crm: "carshipy",
    table: "tbl_campaigns",
    action: "propose campaign",
    message: `${who} proposed ${saved.cp_id}. ${saved.why}`,
    performedBy: who,
    status: "success",
    agent: who,
  });
  return { campaign: saved, created: true };
}
