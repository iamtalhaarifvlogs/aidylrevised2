import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/aether")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleAetherGet } = await import("@/lib/aether-watch.server");
        return handleAetherGet(request);
      },
      POST: async ({ request }) => {
        const { handleAetherPost } = await import("@/lib/aether-watch.server");
        return handleAetherPost(request);
      },
    },
  },
});
