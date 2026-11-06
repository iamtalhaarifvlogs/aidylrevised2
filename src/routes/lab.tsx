import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createRecord, updateRecord } from "@/lib/crm/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lab")({ component: LabPage });

type Kind = "lead" | "shipment" | "logistics" | "call";

const KINDS: { id: Kind; label: string; who: string }[] = [
  { id: "lead", label: "Lead", who: "Maya" },
  { id: "shipment", label: "Shipment", who: "Randolph" },
  { id: "logistics", label: "Logistics", who: "Randolph" },
  { id: "call", label: "Call", who: "Maya" },
];

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

function LabPage() {
  const [kind, setKind] = useState<Kind>("lead");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [written, setWritten] = useState<{ table: string; id: string; summary: string } | null>(null);
  const [lastLead, setLastLead] = useState("");

  const [name, setName] = useState("");
  const [stage, setStage] = useState("Discovery");
  const [location, setLocation] = useState("Lagos, Nigeria");
  const [vehicle, setVehicle] = useState("2018 Toyota Camry");
  const [budget, setBudget] = useState("12000");
  const [phone, setPhone] = useState("");

  const [leadId, setLeadId] = useState("");
  const [shipStatus, setShipStatus] = useState("Booked");
  const [destination, setDestination] = useState("Nigeria");
  const [arrival, setArrival] = useState(tomorrow);

  const [logStatus, setLogStatus] = useState("In transit");
  const [tracking, setTracking] = useState("");

  const [caller, setCaller] = useState("");
  const [outcome, setOutcome] = useState("Asked for the vehicle and a budget");

  const [editId, setEditId] = useState("");
  const [editValue, setEditValue] = useState("deposit_requested");

  async function write() {
    setBusy(true);
    setError("");
    try {
      if (kind === "lead") {
        if (!name.trim()) throw new Error("Give the lead a name so you can find it.");
        const item = await createRecord({
          slug: "carshipy",
          table: "tbl_leads",
          values: {
            name: name.trim(),
            email: "lab@aidyl.test",
            phone: phone.trim(),
            location,
            preferredVehicle: vehicle,
            budget,
            stage,
            creditStatus: "good",
            timeline: "This month",
          },
        });
        const id = String(item.lead_id);
        setLastLead(id);
        setLeadId(id);
        setEditId(id);
        setWritten({ table: "tbl_leads", id, summary: `${name.trim()} at ${stage}` });
      } else if (kind === "shipment") {
        if (!leadId.trim()) throw new Error("A shipment needs a lead id. Write a lead first, or paste one.");
        const item = await createRecord({
          slug: "carshipy",
          table: "tbl_shipment",
          values: {
            lead_id: leadId.trim(),
            shipment_status: shipStatus,
            destination_country: destination,
            arrival_date: arrival,
            origin_location: "Savannah",
            shipping_line: "Grimaldi",
          },
        });
        const id = String(item.shipment_id);
        setEditId(id);
        setEditValue("Delayed");
        setWritten({ table: "tbl_shipment", id, summary: `${shipStatus} to ${destination}` });
      } else if (kind === "logistics") {
        const item = await createRecord({
          slug: "carshipy",
          table: "tbl_logistics",
          values: {
            lead_id: leadId.trim(),
            logistics_status: logStatus,
            tracking_number: tracking.trim() || `LAB-${Date.now().toString(36).toUpperCase()}`,
          },
        });
        const id = String(item.logistics_id);
        setEditId(id);
        setEditValue("Hold");
        setWritten({ table: "tbl_logistics", id, summary: logStatus });
      } else {
        if (!caller.trim()) throw new Error("Who was on the call?");
        const item = await createRecord({
          slug: "carshipy",
          table: "tbl_calls",
          values: {
            Caller: caller.trim(),
            outcome,
            lead_id: leadId.trim(),
            direction: "Outbound",
          },
        });
        setWritten({ table: "tbl_calls", id: String(item.call_id), summary: outcome });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The live book refused the row.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRow() {
    setBusy(true);
    setError("");
    try {
      if (!editId.trim()) throw new Error("Paste the id of the row you want Aether to see change.");
      if (kind === "call") throw new Error("Aether only announces a call when it is new. Change a lead, shipment, or logistics row.");
      if (kind === "lead") {
        await updateRecord({
          slug: "carshipy",
          table: "tbl_leads",
          key: { lead_id: editId.trim() },
          patch: { stage: editValue.trim() || "deposit_requested" },
        });
        setWritten({ table: "tbl_leads", id: editId.trim(), summary: `Stage is now ${editValue.trim() || "deposit_requested"}` });
      } else if (kind === "shipment") {
        await updateRecord({
          slug: "carshipy",
          table: "tbl_shipment",
          key: { shipment_id: editId.trim() },
          patch: { shipment_status: editValue.trim() || "Delayed" },
        });
        setWritten({ table: "tbl_shipment", id: editId.trim(), summary: `Status is now ${editValue.trim() || "Delayed"}` });
      } else {
        await updateRecord({
          slug: "carshipy",
          table: "tbl_logistics",
          key: { logistics_id: editId.trim() },
          patch: { logistics_status: editValue.trim() || "Hold" },
        });
        setWritten({ table: "tbl_logistics", id: editId.trim(), summary: `Status is now ${editValue.trim() || "Hold"}` });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The live book refused the change.");
    } finally {
      setBusy(false);
    }
  }

  const who = KINDS.find((item) => item.id === kind)?.who ?? "Maya";

  return (
    <main className="px-4 py-6 md:px-8">
      <p className="text-xs tracking-wide text-brass">AETHER LAB</p>
      <h1 className="mt-1 font-display text-4xl">Write a live row</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        This goes into the real Carshipy book, not a copy. Aether reads it about once a minute. {who} will raise what it means. Nothing else is written until you approve it on the desk.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setKind(item.id);
              setError("");
              if (item.id === "lead") setEditValue("deposit_requested");
              if (item.id === "shipment") setEditValue("Delayed");
              if (item.id === "logistics") setEditValue("Hold");
            }}
            className={cn(
              "rounded-full px-4 py-2 text-sm",
              kind === item.id ? "bg-ink text-paper" : "border border-line bg-surface",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="mt-6 max-w-xl rounded-3xl border border-line bg-surface p-4 md:p-5">
        {kind === "lead" ? (
          <div className="grid gap-3">
            <Field label="Name" value={name} onChange={setName} placeholder="Amira Cole" />
            <Field label="Stage" value={stage} onChange={setStage} placeholder="Discovery" />
            <Field label="Location" value={location} onChange={setLocation} />
            <Field label="Vehicle" value={vehicle} onChange={setVehicle} />
            <Field label="Budget" value={budget} onChange={setBudget} />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="Optional. Leave blank to test a gap." />
          </div>
        ) : null}
        {kind === "shipment" ? (
          <div className="grid gap-3">
            <Field label="Lead id" value={leadId} onChange={setLeadId} placeholder={lastLead || "lead-123456"} />
            <Field label="Status" value={shipStatus} onChange={setShipStatus} placeholder="Booked" />
            <Field label="Destination country" value={destination} onChange={setDestination} />
            <Field label="Arrival" value={arrival} onChange={setArrival} />
          </div>
        ) : null}
        {kind === "logistics" ? (
          <div className="grid gap-3">
            <Field label="Lead id" value={leadId} onChange={setLeadId} placeholder="Optional" />
            <Field label="Status" value={logStatus} onChange={setLogStatus} placeholder="In transit" />
            <Field label="Tracking number" value={tracking} onChange={setTracking} placeholder="Filled in if you leave this blank" />
          </div>
        ) : null}
        {kind === "call" ? (
          <div className="grid gap-3">
            <Field label="Caller" value={caller} onChange={setCaller} placeholder="Amira Cole" />
            <Field label="Outcome" value={outcome} onChange={setOutcome} />
            <Field label="Lead id" value={leadId} onChange={setLeadId} placeholder="Optional" />
          </div>
        ) : null}
        <button type="button" disabled={busy} onClick={() => void write()} className="mt-4 rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50">
          {busy ? "Writing…" : "Add to the live book"}
        </button>
      </section>

      {kind !== "call" ? (
        <section className="mt-6 max-w-xl rounded-3xl border border-line bg-surface p-4 md:p-5">
          <h2 className="font-display text-2xl">Change one that already exists</h2>
          <p className="mt-1 text-sm text-muted">
            Aether treats a changed stage, shipment status, or logistics status as a new fact. Use Delayed or Hold if you want the warning.
          </p>
          <div className="mt-3 grid gap-3">
            <Field label="Record id" value={editId} onChange={setEditId} placeholder="The id from the last write" />
            <Field
              label={kind === "lead" ? "New stage" : "New status"}
              value={editValue}
              onChange={setEditValue}
            />
          </div>
          <button type="button" disabled={busy} onClick={() => void changeRow()} className="mt-4 rounded-full border border-line bg-bg px-4 py-2 text-sm disabled:opacity-50">
            {busy ? "Writing…" : "Update the live row"}
          </button>
        </section>
      ) : null}

      {error ? <p className="mt-4 max-w-xl text-sm text-clay">{error}</p> : null}
      {written ? (
        <p className="mt-4 max-w-xl rounded-xl border border-line bg-brass-soft px-4 py-3 text-sm">
          Wrote {written.table} {written.id}. {written.summary}. Give Aether about a minute. The bell is where Maya or Randolph will leave it.
        </p>
      ) : null}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2"
      />
    </label>
  );
}
