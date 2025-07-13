import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa";
import Home from "@/pages/home";
import Files from "@/pages/files";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import ScanConfig from "@/pages/scan-config";
import ScanLanding from "@/pages/scan-landing";
import NotFound from "@/pages/not-found";
import BottomNavigation from "@/components/layout/bottom-navigation";
import Header from "@/components/layout/header";

function Router() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-charcoal-900 via-charcoal-800 to-charcoal-900">
      <Header />
      <main className="pb-20"> {/* Add padding for bottom navigation */}
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/files" component={Files} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
          <Route path="/scan-config" component={ScanConfig} />
          <Route path="/scan/:sessionId">
            {(params) => <ScanLanding sessionId={params.sessionId} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNavigation />
    </div>
  );
}

function App() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
