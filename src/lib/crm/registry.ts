export type CrmDef = {
  slug: string;
  name: string;
  focus: string;
  live: boolean;
  agent: "maya" | "randolph";
  accent: "brass" | "forest";
};

export const BUILTIN_CRMS: CrmDef[] = [
  {
    slug: "carshipy",
    name: "Carshipy",
    focus: "The live book: marketplace leads, sourcing, financing, transactions, and export. This replaces Ogamoto.",
    live: true,
    agent: "maya",
    accent: "forest",
  },
  {
    slug: "betterdealtv",
    name: "BetterDealTV",
    focus: "Public performance across YouTube, Instagram, TikTok, and betterdealtv.com.",
    live: false,
    agent: "randolph",
    accent: "brass",
  },
  {
    slug: "associate-logistics",
    name: "Associate Logistics USA",
    focus: "Inland haulage, yard release, and port delivery inside the US.",
    live: false,
    agent: "randolph",
    accent: "brass",
  },
];

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 42);
}
