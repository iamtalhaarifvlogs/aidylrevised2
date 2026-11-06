import { downloadReport, type ReportSpec } from "@/lib/agents/pdf";
import { blankActivity, useAidyl, type SavedReport } from "@/lib/store";

export async function publishReport(spec: ReportSpec, module: string) {
  useAidyl.getState().archiveReport({
    module,
    title: spec.title,
    subtitle: spec.subtitle,
    preparedBy: spec.preparedBy,
    agent: spec.agent,
    notes: spec.notes,
    sections: spec.sections,
  });
  useAidyl.getState().pushActivity(
    blankActivity({
      crm: module === "all" || module === "*" ? "desk" : module,
      action: "report",
      message: `${spec.agent} generated a report: ${spec.title}.`,
      performedBy: spec.preparedBy || "Admin",
      status: "success",
      agent: spec.agent,
    }),
  );
  await downloadReport(spec);
}

export async function redownloadReport(report: SavedReport) {
  await downloadReport({
    title: report.title,
    subtitle: report.subtitle,
    preparedBy: report.preparedBy,
    agent: report.agent,
    notes: report.notes,
    sections: report.sections,
  });
}
