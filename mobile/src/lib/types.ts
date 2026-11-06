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

export type PhoneCampaign = {
  cp_id: string;
  title: string;
  audience: string;
  message: string;
  analyst: "maya" | "randolph";
  status: "proposed" | "approved" | "rejected" | "deferred";
  evidence: string[];
  why: string;
  fingerprint: string;
  created_at: string;
  decision_note: string;
  synced: boolean;
};

export type Notice = {
  id: string;
  at: string;
  title: string;
  body: string;
};

export type Reminder = {
  id: string;
  title: string;
  note: string;
  fireAt: string;
  createdBy: string;
  fired: boolean;
  /** True when the phone clock itself will tap, even if Aidyl is closed. */
  expoArmed?: boolean;
};
