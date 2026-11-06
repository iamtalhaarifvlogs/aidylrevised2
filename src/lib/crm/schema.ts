export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type Row = { [key: string]: JsonValue };

export type FieldKind = "text" | "number" | "date" | "textarea" | "auto-id" | "auto-now";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  ask?: boolean;
  list?: boolean;
  prompt?: string;
  hint?: string;
  idPrefix?: string;
};

export type TableDef = {
  id: string;
  label: string;
  singular: string;
  description: string;
  pk: string;
  sk?: string;
  dateField?: string;
  fields: FieldDef[];
};

const lead: TableDef = {
  id: "tbl_leads",
  label: "Leads",
  singular: "lead",
  description: "Buyers moving through qualification, deposit, and handoff.",
  pk: "lead_id",
  dateField: "createdAt",
  fields: [
    { key: "lead_id", label: "Lead ID", kind: "auto-id", idPrefix: "lead" },
    { key: "name", label: "Name", kind: "text", required: true, ask: true, prompt: "What is the lead's name?" },
    { key: "email", label: "Email", kind: "text", required: true, ask: true, prompt: "What email should we keep for them?" },
    { key: "phone", label: "Phone", kind: "text", required: true, ask: true, prompt: "What phone number?" },
    { key: "location", label: "Location", kind: "text", required: true, ask: true, prompt: "Where are they based? City and country is enough." },
    { key: "preferredVehicle", label: "Preferred vehicle", kind: "text", required: true, ask: true, prompt: "Which vehicle do they want?" },
    { key: "budget", label: "Budget", kind: "text", ask: true, prompt: "What's their budget?" },
    { key: "downPayment", label: "Down payment", kind: "text", ask: true, prompt: "How much can they put down?" },
    { key: "creditStatus", label: "Credit status", kind: "text", ask: true, hint: "excellent, good, fair, poor", prompt: "How does their credit look? Excellent, good, fair, or poor." },
    { key: "stage", label: "Stage", kind: "text", required: true, ask: true, hint: "Discovery, maya_qualification, rep_handoff, vehicle_sourcing, deposit_requested, deposit_paid", prompt: "Which stage are they in?" },
    { key: "statuses", label: "Statuses", kind: "text", list: true, ask: true, hint: "new lead, hot, qualified", prompt: "Any status tags? For example hot or qualified. Say skip if none." },
    { key: "timeline", label: "Timeline", kind: "text", ask: true, prompt: "When do they want the vehicle?" },
    { key: "assignedRep", label: "Assigned rep", kind: "text", ask: true, prompt: "Who is the assigned rep?" },
    { key: "createdAt", label: "Created", kind: "auto-now" },
    { key: "lastActivity", label: "Last activity", kind: "auto-now" },
  ],
};

const financing: TableDef = {
  id: "tbl_financing",
  label: "Financing",
  singular: "financing partner",
  description: "Banks and lenders, rates, and what they will underwrite.",
  pk: "financing_id",
  fields: [
    { key: "financing_id", label: "Financing ID", kind: "auto-id", idPrefix: "fin" },
    { key: "partner_name", label: "Partner", kind: "text", required: true, ask: true, prompt: "What is the financing partner's name?" },
    { key: "partner_type", label: "Type", kind: "text", required: true, ask: true, hint: "Bank, Credit union, Captive", prompt: "What type of partner is this? Bank, credit union, or something else." },
    { key: "contact_email", label: "Contact email", kind: "text", ask: true, prompt: "What contact email should we store?" },
    { key: "interest_rate", label: "Interest rate", kind: "number", ask: true, prompt: "What interest rate, as a number?" },
    { key: "loan_term_months", label: "Term (months)", kind: "number", ask: true, prompt: "Loan term in months?" },
    { key: "max_loan_amount", label: "Max loan", kind: "number", ask: true, prompt: "Maximum loan amount?" },
    { key: "min_credit_score", label: "Min credit score", kind: "number", ask: true, prompt: "Minimum credit score they accept?" },
    { key: "processing_fee", label: "Processing fee", kind: "number", ask: true, prompt: "Processing fee?" },
    { key: "approval_time_days", label: "Approval days", kind: "number", ask: true, prompt: "Typical approval time in days?" },
    { key: "supported_countries", label: "Countries", kind: "text", list: true, ask: true, prompt: "Which countries do they support?" },
    { key: "active_status", label: "Status", kind: "text", required: true, ask: true, hint: "Active, Paused", prompt: "Are they Active or Paused?" },
    { key: "notes", label: "Notes", kind: "textarea", ask: true, prompt: "Any notes a closer should know?" },
  ],
};

