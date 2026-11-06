import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Row } from "@/lib/crm/schema";
import { emptyWatch, type IgWatch } from "@/lib/instagram";
import { emptySocialWatch, type SocialWatch } from "@/lib/social";
import { uid, nowIso } from "@/lib/utils";
import type { Campaign } from "@/lib/campaigns";
import { mergeCampaigns } from "@/lib/campaigns";

export type TrainingDoc = {
  id: string;
  lead_id: string;
  context_type: string;
  agent: "randolph" | "maya" | "both";
  title: string;
  body: string;
  createdAt: string;
};

export type ActivityEvent = {
  id: string;
  at: string;
  crm: string;
  table?: string;
  action: string;
  message: string;
  performedBy: string;
  status: "success" | "error";
  agent?: string;
};

export type Specialist = {
  id: string;
  name: string;
  crmSlug: string;
  brief: string;
  createdAt: string;
};

export type CustomCrm = {
  slug: string;
  name: string;
  focus: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "agent" | "aether" | "peer";
  agent?: string;
  text: string;
  at: string;
};

export type PendingTask = {
  kind: "create" | "update" | "delete";
  table: string;
  crm: string;
  values: Record<string, string>;
  asking?: string;
  phase: "collect" | "optional" | "confirm";
  key?: Record<string, string>;
  matches?: { id: string; label: string }[];
};

export type CampaignTalk = {
  title: string;
  audience: string;
  message: string;
  place: string;
  waiting: "audience" | "offer";
};

export type Mind = { pending?: PendingTask; campaign?: CampaignTalk };

export type Reminder = {
  id: string;
  title: string;
  note: string;
  fireAt: string;
  createdBy: string;
  fired: boolean;
};

export type Notice = {
  id: string;
  at: string;
  title: string;
  body: string;
  href?: string;
  kind?: "info" | "recommend" | "warning" | "urgent" | "done" | "system";
  recommendationId?: string;
  read?: boolean;
};

export type SavedReport = {
  id: string;
  at: string;
  module: string;
  title: string;
  subtitle: string;
  preparedBy: string;
  agent: string;
  notes?: string;
  sections: { heading: string; columns: string[]; rows: string[][] }[];
};

export type SuggestedAction = {
  id: "log_followup" | "set_stage" | "remind" | "acknowledge";
  label: string;
  detail: string;
  stage?: string;
};

export type Recommendation = {
  id: string;
  at: string;
  module: string;
  kind: string;
  priority: "info" | "recommend" | "warning" | "urgent";
  title: string;
  summary: string;
  evidence: string[];
  suggestion: string;
  actions: SuggestedAction[];
  href: string;
  recordId?: string;
  status: "open" | "approved" | "rejected" | "modified" | "deferred" | "done" | "failed";
  fingerprint: string;
  analyst: "maya" | "randolph";
  decisionNote?: string;
};

export type Decision = {
  id: string;
  at: string;
  recommendationId: string;
  kind: string;
  choice: "approve" | "reject" | "modify" | "defer";
  note: string;
  by: string;
};

export type AgentBeat = {
  id: string;
  at: string;
  agent: "aether" | "maya" | "randolph";
  phase: string;
  text: string;
  href?: string;
};

export type TableWatch = {
  primed: boolean;
  reviewed: boolean;
  prints: Record<string, string>;
  lastCheck: string;
  lastError: string;
  reviewVersion?: number;
};

export type DeskControls = {
  watchCarshipy: boolean;
  watchLogistics: boolean;
  watchMedia: boolean;
};

export function emptyTableWatch(): TableWatch {
  return { primed: false, reviewed: false, prints: {}, lastCheck: "", lastError: "" };
}

export function defaultControls(): DeskControls {
  return { watchCarshipy: true, watchLogistics: true, watchMedia: true };
}

export type AetherRun = {
  reading: boolean;
  step: number;
  total: number;
  label: string;
};

export type CampaignSync = {
  state: "unknown" | "live" | "missing" | "error";
  detail: string;
  paused: boolean;
};

export function emptyCampaignSync(): CampaignSync {
  return { state: "unknown", detail: "", paused: false };
}

export function idleAether(): AetherRun {
  return { reading: false, step: 0, total: 1, label: "" };
}

type Workspace = Record<string, Row[]>;

