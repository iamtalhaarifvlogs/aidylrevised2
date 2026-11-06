import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { emptyWatch, type IgWatch } from "./instagram";
import { seedWorkspace } from "./seed";
import type { Row } from "./schema";
import type { ActivityEvent, ChatMessage, CustomCrm, Mind, Notice, PhoneCampaign, Reminder, Specialist, TrainingDoc } from "./types";
import { nowIso, uid } from "./utils";

const KEY = "aidyl-android-v1";

export type DeskState = {
  ready: boolean;
  operatorName: string;
  customCrms: CustomCrm[];
  specialists: Specialist[];
  workspaces: Record<string, Record<string, Row[]>>;
  activity: ActivityEvent[];
  training: TrainingDoc[];
  threads: Record<string, ChatMessage[]>;
  minds: Record<string, Mind>;
  notices: Notice[];
  campaigns: PhoneCampaign[];
  reminders: Reminder[];
  igWatch: IgWatch;
  notifyWrites: boolean;
  morningBrief: boolean;
  notifyAsked: boolean;
};

function initial(): DeskState {
  return {
    ready: false,
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
        body: "Carshipy prefers RoRo out of Savannah or Baltimore for trucks and SUVs bound for Nigeria and Ghana. Container is for overflow and sedans when RoRo space is tight. Always attach a lead before a shipment is written.",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "seed-randolph-desk",
        lead_id: "agent-randolph",
        context_type: "train-seed-desk",
        agent: "randolph",
        title: "How the companies split",
        body: "Carshipy owns the export buyer and the live tables. BetterDealTV is media: YouTube, Instagram, TikTok, and the site, plus leads. Associate Logistics USA is inland US haulage, kept on this phone. Randolph can see every company. Maya stays on Carshipy. Aether writes a row only after you approve.",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    threads: {},
    minds: {},
    notices: [],
    campaigns: [],
    reminders: [],
    igWatch: emptyWatch(),
    notifyWrites: true,
    morningBrief: false,
    notifyAsked: false,
  };
}

let state = initial();
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function freshenTraining(docs: DeskState["training"]) {
  return docs.map((doc) => {
    if (doc.id === "seed-maya-roro" && /ogamoto/i.test(doc.body)) {
      return { ...doc, body: initial().training[0].body };
    }
    if (doc.id === "seed-randolph-desk" && /ogamoto|booking desk/i.test(doc.body)) {
      return { ...doc, body: initial().training[1].body };
    }
    return doc;
  });
}

function emit(persist: boolean) {
  listeners.forEach((listener) => listener());
  if (!persist || !state.ready) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const { ready: _ready, ...rest } = state;
    void AsyncStorage.setItem(KEY, JSON.stringify(rest));
  }, 200);
}

export function getState() {
  return state;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDesk() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function patch(partial: Partial<DeskState>) {
  state = { ...state, ...partial };
  emit(true);
}

export async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<DeskState>;
      state = {
        ...initial(),
        ...saved,
        ready: true,
        reminders: saved.reminders ?? [],
        notices: saved.notices ?? [],
        campaigns: saved.campaigns ?? [],
        igWatch: saved.igWatch ?? initial().igWatch,
        notifyAsked: saved.notifyAsked ?? false,
        training: freshenTraining(saved.training ?? initial().training),
      };
    } else {
      state = { ...initial(), ready: true };
    }
  } catch {
    state = { ...initial(), ready: true };
  }
  emit(false);
}

export function ensureWorkspace(slug: string) {
  const existing = state.workspaces[slug];
  if (existing) return existing;
  const seeded = seedWorkspace(slug);
  state = { ...state, workspaces: { ...state.workspaces, [slug]: seeded } };
  emit(true);
  return seeded;
}

export function setRows(slug: string, table: string, rows: Row[]) {
  const current = ensureWorkspace(slug);
  state = {
    ...state,
    workspaces: { ...state.workspaces, [slug]: { ...current, [table]: rows } },
  };
  emit(true);
}

export function pushActivity(event: Omit<ActivityEvent, "id" | "at"> & { at?: string }) {
  const next: ActivityEvent = { id: uid("act"), at: event.at ?? nowIso(), ...event };
  state = { ...state, activity: [next, ...state.activity].slice(0, 80) };
  emit(true);
}

export function upsertTraining(doc: TrainingDoc) {
  state = { ...state, training: [doc, ...state.training.filter((item) => item.id !== doc.id)] };
  emit(true);
}

export function removeTraining(id: string) {
  state = { ...state, training: state.training.filter((item) => item.id !== id) };
  emit(true);
}

export function replaceTraining(docs: TrainingDoc[]) {
  state = { ...state, training: docs };
  emit(true);
}

export function pushMessage(thread: string, message: ChatMessage) {
  const prev = state.threads[thread] ?? [];
  state = { ...state, threads: { ...state.threads, [thread]: [...prev, message].slice(-40) } };
  emit(true);
}

export function setMind(thread: string, mind: Mind) {
  state = { ...state, minds: { ...state.minds, [thread]: mind } };
  emit(true);
}

export function clearThread(thread: string) {
  state = { ...state, threads: { ...state.threads, [thread]: [] }, minds: { ...state.minds, [thread]: {} } };
  emit(true);
}

export function upsertCampaign(campaign: PhoneCampaign) {
  const rest = state.campaigns.filter((item) => item.cp_id !== campaign.cp_id);
  state = { ...state, campaigns: [campaign, ...rest].slice(0, 40) };
  emit(true);
}

export function pushNotice(notice: Omit<Notice, "id" | "at">) {
  const next: Notice = { id: uid("note"), at: nowIso(), ...notice };
  state = { ...state, notices: [next, ...state.notices].slice(0, 40) };
  emit(true);
}

export function addCrm(crm: CustomCrm) {
  state = {
    ...state,
    customCrms: [...state.customCrms, crm],
    workspaces: { ...state.workspaces, [crm.slug]: seedWorkspace(crm.slug) },
  };
  emit(true);
}

export function removeCrm(slug: string) {
  const workspaces = { ...state.workspaces };
  delete workspaces[slug];
  state = {
    ...state,
    customCrms: state.customCrms.filter((crm) => crm.slug !== slug),
    specialists: state.specialists.filter((item) => item.crmSlug !== slug),
    workspaces,
  };
  emit(true);
}

export function addSpecialist(specialist: Specialist) {
  state = { ...state, specialists: [...state.specialists, specialist] };
  emit(true);
}

export function removeSpecialist(id: string) {
  state = { ...state, specialists: state.specialists.filter((item) => item.id !== id) };
  emit(true);
}

export function addReminder(reminder: Reminder) {
  state = { ...state, reminders: [reminder, ...state.reminders].slice(0, 40) };
  emit(true);
}

export function removeReminder(id: string) {
  state = { ...state, reminders: state.reminders.filter((item) => item.id !== id) };
  emit(true);
}

export function markReminderFired(id: string) {
  state = {
    ...state,
    reminders: state.reminders.map((item) => (item.id === id ? { ...item, fired: true } : item)),
  };
  emit(true);
}

export function setIgWatch(igWatch: IgWatch) {
  state = { ...state, igWatch };
  emit(true);
}
