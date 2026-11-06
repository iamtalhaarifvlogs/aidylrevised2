export type CampaignStatus = "proposed" | "revision" | "approved" | "rejected" | "deferred" | "completed";

export type Forecast = {
  method: "counted_rows";
  label: "insufficient" | "directional";
  generated_at: string;
  dataset: string;
  assumptions: string[];
  limitations: string[];
  conservative: string;
  baseline: string;
  optimistic: string;
  measure: string;
};

export type PriorityFactor = { factor: string; weight: string; note: string };

export type CampaignAsset = {
  asset_id: string;
  type: "key_visual";
  channel: string;
  format: "svg";
  dimensions: "1080x1350";
  brief: string;
  status: "rendered";
  storage_ref: string;
  created_at: string;
  revision: number;
  approval: "pending" | "approved" | "rejected";
};

export type CampaignResults = {
  recorded_at: string;
  contacted: string;
  completed: string;
  spend: string;
  note: string;
};

export type Campaign = {
  cp_id: string;
  company: "carshipy";
  title: string;
  status: CampaignStatus;
  origin: "data" | "admin";
  analyst: "maya" | "randolph";
  objective: string;
  audience: string;
  channels: string;
  why_now: string;
  evidence: string[];
  message: string;
  offer: string;
  activities: string;
  schedule: string;
  budget_note: string;
  risks: string;
  fingerprint: string;
  priority_score: number;
  priority_factors: PriorityFactor[];
  forecast: Forecast;
  assets: CampaignAsset[];
  lesson_in: string;
  decision: string;
  decision_note: string;
  decision_at: string;
  results: CampaignResults | null;
  lesson: string;
  created_at: string;
  updated_at: string;
  synced?: boolean;
};

type LeadLike = { [key: string]: unknown };

export type CampaignBook = {
  leads: LeadLike[];
  shipments: LeadLike[];
  logistics: LeadLike[];
  financing: LeadLike[];
  ports: LeadLike[];
  campaigns: Campaign[];
  now?: string;
};

const FAMILIES = ["late-gaps", "discovery-queue", "destination", "credit-gap"] as const;

function text(row: LeadLike, key: string) {
  const value = row[key];
  if (value == null) return "";
  if (typeof value === "object") return "";
  return String(value).trim();
}

function blank(value: string) {
  const t = value.toLowerCase();
  return t === "" || t === "—" || t === "-" || t === "unknown" || t === "n/a" || t === "null";
}

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function familyOf(fingerprint: string) {
  return fingerprint.split(":")[0] || fingerprint;
}

function bucket(count: number) {
  if (count < 4) return "";
  if (count < 8) return "4-7";
  if (count < 13) return "8-12";
  return "13+";
}

function lateStage(stage: string) {
  return /deposit|book|sourc|transit/i.test(stage);
}

function closedStage(stage: string) {
  return /deliver|complete|closed/i.test(stage);
}

function missingCommercial(row: LeadLike) {
  const missing: string[] = [];
  if (blank(text(row, "preferredVehicle"))) missing.push("vehicle");
  if (blank(text(row, "location"))) missing.push("location");
  if (blank(text(row, "budget"))) missing.push("budget");
  return missing;
}

function leadLabel(row: LeadLike) {
  const name = text(row, "name");
  return blank(name) ? text(row, "lead_id") || "Unnamed lead" : name;
}

function blocked(campaigns: Campaign[], fingerprint: string) {
  const family = familyOf(fingerprint);
  if (campaigns.some((item) => item.fingerprint === fingerprint)) return true;
  if (campaigns.some((item) => familyOf(item.fingerprint) === family && item.status === "rejected")) return true;
  if (
    campaigns.some(
      (item) =>
        familyOf(item.fingerprint) === family &&
        (item.status === "proposed" || item.status === "revision" || item.status === "deferred" || item.status === "approved"),
    )
  ) {
    return true;
  }
  return false;
}

