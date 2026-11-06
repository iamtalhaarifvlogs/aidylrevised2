import {
  decideCampaign,
  draftCampaign,
  fromItem,
  mergeCampaigns,
  proposeCampaigns,
  recordCampaignResult,
  toItem,
  type Campaign,
  type CampaignResults,
} from "@/lib/campaigns";
import { createRecord, readTable } from "@/lib/crm/data";
import { blankActivity, useAidyl } from "@/lib/store";
import { nowIso } from "@/lib/utils";

let lastRun = 0;

function missingTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /not found|unknown table|resource/i.test(message);
}

function notify(campaign: Campaign) {
  const who = campaign.analyst === "maya" ? "Maya" : "Randolph";
  const title = `Campaign proposal: ${campaign.title}`;
  useAidyl.getState().pushNotice({
    title,
    body: `${who} prepared this from the live book. It is not published and nothing is spent until you approve it on Campaigns.`,
    href: "/campaigns",
    kind: "recommend",
  });
  useAidyl.getState().pushBeat({
    agent: campaign.analyst,
    phase: "recommended",
    text: `${who} filed “${campaign.title}”. Waiting on you. Nothing was published.`,
    href: "/campaigns",
  });
  useAidyl.getState().pushActivity(
    blankActivity({
      crm: "carshipy",
      table: "tbl_campaigns",
      action: "propose campaign",
      message: `${who} proposed ${campaign.cp_id}. ${campaign.why_now}`,
      performedBy: who,
      status: "success",
      agent: who,
    }),
  );
}

async function remember(campaign: Campaign) {
  useAidyl.getState().upsertCampaign(campaign);
  if (useAidyl.getState().campaignSync.state === "missing") return campaign;
  try {
    await createRecord({
      slug: "carshipy",
      table: "tbl_campaigns",
      values: toItem(campaign),
      agent: campaign.analyst === "maya" ? "Maya" : "Randolph",
    });
    const synced = { ...campaign, synced: true };
    useAidyl.getState().upsertCampaign(synced);
    useAidyl.getState().setCampaignSync({ state: "live", detail: "", paused: useAidyl.getState().campaignSync.paused });
    return synced;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The campaign table did not accept the row.";
    useAidyl.getState().setCampaignSync({
      state: missingTable(error) ? "missing" : "error",
      detail,
      paused: useAidyl.getState().campaignSync.paused,
    });
    return campaign;
  }
}

export async function considerCampaigns(force = false) {
  const state = useAidyl.getState();
  if (state.campaignSync.paused) return [];
  if (!force && !state.tableWatch.primed) return [];
  if (!force && Date.now() - lastRun < 10 * 60_000) return [];
  lastRun = Date.now();
  const [leads, shipments, logistics, financing, ports] = await Promise.all([
    readTable("carshipy", "tbl_leads"),
    readTable("carshipy", "tbl_shipment"),
    readTable("carshipy", "tbl_logistics"),
    readTable("carshipy", "tbl_financing"),
    readTable("carshipy", "tbl_ports"),
  ]);
  let existing = useAidyl.getState().campaigns;
  try {
    const remote = (await readTable("carshipy", "tbl_campaigns")).map(fromItem).filter((item): item is Campaign => Boolean(item));
    existing = mergeCampaigns(existing, remote);
    useAidyl.getState().setCampaignSync({ state: "live", detail: "", paused: useAidyl.getState().campaignSync.paused });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "tbl_campaigns did not answer.";
    useAidyl.getState().setCampaignSync({
      state: missingTable(error) ? "missing" : "error",
      detail,
      paused: useAidyl.getState().campaignSync.paused,
    });
  }
  const fresh = proposeCampaigns({
    leads,
    shipments,
    logistics,
    financing,
    ports,
    campaigns: existing,
    now: nowIso(),
  });
  const saved: Campaign[] = [];
  for (const campaign of fresh) saved.push(await remember(campaign));
  for (const campaign of saved) notify(campaign);
  return saved;
}

