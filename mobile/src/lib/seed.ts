import type { Row } from "./schema";

export function seedWorkspace(slug: string): Record<string, Row[]> {
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
      tbl_shipment: [
        {
          shipment_id: "cs-ship-1",
          shipment_number: "RORO-4419",
          lead_id: "cs-lead-2",
          vehicle_id: "veh-cs-2",
          shipment_status: "Booked",
          origin_location: "Baltimore, MD",
          destination_country: "Ghana",
          port_used: "Port of Baltimore",
          actual_port_used: "Port of Baltimore",
          shipping_line: "Grimaldi",
          vessel_name: "Grande Nigeria",
          departure_date: "2026-09-04",
          arrival_date: "2026-10-02",
          estimated_transit_time: "26-30 days",
          ocean_freight_cost: 2100,
          inland_transport_cost: 640,
          total_logistics_cost: 2740,
        },
      ],
      tbl_leads: [
        {
          lead_id: "cs-lead-2",
          name: "Kojo Mensah",
          email: "kojo@example.com",
          phone: "+233 20 555 0188",
          location: "Tema, Ghana",
          preferredVehicle: "Honda CR-V",
          budget: 19000,
          stage: "booked",
          statuses: ["confirmed"],
          creditStatus: "good",
          timeline: "Sailing September",
          assignedRep: "Carshipy desk",
          createdAt: "2026-07-02T11:00:00.000Z",
          lastActivity: "2026-08-28T11:00:00.000Z",
          downPayment: 3500,
        },
      ],
      tbl_financing: [],
      tbl_logistics: [],
      tbl_ports: [],
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