function priorLesson(campaigns: Campaign[], family: string) {
  const done = campaigns
    .filter((item) => familyOf(item.fingerprint) === family && item.status === "completed" && item.lesson)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return done[0]?.lesson ?? "";
}

function rank(factors: { factor: string; points: number; note: string }[]) {
  const score = Math.round(factors.reduce((sum, factor) => sum + factor.points, 0) / factors.length);
  return {
    priority_score: score,
    priority_factors: factors.map((factor) => ({
      factor: factor.factor,
      weight: String(factor.points),
      note: factor.note,
    })),
  };
}

function forecastFor(now: string, dataset: string, countLine: string, lesson: string): Forecast {
  const measured = lesson
    ? `One earlier result is on file: ${lesson}`
    : "No completed campaign result is stored for this kind of work.";
  return {
    method: "counted_rows",
    label: lesson ? "directional" : "insufficient",
    generated_at: now,
    dataset,
    assumptions: [
      "The count is taken from the live Carshipy rows visible to the desk at this read.",
      "A proposal is not a media booking.",
      measured,
    ],
    limitations: [
      "There is no stored ad spend, reach, impression, or revenue history.",
      "This is not a calibrated statistical forecast.",
      "No conversion rate, CAC, ROAS, or revenue figure is estimated.",
    ],
    conservative: "None of the named rows move. That outcome is possible and is not given a probability.",
    baseline: countLine,
    optimistic: "Not estimated. There is not enough outcome history to publish an optimistic number.",
    measure: "Count only what the administrator later records: people contacted, briefs completed, and any spend they actually incur.",
  };
}

function assetFor(cpId: string, channel: string, brief: string, now: string): CampaignAsset {
  return {
    asset_id: `art-${cpId}`,
    type: "key_visual",
    channel,
    format: "svg",
    dimensions: "1080x1350",
    brief,
    status: "rendered",
    storage_ref: `generated:svg:${cpId}`,
    created_at: now,
    revision: 1,
    approval: "pending",
  };
}

function assemble(input: {
  now: string;
  family: string;
  fingerprint: string;
  analyst: "maya" | "randolph";
  title: string;
  objective: string;
  audience: string;
  channels: string;
  why_now: string;
  evidence: string[];
  message: string;
  offer: string;
  activities: string;
  risks: string;
  dataset: string;
  countLine: string;
  lesson: string;
  factors: { factor: string; points: number; note: string }[];
}): Campaign {
  const cp_id = `cp-${hash(input.fingerprint)}`;
  const ranked = rank(input.factors);
  return {
    cp_id,
    company: "carshipy",
    title: input.title,
    status: "proposed",
    origin: "data",
    analyst: input.analyst,
    objective: input.objective,
    audience: input.audience,
    channels: input.channels,
    why_now: input.why_now,
    evidence: input.evidence.slice(0, 8),
    message: input.message,
    offer: input.offer,
    activities: input.activities,
    schedule: "Starts only if you approve. Suggested window to record a result: 14 days. This is not a launch date and nothing is published.",
    budget_note: "No media budget is stored on the book. This proposal does not spend money.",
    risks: input.risks,
    fingerprint: input.fingerprint,
    priority_score: ranked.priority_score,
    priority_factors: ranked.priority_factors,
    forecast: forecastFor(input.now, input.dataset, input.countLine, input.lesson),
    assets: [assetFor(cp_id, input.channels.split(",")[0]?.trim() || "Desk", `${input.title}. ${input.message}`, input.now)],
    lesson_in: input.lesson,
    decision: "",
    decision_note: "",
    decision_at: "",
    results: null,
    lesson: "",
    created_at: input.now,
    updated_at: input.now,
    synced: false,
  };
}