export async function fileSpokenCampaign(input: {
  analyst: "maya" | "randolph";
  title: string;
  audience: string;
  message: string;
  why: string;
  evidence: string[];
}) {
  const base = draftCampaign({ title: input.title, audience: input.audience, message: input.message, now: nowIso() });
  const existing = useAidyl.getState().campaigns.find((item) => item.fingerprint === base.fingerprint);
  if (existing) return existing;
  const campaign: Campaign = {
    ...base,
    analyst: input.analyst,
    origin: "admin",
    why_now: input.why,
    evidence: input.evidence.slice(0, 8),
    objective: input.title,
    message: input.message.trim(),
    offer: input.message.trim(),
    assets: base.assets.map((asset) => ({
      ...asset,
      brief: `${input.title}. ${input.message}`.slice(0, 360),
    })),
    activities:
      input.analyst === "maya"
        ? "Maya wrote this from the conversation. You approve it on Campaigns before anyone is contacted. Aether still does not change a lead from this proposal."
        : "Randolph wrote this from the conversation and left the Carshipy detail with Maya's book. You approve it on Campaigns. Nothing is published from the chat.",
  };
  const saved = await remember(campaign);
  const who = input.analyst === "maya" ? "Maya" : "Randolph";
  useAidyl.getState().pushNotice({
    title: `Campaign proposal: ${saved.title}`,
    body: `${who} wrote this because you asked in the conversation. Nothing is published until you approve it on Campaigns.`,
    href: "/campaigns",
    kind: "recommend",
  });
  useAidyl.getState().pushBeat({
    agent: input.analyst,
    phase: "recommended",
    text: `${who} filed “${saved.title}” from the conversation. Waiting on you.`,
    href: "/campaigns",
  });
  return saved;
}

export async function saveAdminDraft(input: { title: string; audience: string; message: string }) {
  const campaign = draftCampaign({ ...input, now: nowIso() });
  if (useAidyl.getState().campaigns.some((item) => item.fingerprint === campaign.fingerprint)) {
    throw new Error("That draft is already on the desk.");
  }
  return remember(campaign);
}

export async function applyCampaignDecision(cpId: string, choice: "approve" | "reject" | "defer" | "revision", note: string) {
  const current = useAidyl.getState().campaigns.find((item) => item.cp_id === cpId);
  if (!current) throw new Error("That proposal is no longer on the desk.");
  const next = decideCampaign(current, choice, note, nowIso());
  const saved = await remember(next);
  const who = current.analyst === "maya" ? "Maya" : "Randolph";
  useAidyl.getState().pushActivity(
    blankActivity({
      crm: "carshipy",
      table: "tbl_campaigns",
      action: `${choice} campaign`,
      message:
        choice === "approve"
          ? `You approved ${current.title}. Nothing was published and no money was spent.`
          : `You marked ${current.title} as ${choice}.`,
      performedBy: useAidyl.getState().operatorName || "Admin",
      status: "success",
      agent: who,
    }),
  );
  return saved;
}

export async function saveCampaignResult(cpId: string, results: Omit<CampaignResults, "recorded_at">) {
  const current = useAidyl.getState().campaigns.find((item) => item.cp_id === cpId);
  if (!current) throw new Error("That proposal is no longer on the desk.");
  if (current.status !== "approved" && current.status !== "completed") {
    throw new Error("Record a result only after you have approved the proposal.");
  }
  return remember(recordCampaignResult(current, results, nowIso()));
}

export async function saveCampaignEdit(cpId: string, patch: { title?: string; audience?: string; message?: string }) {
  const current = useAidyl.getState().campaigns.find((item) => item.cp_id === cpId);
  if (!current) throw new Error("That proposal is no longer on the desk.");
  const next: Campaign = {
    ...current,
    title: patch.title?.trim() || current.title,
    audience: patch.audience?.trim() || current.audience,
    message: patch.message?.trim() || current.message,
    offer: patch.message?.trim() || current.offer,
    updated_at: nowIso(),
    assets: current.assets.map((asset) => ({ ...asset, revision: asset.revision + 1, brief: `${patch.title || current.title}. ${patch.message || current.message}` })),
  };
  return remember(next);
}

export function setCampaignPause(paused: boolean) {
  const sync = useAidyl.getState().campaignSync;
  useAidyl.getState().setCampaignSync({ ...sync, paused });
  void fetch("/api/aether", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "campaign-pause", paused }),
  }).catch(() => undefined);
}
