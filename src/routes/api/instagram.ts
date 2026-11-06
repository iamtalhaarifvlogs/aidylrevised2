import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/instagram")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { readBetterdeal } = await import("@/lib/instagram.server");
          const snap = await readBetterdeal();
          return Response.json(snap, { headers: { "Cache-Control": "public, max-age=45" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Instagram is not available right now.";
          return Response.json({ error: message });
        }
      },
    },
  },
});