export function proposeCampaigns(book: CampaignBook): Campaign[] {
  const now = book.now || new Date().toISOString();
  const month = new Date(now).getUTCMonth();
  const seasonal = month >= 9 && month <= 11 ? " The desk date is in the last quarter of the year. No seasonal result history is stored, so that is only a calendar note." : "";
  const proposals: Campaign[] = [];
  const have = book.campaigns;

  const late = book.leads.filter((row) => lateStage(text(row, "stage")) && missingCommercial(row).length > 0);
  const lateFp = `late-gaps:${late
    .map((row) => text(row, "lead_id"))
    .filter(Boolean)
    .sort()
    .join(",")}`;
  if (late.length && !blocked(have, lateFp)) {
    const lesson = priorLesson(have, "late-gaps");
    const names = late.slice(0, 6).map((row) => {
      const missing = missingCommercial(row);
      return `${leadLabel(row)} (${text(row, "stage") || "unset"}; missing ${missing.join(", ")})`;
    });
    proposals.push(
      assemble({
        now,
        family: "late-gaps",
        fingerprint: lateFp,
        analyst: "maya",
        title: "Close the gaps before anyone promises a deposit",
        objective: "Get a complete brief on leads that are already late in the Carshipy book.",
        audience: names.join("; "),
        channels: "Phone follow-up, desk call log",
        why_now: `${late.length} live lead${late.length === 1 ? "" : "s"} sit in a late stage with a commercial field still empty.${seasonal}`,
        evidence: [
          `${late.length} late-stage lead${late.length === 1 ? "" : "s"} with a missing vehicle, location, or budget.`,
          ...names,
          "Counted from tbl_leads on this read. No engagement metric was added.",
        ],
        message: "We should not ask for a deposit until the vehicle, location, and budget are on the row.",
        offer: "A qualification call. Not a discount and not an advertisement.",
        activities: "Maya lists the rows. You contact them. Aether does not fill the missing fields and does not change the stage.",
        risks: "A late stage can look more certain than the row is. Contacting someone with a thin brief can create a promise the book cannot keep.",
        dataset: `tbl_leads late-stage incomplete count = ${late.length}`,
        countLine: `${late.length} named lead${late.length === 1 ? "" : "s"} can be worked. No conversion rate is implied.`,
        lesson,
        factors: [
          { factor: "Impact", points: 78, note: "These rows are already near a promise." },
          { factor: "Evidence", points: 90, note: "Each row is named from the live book." },
          { factor: "Confidence", points: lesson ? 55 : 34, note: lesson ? "One past result is on file. It is still a single observation." : "No past result is stored, so confidence stays low." },
          { factor: "Effort", points: 62, note: "Calls, not a new channel build." },
          { factor: "Budget", points: 88, note: "No spend is proposed." },
          { factor: "Timing", points: 80, note: "The stage is already late." },
          { factor: "Feasibility", points: 84, note: "The work uses the phone and the existing book." },
        ],
      }),
    );
  }

  const early = book.leads.filter((row) => {
    const stage = text(row, "stage");
    return !lateStage(stage) && !closedStage(stage);
  });
  const earlyBucket = bucket(early.length);
  const earlyFp = `discovery-queue:${earlyBucket}`;
  if (earlyBucket && !blocked(have, earlyFp) && proposals.length < 2) {
    const lesson = priorLesson(have, "discovery-queue");
    const names = early.slice(0, 6).map((row) => `${leadLabel(row)} (${text(row, "stage") || "unset"})`);
    proposals.push(
      assemble({
        now,
        family: "discovery-queue",
        fingerprint: earlyFp,
        analyst: "maya",
        title: "Work the early Carshipy queue before it goes quiet",
        objective: "Re-open leads that are still early, and find out which ones are real.",
        audience: `${early.length} early-stage leads. Examples: ${names.join("; ")}`,
        channels: "Phone follow-up, desk call log",
        why_now: `${early.length} leads are still early in the book. The count sits in the ${earlyBucket} band.${seasonal}`,
        evidence: [
          `${early.length} leads are not in a late stage and are not marked delivered or closed.`,
          ...names,
          "This uses the live stage field only. It is not a lead-source report.",
        ],
        message: "A short check-in to confirm the vehicle, the place, and whether they still want to move.",
        offer: "A follow-up conversation. No price is invented.",
        activities: "Randolph asks Maya to work this queue. You choose who to call. Nothing is sent automatically.",
        risks: "Some of these rows may already be stale. The book does not store a reliable last-contact time for every lead.",
        dataset: `tbl_leads early-stage count = ${early.length} (band ${earlyBucket})`,
        countLine: `${early.length} early leads are on the book. How many will answer is not estimated.`,
        lesson,
        factors: [
          { factor: "Impact", points: 58, note: "A quiet early queue is a real book, not proof of demand." },
          { factor: "Evidence", points: 72, note: "The count and sample names are from tbl_leads." },
          { factor: "Confidence", points: lesson ? 48 : 28, note: "No response-rate history is stored." },
          { factor: "Effort", points: 50, note: "The queue may be long for one person." },
          { factor: "Budget", points: 88, note: "No spend is proposed." },
          { factor: "Timing", points: 46, note: "Early stage is less urgent than a late gap." },
          { factor: "Feasibility", points: 70, note: "Calls can start without a new tool." },
        ],
      }),
    );
  }

  const byCountry = new Map<string, number>();
  for (const row of book.shipments) {
    const country = text(row, "destination_country");
    if (blank(country)) continue;
    byCountry.set(country, (byCountry.get(country) ?? 0) + 1);
  }
  const topCountry = [...byCountry.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCountry && topCountry[1] >= 2 && proposals.length < 2) {
    const fp = `destination:${topCountry[0].toLowerCase()}:${topCountry[1]}`;
    if (!blocked(have, fp)) {
      const lesson = priorLesson(have, "destination");
      const matching = book.leads.filter((row) => text(row, "location").toLowerCase().includes(topCountry[0].toLowerCase()));
      proposals.push(
        assemble({
          now,
          family: "destination",
          fingerprint: fp,
          analyst: "randolph",
          title: `Brief the ${topCountry[0]} sailings that are already on the book`,
          objective: `Give the operator a clear note for shipments headed to ${topCountry[0]}.`,
          audience: matching.length
            ? `${matching.length} lead location${matching.length === 1 ? "" : "s"} mention ${topCountry[0]}.`
            : `No lead location currently mentions ${topCountry[0]}. The audience is the operator, not a cold list.`,
          channels: "Operator brief",
          why_now: `${topCountry[1]} live shipments list ${topCountry[0]} as the destination.`,
          evidence: [
            `${topCountry[1]} rows in tbl_shipment use destination ${topCountry[0]}.`,
            matching.length ? `${matching.length} leads mention that place in location.` : "No lead location matches that destination on this read.",
            "No ad account, reach, or impression figure is connected.",
          ],
          message: `What a buyer should have ready before a ${topCountry[0]} sailing is promised.`,
          offer: "An operator brief. Not a published advertisement.",
          activities: "Randolph drafts the brief from shipment rows. Maya does not take this one. You decide whether to use it.",
          risks: "A destination count is not demand. Publishing this as an ad would invent an audience the book does not prove.",
          dataset: `tbl_shipment destination ${topCountry[0]} = ${topCountry[1]}`,
          countLine: `${topCountry[1]} shipments name ${topCountry[0]}. No reach or revenue is attached.`,
          lesson,
          factors: [
            { factor: "Impact", points: 60, note: "Repeated destinations are an operational fact." },
            { factor: "Evidence", points: 80, note: "The count is from shipment rows." },
            { factor: "Confidence", points: lesson ? 46 : 30, note: "A count is not a market size." },
            { factor: "Effort", points: 74, note: "A brief, not a campaign build." },
            { factor: "Budget", points: 90, note: "No spend is proposed." },
            { factor: "Timing", points: 64, note: "The shipments are already on the book." },
            { factor: "Feasibility", points: 82, note: "No external channel is required." },
          ],
        }),
      );
    }
  }

  const activeLenders = book.financing.filter((row) => /active/i.test(text(row, "active_status")));
  const missingCredit = book.leads.filter((row) => blank(text(row, "creditStatus")));
  if (activeLenders.length && missingCredit.length >= 2 && proposals.length < 2) {
    const fp = `credit-gap:${activeLenders.map((row) => text(row, "financing_id")).sort().join(",")}:${bucket(missingCredit.length) || String(missingCredit.length)}`;
    if (!blocked(have, fp)) {
      const lesson = priorLesson(have, "credit-gap");
      const lenders = activeLenders.slice(0, 4).map((row) => {
        const rate = text(row, "interest_rate");
        return `${text(row, "partner_name") || "Unnamed partner"}${rate ? ` (rate on file ${rate})` : " (no rate on the row)"}`;
      });
      proposals.push(
        assemble({
          now,
          family: "credit-gap",
          fingerprint: fp,
          analyst: "maya",
          title: "Ask for credit status before offering a lender",
          objective: "Stop lender conversations that the lead row cannot support yet.",
          audience: `${missingCredit.length} leads have no credit status.`,
          channels: "Phone follow-up",
          why_now: `${activeLenders.length} financing partner${activeLenders.length === 1 ? "" : "s"} are marked active, and ${missingCredit.length} leads have a blank credit status.`,
          evidence: [
            ...lenders,
            `${missingCredit.length} leads have an empty creditStatus.`,
            "Rates are quoted only when the financing row stores one.",
          ],
          message: "We can talk about a lender only after credit status is on the lead.",
          offer: "A question, not a rate promise.",
          activities: "Maya names the partners already stored. You collect credit status. Aether does not write it until you approve a specific lead update.",
          risks: "Offering a rate that is not on the partner row, or offering any rate before credit is known, would be an invention.",
          dataset: `active financing partners = ${activeLenders.length}; leads missing credit = ${missingCredit.length}`,
          countLine: `${missingCredit.length} leads are missing credit status. No approval rate is estimated.`,
          lesson,
          factors: [
            { factor: "Impact", points: 66, note: "A lender conversation without credit status is a bad promise." },
            { factor: "Evidence", points: 84, note: "Partners and the blank field are both on the book." },
            { factor: "Confidence", points: lesson ? 50 : 32, note: "No approval-rate history is stored." },
            { factor: "Effort", points: 68, note: "One question per lead." },
            { factor: "Budget", points: 88, note: "No spend is proposed." },
            { factor: "Timing", points: 58, note: "Useful before the next financing conversation." },
            { factor: "Feasibility", points: 80, note: "The partners are already recorded." },
          ],
        }),
      );
    }
  }

  return proposals
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 2);
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
  const title = titleSource.slice(0, 90);
  const messageBody = (lead && rest ? `${lead}. ${rest}` : lead || cleaned).slice(0, 400);
  return {
    thin,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    audience: audience.slice(0, 240),
    message: messageBody,
    place,
  };
}

