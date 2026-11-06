import assert from "node:assert/strict";
import { campaignIntent, decideCampaign, proposeCampaigns, recordCampaignResult, spokenBrief } from "./campaigns.ts";

const leads = [
  { lead_id: "l1", name: "Ada", stage: "deposit_requested", preferredVehicle: "", location: "Lagos", budget: "" },
  { lead_id: "l2", name: "Ben", stage: "Discovery", preferredVehicle: "Camry", location: "Accra", budget: "9000", creditStatus: "" },
  { lead_id: "l3", name: "Chi", stage: "Discovery", preferredVehicle: "Camry", location: "Accra", budget: "8000", creditStatus: "" },
  { lead_id: "l4", name: "Dan", stage: "Discovery", preferredVehicle: "Camry", location: "Accra", budget: "7000", creditStatus: "" },
  { lead_id: "l5", name: "Eve", stage: "Discovery", preferredVehicle: "Camry", location: "Accra", budget: "6000", creditStatus: "" },
];
const shipments = [
  { shipment_id: "s1", destination_country: "Nigeria", shipment_status: "Booked" },
  { shipment_id: "s2", destination_country: "Nigeria", shipment_status: "In transit" },
];
const financing = [{ financing_id: "f1", partner_name: "Harbor", interest_rate: 9.5, active_status: "Active" }];

const first = proposeCampaigns({
  leads,
  shipments,
  logistics: [],
  financing,
  ports: [],
  campaigns: [],
  now: "2026-10-21T00:00:00.000Z",
});
assert.ok(first.length >= 1 && first.length <= 2);
assert.equal(first[0].fingerprint.startsWith("late-gaps:"), true);
assert.equal(first[0].forecast.label, "insufficient");
assert.match(first[0].forecast.limitations.join(" "), /not a calibrated/);
assert.equal(/ROAS\s*[:=]\s*\d/.test(JSON.stringify(first)), false);
assert.equal(first[0].assets[0].status, "rendered");
assert.equal(first[0].assets[0].format, "svg");
const again = proposeCampaigns({
  leads,
  shipments,
  logistics: [],
  financing,
  ports: [],
  campaigns: first,
  now: "2026-10-21T01:00:00.000Z",
});
assert.equal(again.some((item) => first.some((prev) => prev.fingerprint === item.fingerprint)), false);
assert.equal(again.some((item) => item.fingerprint.startsWith("late-gaps:")), false);
const rejected = decideCampaign(first[0], "reject", "not now", "2026-10-21T02:00:00.000Z");
const afterReject = proposeCampaigns({
  leads,
  shipments,
  logistics: [],
  financing,
  ports: [],
  campaigns: [rejected],
  now: "2026-10-21T03:00:00.000Z",
});
assert.equal(afterReject.some((item) => item.fingerprint.startsWith("late-gaps:")), false);
const approved = decideCampaign(first[0], "approve", "work the calls", "2026-10-21T04:00:00.000Z");
assert.equal(approved.status, "approved");
assert.equal(approved.assets[0].approval, "approved");
const done = recordCampaignResult(approved, { contacted: "2", completed: "1", spend: "0", note: "Two calls." }, "2026-10-21T05:00:00.000Z");
assert.equal(done.forecast.baseline, approved.forecast.baseline);
assert.match(done.lesson, /Forecast kept unchanged/);
const said = "Prepare a campaign for people shipping cars to Nigeria, tell them not to pay before the vehicle and the lane are named.";
assert.equal(campaignIntent(said), true);
assert.equal(campaignIntent("make a campaign"), true);
assert.equal(campaignIntent("Tell the Nigeria buyers not to pay before the vehicle is named"), true);
assert.equal(campaignIntent("People shipping cars to Nigeria should hear that they must never pay before the lane is named"), true);
assert.equal(campaignIntent("add a lead for Lagos named Ada"), false);
assert.equal(campaignIntent("how many shipments to Nigeria"), false);
assert.equal(campaignIntent("what are the risks"), false);
assert.equal(campaignIntent("yeah"), false);
const brief = spokenBrief(said);
assert.equal(brief.thin, false);
assert.equal(brief.place.toLowerCase(), "nigeria");
assert.match(brief.title, /Nigeria/i);
assert.equal(brief.title.toLowerCase().startsWith("prepare a campaign"), false);
const thin = spokenBrief("make a campaign");
assert.equal(thin.thin, true);
console.log("campaign checks passed", first.map((item) => `${item.cp_id} ${item.priority_score} ${item.title}`).join(" | "));
