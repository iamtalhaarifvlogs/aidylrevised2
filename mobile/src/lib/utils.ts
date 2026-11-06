export function uid(prefix: string) {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${n}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    if (match) {
      const n = Number(match[0]);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export function money(value: unknown) {
  const n = asNumber(value);
  if (n == null) return value == null || value === "" ? "—" : String(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function cellText(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.map((v) => cellText(v)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