export function draftCampaign(input: { title: string; audience: string; message: string; now?: string }): Campaign {
  const now = input.now || new Date().toISOString();
  const fingerprint = `admin:${hash(`${input.title}|${input.audience}|${input.message}`)}`;
  const cp_id = `cp-${hash(fingerprint)}`;
  return {
    cp_id,
    company: "carshipy",
    title: input.title.trim(),
    status: "proposed",
    origin: "admin",
    analyst: "randolph",
    objective: input.title.trim(),
    audience: input.audience.trim(),
    channels: "Chosen by the administrator",
    why_now: "You wrote this proposal. The desk did not infer it from a row.",
    evidence: ["Entered by the administrator. Not counted from the live book."],
    message: input.message.trim(),
    offer: input.message.trim(),
    activities: "You edit the brief. Approving it still does not publish anything or spend money.",
    schedule: "No schedule until you set one outside this proposal.",
    budget_note: "No budget was entered. None is assumed.",
    risks: "An administrator draft can outrun the book. Treat the evidence line as human, not measured.",
    fingerprint,
    priority_score: 40,
    priority_factors: [
      { factor: "Evidence", weight: "20", note: "This draft is not backed by a counted row." },
      { factor: "Impact", weight: "40", note: "Impact depends on what you wrote, which the desk cannot score." },
    ],
    forecast: forecastFor(now, "Administrator draft. No row count.", "No counted outcome is attached to a hand-written draft.", ""),
    assets: [assetFor(cp_id, "Desk", `${input.title}. ${input.message}`, now)],
    lesson_in: "",
    decision: "",
    decision_note: "",
    decision_at: "",
    results: null,
    lesson: "",
    created_at: now,
    updated_at: now,
    synced: false,
  };
}

