import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/social")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { readPublicSocial } = await import("@/lib/social.server");
          const snap = await readPublicSocial();
          return Response.json(snap, { headers: { "Cache-Control": "public, max-age=60" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Public pages are not available right now.";
          return Response.json({ error: message });
        }
      },
    },
  },
});