type AidylState = {
  operatorName: string;
  customCrms: CustomCrm[];
  specialists: Specialist[];
  workspaces: Record<string, Workspace>;
  activity: ActivityEvent[];
  training: TrainingDoc[];
  threads: Record<string, ChatMessage[]>;
  minds: Record<string, Mind>;
  reminders: Reminder[];
  notices: Notice[];
  reports: SavedReport[];
  notifyAsked: boolean;
  igWatch: IgWatch;
  socialWatch: SocialWatch;
  recommendations: Recommendation[];
  decisions: Decision[];
  beats: AgentBeat[];
  tableWatch: TableWatch;
  controls: DeskControls;
  aetherRun: AetherRun;
  campaigns: Campaign[];
  campaignSync: CampaignSync;
  navOpen: boolean;
  setOperatorName: (name: string) => void;
  setNavOpen: (open: boolean) => void;
  addCrm: (crm: CustomCrm) => void;
  removeCrm: (slug: string) => void;
  addSpecialist: (s: Specialist) => void;
  removeSpecialist: (id: string) => void;
  ensureWorkspace: (slug: string) => Workspace;
  setRows: (slug: string, table: string, rows: Row[]) => void;
  pushActivity: (event: ActivityEvent) => void;
  upsertTraining: (doc: TrainingDoc) => void;
  removeTraining: (id: string) => void;
  replaceTraining: (docs: TrainingDoc[]) => void;
  pushMessage: (thread: string, message: ChatMessage) => void;
  setMind: (thread: string, mind: Mind) => void;
  clearThread: (thread: string) => void;
  addReminder: (reminder: Reminder) => void;
  removeReminder: (id: string) => void;
  markReminderFired: (id: string) => void;
  pushNotice: (notice: Omit<Notice, "id" | "at">) => void;
  markNoticeRead: (id: string) => void;
  markAllNoticesRead: () => void;
  archiveReport: (report: Omit<SavedReport, "id" | "at">) => void;
  setNotifyAsked: (asked: boolean) => void;
  setIgWatch: (watch: IgWatch) => void;
  setSocialWatch: (watch: SocialWatch) => void;
  setTableWatch: (watch: TableWatch) => void;
  setControls: (controls: DeskControls) => void;
  setAetherRun: (run: AetherRun) => void;
  addRecommendation: (rec: Recommendation) => void;
  ingestAether: (events: {
    id: string;
    at: string;
    notice: { title: string; body: string; href?: string; kind?: Notice["kind"] };
    recommendation?: Recommendation;
    campaign?: Campaign;
    beat?: { agent: AgentBeat["agent"]; phase: string; text: string; href?: string };
    firedReminderId?: string;
  }[]) => void;
  noteServerWatch: (lastCheck: string, lastError: string) => void;
  setCampaigns: (campaigns: Campaign[]) => void;
  upsertCampaign: (campaign: Campaign) => void;
  mergeServerCampaigns: (campaigns: Campaign[]) => void;
  setCampaignSync: (sync: CampaignSync) => void;
  setRecommendationStatus: (id: string, status: Recommendation["status"], note?: string) => void;
  addDecision: (decision: Omit<Decision, "id" | "at">) => void;
  pushBeat: (beat: Omit<AgentBeat, "id" | "at">) => void;
};

const memoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function seedWorkspace(slug: string): Workspace {
  if (slug === "betterdealtv") {
    return {
      tbl_leads: [
        {
          lead_id: "bd-lead-104",
          name: "Elena Vasquez",
          email: "elena@northbaymotors.example",
          phone: "+1 415 555 0144",
          location: "Oakland, USA",
          preferredVehicle: "2022 Toyota Highlander",
          budget: 28000,
          downPayment: 4000,
          creditStatus: "good",
          stage: "showroom",
          statuses: ["appointment"],
          timeline: "This month",
          assignedRep: "Studio A",
          createdAt: "2026-08-02T15:00:00.000Z",
          lastActivity: "2026-08-12T15:00:00.000Z",
        },
        {
          lead_id: "bd-lead-118",
          name: "Marcus Hale",
          email: "marcus.hale@example.com",
          phone: "+1 702 555 0190",
          location: "Las Vegas, USA",
          preferredVehicle: "Ford F-150 XLT",
          budget: 41000,
          downPayment: 6000,
          creditStatus: "excellent",
          stage: "quote",
          statuses: ["hot"],
          timeline: "2 weeks",
          assignedRep: "Studio B",
          createdAt: "2026-07-18T18:10:00.000Z",
          lastActivity: "2026-08-01T18:10:00.000Z",
        },
      ],
      tbl_calls: [
        {
          call_id: "bd-call-1",
          Caller: "Elena Vasquez",
          lead_id: "bd-lead-104",
          direction: "Inbound",
          outcome: "Booked Saturday walkaround",
          notes: "Wants the Highlander featured on Thursday's slot.",
          timestamp: "2026-08-11T20:00:00.000Z",
        },
      ],
      tbl_financing: [],
      tbl_logistics: [],
      tbl_ports: [],
      tbl_shipment: [],
      tbl_workflow_logs: [],
    };
  }
  if (slug === "associate-logistics") {
    return {
      tbl_ports: [
        {
          port_id: "al-port-1",
          port_name: "Port of Savannah",
          port_code: "SAV",
          city: "Savannah",
          state: "Georgia",
          country: "United States",
          container_supported: "Yes",
          roro_supported: "Yes",
          shipping_partner: "Aidyl haulage",
          active_status: "Active",
          supported_destination_countries: "Nigeria, Ghana, Liberia",
        },
      ],
      tbl_logistics: [
        {
          logistics_id: "al-log-1",
          logistics_status: "Quoted",
          origin_note: "Atlanta yard to Savannah",
          inland_transport_cost: 980,
          ocean_freight_cost: 0,
          clearance_cost: 0,
          insurance_cost: 140,
          other_fees: 75,
          total_logistics_cost: 1195,
          estimated_transit_time: "2 days inland",
          last_updated: "2026-08-20T12:00:00.000Z",
          lead_id: "yard-44",
        },
      ],
      tbl_leads: [],
      tbl_financing: [],
      tbl_shipment: [],
      tbl_calls: [],
      tbl_workflow_logs: [],
    };
  }
  if (slug === "carshipy") {
    return {
      tbl_leads: [],
      tbl_financing: [],
      tbl_logistics: [],
      tbl_ports: [],
      tbl_shipment: [],
      tbl_calls: [],
      tbl_workflow_logs: [],
    };
  }
  return {
    tbl_leads: [],
    tbl_financing: [],
    tbl_logistics: [],
    tbl_ports: [],
    tbl_shipment: [],
    tbl_calls: [],
    tbl_workflow_logs: [],
  };
}