export function decideCampaign(campaign: Campaign, choice: "approve" | "reject" | "defer" | "revision", note: string, now = new Date().toISOString()): Campaign {
  const status: CampaignStatus =
    choice === "approve" ? "approved" : choice === "reject" ? "rejected" : choice === "defer" ? "deferred" : "revision";
  return {
    ...campaign,
    status,
    decision: choice,
    decision_note: note,
    decision_at: now,
    updated_at: now,
    assets: campaign.assets.map((asset) => ({
      ...asset,
      approval: choice === "approve" ? "approved" : choice === "reject" ? "rejected" : asset.approval,
      revision: choice === "revision" ? asset.revision + 1 : asset.revision,
    })),
  };
}

export function recordCampaignResult(
  campaign: Campaign,
  results: Omit<CampaignResults, "recorded_at">,
  now = new Date().toISOString(),
): Campaign {
  const stored: CampaignResults = { ...results, recorded_at: now };
  const lesson = `Forecast kept unchanged (${campaign.forecast.label}): ${campaign.forecast.baseline} Recorded later: contacted ${stored.contacted || "not given"}, briefs completed ${stored.completed || "not given"}, spend ${stored.spend || "not given"}. ${stored.note || ""} One observation, not a new model.`;
  return {
    ...campaign,
    status: "completed",
    results: stored,
    lesson,
    updated_at: now,
  };
}