const logistics: TableDef = {
  id: "tbl_logistics",
  label: "Logistics",
  singular: "logistics record",
  description: "Freight, insurance, clearance, and inland cost sheets.",
  pk: "logistics_id",
  dateField: "last_updated",
  fields: [
    { key: "logistics_id", label: "Logistics ID", kind: "auto-id", idPrefix: "log" },
    { key: "lead_id", label: "Lead", kind: "text", ask: true, prompt: "Which lead is this cost sheet for? A name is enough." },
    { key: "shipment_id", label: "Shipment ID", kind: "text", ask: true, prompt: "Related shipment id, if there is one?" },
    { key: "vehicle_id", label: "Vehicle ID", kind: "text", ask: true, prompt: "Vehicle id?" },
    { key: "logistics_status", label: "Status", kind: "text", required: true, ask: true, hint: "Quoted, Booked, In transit, Delivered", prompt: "Logistics status?" },
    { key: "estimated_transit_time", label: "Estimated transit", kind: "text", ask: true, prompt: "Estimated transit time?" },
    { key: "actual_transit_time", label: "Actual transit", kind: "text", ask: true, prompt: "Actual transit time, if known? Say skip if not." },
    { key: "ocean_freight_cost", label: "Ocean freight", kind: "number", ask: true, prompt: "Ocean freight cost?" },
    { key: "inland_transport_cost", label: "Inland transport", kind: "number", ask: true, prompt: "Inland transport cost?" },
    { key: "clearance_cost", label: "Clearance", kind: "number", ask: true, prompt: "Clearance cost?" },
    { key: "insurance_cost", label: "Insurance", kind: "number", ask: true, prompt: "Insurance cost?" },
    { key: "other_fees", label: "Other fees", kind: "number", ask: true, prompt: "Any other fees?" },
    { key: "total_logistics_cost", label: "Total cost", kind: "number", ask: true, prompt: "Total logistics cost? I can sum the pieces if you say so." },
    { key: "tracking_number", label: "Tracking number", kind: "text", ask: true, prompt: "Tracking number?" },
    { key: "last_updated", label: "Last updated", kind: "auto-now" },
  ],
};

const ports: TableDef = {
  id: "tbl_ports",
  label: "Ports",
  singular: "port",
  description: "Origin ports, partners, and what each terminal can lift.",
  pk: "port_id",
  fields: [
    { key: "port_id", label: "Port ID", kind: "auto-id", idPrefix: "port" },
    { key: "port_name", label: "Port name", kind: "text", required: true, ask: true, prompt: "What is the port called?" },
    { key: "port_code", label: "Code", kind: "text", ask: true, prompt: "Port code?" },
    { key: "city", label: "City", kind: "text", required: true, ask: true, prompt: "Which city?" },
    { key: "state", label: "State", kind: "text", ask: true, prompt: "State or region?" },
    { key: "country", label: "Country", kind: "text", required: true, ask: true, prompt: "Country?" },
    { key: "container_supported", label: "Container", kind: "text", ask: true, hint: "Yes, No", prompt: "Container supported? Yes or no." },
    { key: "roro_supported", label: "RoRo", kind: "text", ask: true, hint: "Yes, No", prompt: "RoRo supported? Yes or no." },
    { key: "shipping_partner", label: "Shipping partner", kind: "text", ask: true, prompt: "House shipping partner?" },
    { key: "active_status", label: "Status", kind: "text", required: true, ask: true, prompt: "Active or inactive?" },
    { key: "supported_destination_countries", label: "Destinations", kind: "textarea", ask: true, prompt: "Which destination countries does this port serve?" },
  ],
};

