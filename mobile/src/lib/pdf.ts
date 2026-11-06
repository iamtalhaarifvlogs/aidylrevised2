import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export type ReportSection = {
  heading: string;
  columns: string[];
  rows: string[][];
};

export type ReportSpec = {
  title: string;
  subtitle: string;
  preparedBy: string;
  agent: string;
  notes?: string;
  sections: ReportSection[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function renderHtml(spec: ReportSpec) {
  const sections = spec.sections
    .map((section) => {
      const head = section.columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("");
      const body = section.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("");
      return `<h2>${escapeHtml(section.heading)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${section.columns.length}">Nothing on this page.</td></tr>`}</tbody></table>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: Georgia, serif; color: #1c1915; margin: 0; }
    header { background: #1c1915; color: #f7f1e6; padding: 28px 32px 22px; }
    header p { margin: 6px 0 0; font-family: sans-serif; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #c4a574; }
    header h1 { margin: 8px 0 0; font-weight: 500; font-size: 26px; }
    .rule { height: 4px; background: #8c6239; }
    main { padding: 24px 32px 48px; }
    h2 { font-size: 18px; margin: 22px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 11px; }
    th, td { border-bottom: 1px solid #e3d9cc; text-align: left; padding: 6px 8px; vertical-align: top; }
    th { color: #6f675e; font-weight: 500; }
    footer { font-family: sans-serif; font-size: 11px; color: #6f675e; margin-top: 24px; }
  </style></head><body>
    <header><p>Aidyl Systems · ${escapeHtml(spec.agent)}</p><h1>${escapeHtml(spec.title)}</h1></header>
    <div class="rule"></div>
    <main>
      <p>${escapeHtml(spec.subtitle)}</p>
      ${sections}
      <footer>Prepared for ${escapeHtml(spec.preparedBy)}. ${escapeHtml(spec.notes ?? "")}</footer>
    </main>
  </body></html>`;
}

export async function shareReport(spec: ReportSpec) {
  const html = renderHtml(spec);
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: spec.title });
  }
}
