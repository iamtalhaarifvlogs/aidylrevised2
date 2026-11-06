import { createFileRoute } from "@tanstack/react-router";

function allowed(hostname: string) {
  return hostname === "cdninstagram.com" || hostname.endsWith(".cdninstagram.com") || hostname.endsWith(".fbcdn.net");
}

export const Route = createFileRoute("/api/ig-img")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("u") ?? "";
        let target: URL;
        try {
          target = new URL(raw);
        } catch {
          return new Response("Bad image", { status: 400 });
        }
        if (target.protocol !== "https:" || !allowed(target.hostname)) return new Response("Not allowed", { status: 400 });
        const res = await fetch(target, {
          headers: { Accept: "image/*", "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(12_000),
        });
        const finalHost = new URL(res.url).hostname;
        if (!res.ok || !allowed(finalHost)) return new Response("Missing", { status: 502 });
        const bytes = await res.arrayBuffer();
        if (bytes.byteLength > 2_000_000) return new Response("Too large", { status: 413 });
        return new Response(bytes, {
          headers: {
            "Content-Type": res.headers.get("content-type") || "image/jpeg",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