export function toItem(campaign: Campaign): { [key: string]: string | number } {
  return {
    cp_id: campaign.cp_id,
    company: campaign.company,
    title: campaign.title,
    status: campaign.status,
    origin: campaign.origin,
    analyst: campaign.analyst,
    objective: campaign.objective,
    audience: campaign.audience,
    channels: campaign.channels,
    why_now: campaign.why_now,
    evidence_json: JSON.stringify(campaign.evidence),
    message: campaign.message,
    offer: campaign.offer,
    activities: campaign.activities,
    schedule: campaign.schedule,
    budget_note: campaign.budget_note,
    risks: campaign.risks,
    fingerprint: campaign.fingerprint,
    priority_score: campaign.priority_score,
    priority_json: JSON.stringify(campaign.priority_factors),
    forecast_json: JSON.stringify(campaign.forecast),
    assets_json: JSON.stringify(campaign.assets),
    lesson_in: campaign.lesson_in,
    decision: campaign.decision,
    decision_note: campaign.decision_note,
    decision_at: campaign.decision_at,
    results_json: campaign.results ? JSON.stringify(campaign.results) : "",
    lesson: campaign.lesson,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at,
  };
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function fromItem(row: LeadLike): Campaign | null {
  const cp_id = text(row, "cp_id");
  if (!cp_id) return null;
  const created_at = text(row, "created_at") || new Date().toISOString();
  const forecast = parseJson<Forecast | null>(row.forecast_json, null);
  return {
    cp_id,
    company: "carshipy",
    title: text(row, "title") || "Untitled proposal",
    status: (text(row, "status") as CampaignStatus) || "proposed",
    origin: text(row, "origin") === "admin" ? "admin" : "data",
    analyst: text(row, "analyst") === "randolph" ? "randolph" : "maya",
    objective: text(row, "objective"),
    audience: text(row, "audience"),
    channels: text(row, "channels"),
    why_now: text(row, "why_now"),
    evidence: parseJson<string[]>(row.evidence_json, []),
    message: text(row, "message"),
    offer: text(row, "offer"),
    activities: text(row, "activities"),
    schedule: text(row, "schedule"),
    budget_note: text(row, "budget_note"),
    risks: text(row, "risks"),
    fingerprint: text(row, "fingerprint") || `legacy:${cp_id}`,
    priority_score: Number(row.priority_score) || 0,
    priority_factors: parseJson<PriorityFactor[]>(row.priority_json, []),
    forecast:
      forecast ??
      forecastFor(created_at, "Stored row had no forecast.", "No forecast was stored on this row.", ""),
    assets: parseJson<CampaignAsset[]>(row.assets_json, []),
    lesson_in: text(row, "lesson_in"),
    decision: text(row, "decision"),
    decision_note: text(row, "decision_note"),
    decision_at: text(row, "decision_at"),
    results: parseJson<CampaignResults | null>(row.results_json, null),
    lesson: text(row, "lesson"),
    created_at,
    updated_at: text(row, "updated_at") || created_at,
    synced: true,
  };
}

export function mergeCampaigns(primary: Campaign[], incoming: Campaign[]) {
  const map = new Map<string, Campaign>();
  for (const item of incoming) map.set(item.cp_id, item);
  for (const item of primary) {
    const prev = map.get(item.cp_id);
    if (!prev || (item.updated_at || "") >= (prev.updated_at || "")) map.set(item.cp_id, item);
  }
  return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function wrapWords(value: string, width: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function posterSvg(campaign: Campaign) {
  const esc = (value: string) => {
    let out = "";
    for (const char of value) {
      if (char === "&") out += "&" + "amp;";
      else if (char === "<") out += "&" + "lt;";
      else if (char === ">") out += "&" + "gt;";
      else if (char === '"') out += "&" + "quot;";
      else out += char;
    }
    return out;
  };
  const title = wrapWords(campaign.title, 24).slice(0, 5);
  const message = wrapWords(campaign.message, 36).slice(0, 4);
  const titleMarkup = title
    .map((line, index) => `<text x="36" y="${168 + index * 34}" fill="#1c1915" font-family="Georgia, serif" font-size="28">${esc(line)}</text>`)
    .join("");
  const messageMarkup = message
    .map((line, index) => `<text x="36" y="${360 + index * 22}" fill="#1f4d3a" font-family="Outfit, sans-serif" font-size="16">${esc(line)}</text>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480" width="1080" height="1440">
  <rect width="360" height="480" fill="#f7f1e6"/>
  <rect width="360" height="10" fill="#8c6239"/>
  <text x="36" y="48" fill="#8c6239" font-family="Outfit, sans-serif" font-size="12" letter-spacing="3">CARSHIPY</text>
  <text x="36" y="72" fill="#6f675e" font-family="Outfit, sans-serif" font-size="12">${esc(campaign.analyst === "maya" ? "Maya" : "Randolph")} · proposal</text>
  ${titleMarkup}
  <rect x="36" y="330" width="48" height="3" fill="#1f4d3a"/>
  ${messageMarkup}
  <text x="36" y="456" fill="#6f675e" font-family="Outfit, sans-serif" font-size="11">Not published. Nothing is spent.</text>
</svg>`;
}

export const CAMPAIGN_FAMILIES = FAMILIES;
