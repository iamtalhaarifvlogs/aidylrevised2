import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AgentDock } from "@/components/agent-dock";
import { DeskSignals } from "@/components/desk-signals";
import { Shell } from "@/components/shell";
import { syncTraining } from "@/lib/crm/data";
import { startIntelligence } from "@/lib/intelligence";
import { startAetherLink } from "@/lib/aether-link";
import { startDeskSignals } from "@/lib/reminders";
import { useAidyl } from "@/lib/store";
import appCss from "../styles.css?url";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Aidyl Systems" },
      {
        name: "description",
        content: "Aidyl Systems command for Carshipy, BetterDealTV, and Associate Logistics USA.",
      },
      { name: "theme-color", content: "#1c1915" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,520;9..144,640&family=Outfit:wght@360;480;560;640&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    void (async () => {
      await useAidyl.persist.rehydrate();
      await syncTraining();
      startDeskSignals();
      startIntelligence();
      startAetherLink();
    })();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <Shell>
              <Outlet />
            </Shell>
            <AgentDock />
            <DeskSignals />
          </QueryClientProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