const shipment: TableDef = {
  id: "tbl_shipment",
  label: "Shipments",
  singular: "shipment",
  description: "Bookings from origin yard to destination country.",
  pk: "shipment_id",
  dateField: "departure_date",
  fields: [
    { key: "shipment_id", label: "Shipment ID", kind: "auto-id", idPrefix: "ship" },
    { key: "shipment_number", label: "Shipment number", kind: "text", ask: true, prompt: "Carrier shipment or booking number?" },
    { key: "lead_id", label: "Lead", kind: "text", required: true, ask: true, prompt: "Which lead is this for? Give me their name and I will fetch the id." },
    { key: "vehicle_id", label: "Vehicle ID", kind: "text", ask: true, prompt: "Vehicle id?" },
    { key: "shipment_status", label: "Status", kind: "text", required: true, ask: true, hint: "Quoted, Booked, In transit, Arrived, Delivered", prompt: "Shipment status?" },
    { key: "origin_location", label: "Origin", kind: "text", required: true, ask: true, prompt: "Where does it leave from?" },
    { key: "destination_country", label: "Destination country", kind: "text", required: true, ask: true, prompt: "Destination country?" },
    { key: "port_used", label: "Port used", kind: "text", ask: true, prompt: "Which port are we booking?" },
    { key: "actual_port_used", label: "Actual port", kind: "text", ask: true, prompt: "Actual port used, if it differs? Say same if it matches." },
    { key: "shipping_line", label: "Shipping line", kind: "text", required: true, ask: true, prompt: "Which shipping line?" },
    { key: "vessel_name", label: "Vessel", kind: "text", ask: true, prompt: "Vessel name?" },
    { key: "departure_date", label: "Departure", kind: "date", ask: true, prompt: "Departure date? YYYY-MM-DD is perfect." },
    { key: "arrival_date", label: "Arrival", kind: "date", ask: true, prompt: "Estimated arrival date?" },
    { key: "estimated_transit_time", label: "Transit estimate", kind: "text", ask: true, prompt: "Estimated transit time?" },
    { key: "ocean_freight_cost", label: "Ocean freight", kind: "number", ask: true, prompt: "Ocean freight cost?" },
    { key: "inland_transport_cost", label: "Inland transport", kind: "number", ask: true, prompt: "Inland transport cost?" },
    { key: "total_logistics_cost", label: "Total logistics", kind: "number", ask: true, prompt: "Total logistics cost? I can add ocean and inland if you want." },
  ],
};

const calls: TableDef = {
  id: "tbl_calls",
  label: "Calls",
  singular: "call",
  description: "Conversations with buyers, reps, and partners.",
  pk: "call_id",
  dateField: "timestamp",
  fields: [
    { key: "call_id", label: "Call ID", kind: "auto-id", idPrefix: "call" },
    { key: "Caller", label: "Caller", kind: "text", required: true, ask: true, prompt: "Who was on the call?" },
    { key: "lead_id", label: "Lead", kind: "text", ask: true, prompt: "Which lead, if any? A name works." },
    { key: "phone", label: "Phone", kind: "text", ask: true, prompt: "Phone number dialed?" },
    { key: "direction", label: "Direction", kind: "text", ask: true, hint: "Inbound, Outbound", prompt: "Inbound or outbound?" },
    { key: "outcome", label: "Outcome", kind: "text", ask: true, prompt: "What was the outcome?" },
    { key: "notes", label: "Notes", kind: "textarea", ask: true, prompt: "Notes from the call?" },
    { key: "timestamp", label: "When", kind: "auto-now" },
  ],
};

const logs: TableDef = {
  id: "tbl_workflow_logs",
  label: "Workflow logs",
  singular: "workflow log",
  description: "Every write the desk makes, including agent work.",
  pk: "lead_id",
  sk: "timestamp",
  dateField: "timestamp",
  fields: [
    { key: "lead_id", label: "Lead", kind: "text", required: true, ask: true, prompt: "Which lead id should this log hang on? Use aidyl-system for desk-level events." },
    { key: "timestamp", label: "Timestamp", kind: "auto-now" },
    { key: "workflowName", label: "Workflow", kind: "text", ask: true, prompt: "Workflow name?" },
    { key: "action", label: "Action", kind: "text", required: true, ask: true, prompt: "What action?" },
    { key: "status", label: "Status", kind: "text", ask: true, prompt: "Status of the action?" },
    { key: "message", label: "Message", kind: "textarea", ask: true, prompt: "Short message?" },
    { key: "details", label: "Details", kind: "textarea", ask: true, prompt: "Any extra detail?" },
    { key: "performed_by", label: "Performed by", kind: "text", ask: true, prompt: "Who performed it?" },
  ],
};

