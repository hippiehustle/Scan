import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa";
import { useAuth } from "@/hooks/use-auth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Files from "@/pages/files";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import ScanConfig from "@/pages/scan-config";
import ScanLanding from "@/pages/scan-landing";
import About from "@/pages/about";
import Admin from "@/pages/admin";
import BugReport from "@/pages/bug-report";
import FeatureRequest from "@/pages/feature-request";
import FileOrganizer from "@/pages/file-organizer";
import OsintLookup from "@/pages/osint-lookup";
import NotFound from "@/pages/not-found";
import BottomNavigation from "@/components/layout/bottom-navigation";
import Header from "@/components/layout/header";
import { Loader2 } from "lucide-react";

function AuthenticatedRouter() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-charcoal-900 via-charcoal-800 to-charcoal-900">
      <Header />
      <main className="pb-20">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/files" component={Files} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
          <Route path="/scan-config" component={ScanConfig} />
          <Route path="/scan/:sessionId">
            {(params) => <ScanLanding sessionId={params.sessionId} />}
          </Route>
          <Route path="/about" component={About} />
          <Route path="/admin" component={Admin} />
          <Route path="/bug-report" component={BugReport} />
          <Route path="/feature-request" component={FeatureRequest} />
          <Route path="/osint" component={OsintLookup} />
          <Route path="/organize">
            {() => <FileOrganizer />}
          </Route>
          <Route path="/organize/:sessionId">
            {(params) => <FileOrganizer sessionId={params.sessionId} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNavigation />
    </div>
  );
}

function AppRouter() {
  return <AuthenticatedRouter />;
}

function App() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