export const useAidyl = create<AidylState>()(
  persist(
    (set, get) => ({
      operatorName: "Admin",
      customCrms: [],
      specialists: [],
      workspaces: {
        betterdealtv: seedWorkspace("betterdealtv"),
        "associate-logistics": seedWorkspace("associate-logistics"),
      },
      activity: [],
      training: [
        {
          id: "seed-maya-roro",
          lead_id: "agent-maya",
          context_type: "train-seed-roro",
          agent: "maya",
          title: "West Africa routing",
          body: "Carshipy prefers RoRo out of Savannah or Baltimore for trucks and SUVs bound for Nigeria and Ghana. Container is for overflow and sedans when RoRo space is tight. Always attach a lead before a shipment is written. Do not treat a late stage as settled if the vehicle or location is missing.",
          createdAt: "2026-06-01T00:00:00.000Z",
        },
        {
          id: "seed-randolph-desk",
          lead_id: "agent-randolph",
          context_type: "train-seed-desk",
          agent: "randolph",
          title: "How the modules split",
          body: "Carshipy is the live export book on the Dynamo tables: leads, financing, sourcing, and shipments. The old Ogamoto name is retired, and there is no separate booking CRM. BetterDealTV is the media module across YouTube, Instagram, TikTok, and betterdealtv.com. Associate Logistics USA is inland US haulage. Randolph sees every module. Maya stays on Carshipy. Aether watches the tables and writes only after the administrator approves.",
          createdAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      threads: {},
      minds: {},
      reminders: [],
      notices: [],
      reports: [],
      notifyAsked: false,
      igWatch: emptyWatch(),
      socialWatch: emptySocialWatch(),
      recommendations: [],
      decisions: [],
      beats: [],
      tableWatch: emptyTableWatch(),
      controls: defaultControls(),
      aetherRun: idleAether(),
      campaigns: [],
      campaignSync: emptyCampaignSync(),
      navOpen: false,
      setOperatorName: (operatorName) => set({ operatorName }),
      setNavOpen: (navOpen) => set({ navOpen }),
      addCrm: (crm) =>
        set((s) => ({
          customCrms: [...s.customCrms, crm],
          workspaces: { ...s.workspaces, [crm.slug]: seedWorkspace(crm.slug) },
        })),
      removeCrm: (slug) =>
        set((s) => {
          const workspaces = { ...s.workspaces };
          delete workspaces[slug];
          return {
            customCrms: s.customCrms.filter((c) => c.slug !== slug),
            specialists: s.specialists.filter((sp) => sp.crmSlug !== slug),
            workspaces,
          };
        }),
      addSpecialist: (specialist) => set((s) => ({ specialists: [...s.specialists, specialist] })),
      removeSpecialist: (id) => set((s) => ({ specialists: s.specialists.filter((sp) => sp.id !== id) })),
      ensureWorkspace: (slug) => {
        const existing = get().workspaces[slug];
        if (existing) return existing;
        const seeded = seedWorkspace(slug);
        set((s) => ({ workspaces: { ...s.workspaces, [slug]: seeded } }));
        return seeded;
      },
      setRows: (slug, table, rows) =>
        set((s) => ({
          workspaces: {
            ...s.workspaces,
            [slug]: { ...(s.workspaces[slug] ?? seedWorkspace(slug)), [table]: rows },
          },
        })),
      pushActivity: (event) => set((s) => ({ activity: [event, ...s.activity].slice(0, 400) })),
      upsertTraining: (doc) =>
        set((s) => ({
          training: [doc, ...s.training.filter((t) => t.id !== doc.id)].slice(0, 200),
        })),
      removeTraining: (id) => set((s) => ({ training: s.training.filter((t) => t.id !== id) })),
      replaceTraining: (docs) => set({ training: docs }),
      pushMessage: (thread, message) =>
        set((s) => ({
          threads: {
            ...s.threads,
            [thread]: [...(s.threads[thread] ?? []), message].slice(-80),
          },
        })),
      setMind: (thread, mind) => set((s) => ({ minds: { ...s.minds, [thread]: mind } })),
      clearThread: (thread) =>
        set((s) => ({
          threads: { ...s.threads, [thread]: [] },
          minds: { ...s.minds, [thread]: {} },
        })),
      addReminder: (reminder) => set((s) => ({ reminders: [reminder, ...s.reminders].slice(0, 40) })),
      removeReminder: (id) => set((s) => ({ reminders: s.reminders.filter((item) => item.id !== id) })),
      markReminderFired: (id) =>
        set((s) => ({
          reminders: s.reminders.map((item) => (item.id === id ? { ...item, fired: true } : item)),
        })),
      pushNotice: (notice) =>
        set((s) => {
          if (notice.href === "/campaigns" && s.notices.some((item) => item.href === "/campaigns" && item.title === notice.title)) {
            return {};
          }
          return { notices: [{ id: uid("note"), at: nowIso(), read: false, ...notice }, ...s.notices].slice(0, 60) };
        }),
      markNoticeRead: (id) =>
        set((s) => ({
          notices: s.notices.map((item) => (item.id === id ? { ...item, read: true } : item)),
        })),
      markAllNoticesRead: () =>
        set((s) => ({
          notices: s.notices.map((item) => ({ ...item, read: true })),
        })),
      archiveReport: (report) =>
        set((s) => ({
          reports: [{ ...report, id: uid("rpt"), at: nowIso() }, ...s.reports].slice(0, 24),
        })),
      setNotifyAsked: (notifyAsked) => set({ notifyAsked }),
      setIgWatch: (igWatch) => set({ igWatch }),
      setSocialWatch: (socialWatch) => set({ socialWatch }),
      setTableWatch: (tableWatch) => set({ tableWatch }),
      setControls: (controls) => set({ controls }),
      setAetherRun: (aetherRun) => set({ aetherRun }),
      addRecommendation: (rec) => set((s) => ({ recommendations: [rec, ...s.recommendations].slice(0, 80) })),
      ingestAether: (events) =>
        set((s) => {
          let notices = s.notices;
          let recommendations = s.recommendations;
          let beats = s.beats;
          let reminders = s.reminders;
          let campaigns = s.campaigns;
          for (const event of events) {
            if (event.firedReminderId) {
              reminders = reminders.map((item) => (item.id === event.firedReminderId ? { ...item, fired: true } : item));
            }
            if (event.campaign) campaigns = mergeCampaigns(campaigns, [event.campaign]);
            const fingerprint = event.recommendation?.fingerprint;
            const known = fingerprint ? recommendations.some((item) => item.fingerprint === fingerprint) : false;
            const duplicateCampaign =
              event.notice.href === "/campaigns" && notices.some((item) => item.href === "/campaigns" && item.title === event.notice.title);
            if (event.recommendation && !known && !recommendations.some((item) => item.id === event.recommendation!.id)) {
              recommendations = [event.recommendation, ...recommendations];
            }
            if (!known && !duplicateCampaign && !notices.some((item) => item.id === event.id)) {
              notices = [{ id: event.id, at: event.at, read: false, ...event.notice }, ...notices];
            }
            if (event.beat && !beats.some((item) => item.id === event.id)) {
              beats = [{ id: event.id, at: event.at, ...event.beat }, ...beats];
            }
          }
          return {
            notices: notices.slice(0, 60),
            recommendations: recommendations.slice(0, 80),
            beats: beats.slice(0, 80),
            reminders,
            campaigns,
          };
        }),
      noteServerWatch: (lastCheck, lastError) =>
        set((s) => ({
          tableWatch: {
            ...s.tableWatch,
            lastCheck: lastCheck || s.tableWatch.lastCheck,
            lastError: lastError && !s.tableWatch.lastError ? lastError : s.tableWatch.lastError,
          },
        })),
      setCampaigns: (campaigns) => set({ campaigns }),
      upsertCampaign: (campaign) => set((s) => ({ campaigns: mergeCampaigns([campaign], s.campaigns) })),
      mergeServerCampaigns: (campaigns) => set((s) => ({ campaigns: mergeCampaigns(s.campaigns, campaigns) })),
      setCampaignSync: (campaignSync) => set({ campaignSync }),
      setRecommendationStatus: (id, status, note) =>
        set((s) => ({
          recommendations: s.recommendations.map((item) =>
            item.id === id ? { ...item, status, decisionNote: note ?? item.decisionNote } : item,
          ),
        })),
      addDecision: (decision) =>
        set((s) => ({
          decisions: [{ ...decision, id: uid("dec"), at: nowIso() }, ...s.decisions].slice(0, 120),
        })),
      pushBeat: (beat) =>
        set((s) => ({
          beats: [{ ...beat, id: uid("beat"), at: nowIso() }, ...s.beats].slice(0, 80),
        })),
    }),
    {
      name: "aidyl-systems",
      skipHydration: true,
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : localStorage)),
      partialize: (s) => ({
        operatorName: s.operatorName,
        customCrms: s.customCrms,
        specialists: s.specialists,
        workspaces: s.workspaces,
        activity: s.activity,
        training: s.training,
        threads: s.threads,
        minds: s.minds,
        reminders: s.reminders,
        notices: s.notices,
        reports: s.reports,
        notifyAsked: s.notifyAsked,
        igWatch: s.igWatch,
        socialWatch: s.socialWatch,
        recommendations: s.recommendations,
        decisions: s.decisions,
        beats: s.beats,
        tableWatch: s.tableWatch,
        controls: s.controls,
        campaigns: s.campaigns,
        campaignSync: s.campaignSync,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AidylState>;
        const training = (saved.training ?? current.training).map((doc) => {
          if (doc.id === "seed-randolph-desk" && /ogamoto|booking desk/i.test(doc.body)) {
            return current.training.find((item) => item.id === doc.id) ?? doc;
          }
          if (doc.id === "seed-maya-roro" && /Ogamoto prefers/.test(doc.body)) {
            return current.training.find((item) => item.id === doc.id) ?? doc;
          }
          return doc;
        });
        return {
          ...current,
          ...saved,
          training,
          reminders: saved.reminders ?? current.reminders,
          notices: saved.notices ?? current.notices,
          reports: saved.reports ?? current.reports,
          notifyAsked: saved.notifyAsked ?? false,
          igWatch: saved.igWatch ?? current.igWatch,
          socialWatch: saved.socialWatch ?? current.socialWatch,
          recommendations: saved.recommendations ?? current.recommendations,
          decisions: saved.decisions ?? current.decisions,
          beats: saved.beats ?? current.beats,
          tableWatch: saved.tableWatch ?? current.tableWatch,
          controls: saved.controls ?? current.controls,
          campaigns: saved.campaigns ?? current.campaigns,
          campaignSync: saved.campaignSync ?? current.campaignSync,
          aetherRun: idleAether(),
        };
      },
    },
  ),
);

export function blankActivity(partial: Omit<ActivityEvent, "id" | "at">): ActivityEvent {
  return { ...partial, id: uid("act"), at: nowIso() };
}