const campaigns: TableDef = {
  id: "tbl_campaigns",
  label: "Campaigns",
  singular: "campaign",
  description: "Proposals Randolph and Maya file for the administrator to accept or refuse.",
  pk: "cp_id",
  dateField: "created_at",
  fields: [
    { key: "cp_id", label: "Campaign ID", kind: "auto-id", idPrefix: "cp" },
    { key: "company", label: "Company", kind: "text" },
    { key: "title", label: "Title", kind: "text", required: true },
    { key: "status", label: "Status", kind: "text", required: true },
    { key: "origin", label: "Origin", kind: "text" },
    { key: "analyst", label: "Analyst", kind: "text" },
    { key: "objective", label: "Objective", kind: "textarea" },
    { key: "audience", label: "Audience", kind: "textarea" },
    { key: "channels", label: "Channels", kind: "text" },
    { key: "why_now", label: "Why now", kind: "textarea" },
    { key: "evidence_json", label: "Evidence", kind: "textarea" },
    { key: "message", label: "Message", kind: "textarea" },
    { key: "offer", label: "Offer", kind: "textarea" },
    { key: "activities", label: "Activities", kind: "textarea" },
    { key: "schedule", label: "Schedule", kind: "textarea" },
    { key: "budget_note", label: "Budget", kind: "textarea" },
    { key: "risks", label: "Risks", kind: "textarea" },
    { key: "fingerprint", label: "Fingerprint", kind: "text" },
    { key: "priority_score", label: "Priority", kind: "number" },
    { key: "priority_json", label: "Priority factors", kind: "textarea" },
    { key: "forecast_json", label: "Forecast", kind: "textarea" },
    { key: "assets_json", label: "Assets", kind: "textarea" },
    { key: "lesson_in", label: "Prior lesson", kind: "textarea" },
    { key: "decision", label: "Decision", kind: "text" },
    { key: "decision_note", label: "Decision note", kind: "textarea" },
    { key: "decision_at", label: "Decided", kind: "text" },
    { key: "results_json", label: "Results", kind: "textarea" },
    { key: "lesson", label: "Lesson", kind: "textarea" },
    { key: "created_at", label: "Created", kind: "auto-now" },
    { key: "updated_at", label: "Updated", kind: "text" },
  ],
};

const maya: TableDef = {
  id: "tbl_maya",
  label: "Agent memory",
  singular: "memory",
  description: "Training notes Randolph and Maya read before they answer.",
  pk: "lead_id",
  sk: "context_type",
  dateField: "createdAt",
  fields: [
    { key: "lead_id", label: "Scope key", kind: "text", required: true },
    { key: "context_type", label: "Context", kind: "text", required: true },
    { key: "title", label: "Title", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
    { key: "agent", label: "Agent", kind: "text" },
    { key: "createdAt", label: "Created", kind: "auto-now" },
  ],
};

export const TABLES: TableDef[] = [lead, financing, logistics, ports, shipment, calls, campaigns, logs, maya];

export const DATA_TABLES = TABLES.filter((t) => t.id !== "tbl_maya" && t.id !== "tbl_workflow_logs" && t.id !== "tbl_campaigns");

export function tableById(id: string) {
  return TABLES.find((t) => t.id === id);
}

export function tableBySingular(word: string) {
  const w = word.toLowerCase();
  return TABLES.find((t) => {
    const bag = `${t.singular} ${t.label} ${t.id}`.toLowerCase();
    if (w.includes("financ")) return t.id === "tbl_financing";
    if (w.includes("ship")) return t.id === "tbl_shipment";
    if (w.includes("port")) return t.id === "tbl_ports";
    if (w.includes("logistic")) return t.id === "tbl_logistics";
    if (w.includes("call")) return t.id === "tbl_calls";
    if (w.includes("campaign")) return t.id === "tbl_campaigns";
    if (w.includes("lead")) return t.id === "tbl_leads";
    if (w.includes("log") || w.includes("activity")) return t.id === "tbl_workflow_logs";
    return bag.includes(w);
  });
}

export const SECTION_TABLE: Record<string, string> = {
  leads: "tbl_leads",
  financing: "tbl_financing",
  logistics: "tbl_logistics",
  ports: "tbl_ports",
  shipments: "tbl_shipment",
  calls: "tbl_calls",
  "workflow-logs": "tbl_workflow_logs",
  memory: "tbl_maya",
};

export const NAV_SECTIONS = [
  { id: "training", label: "Train" },
  { id: "leads", label: "Leads" },
  { id: "shipments", label: "Shipments" },
  { id: "logistics", label: "Logistics" },
  { id: "ports", label: "Ports" },
  { id: "financing", label: "Financing" },
  { id: "calls", label: "Calls" },
  { id: "activity", label: "Activity" },
  { id: "reports", label: "Reports" },
];

export const MEDIA_SECTIONS = [
  { id: "youtube", label: "YouTube" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "website", label: "Website" },
  { id: "leads", label: "Leads" },
  { id: "reports", label: "Reports" },
  { id: "training", label: "Train" },
];

export function sectionsFor(slug: string) {
  return slug === "betterdealtv" ? MEDIA_SECTIONS : NAV_SECTIONS;
}

export function askableFields(table: TableDef) {
  return table.fields.filter((f) => f.ask);
}

export function requiredFields(table: TableDef) {
  return table.fields.filter((f) => f.required && f.ask);
}
