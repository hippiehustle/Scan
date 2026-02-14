import { Link, useLocation } from "wouter";
import { Home, Folder, BarChart3, Settings, Info, Bug, Lightbulb, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { loadAdminSettings } from "@/lib/admin-store";

interface NavItem {
  path: string;
  icon: typeof Home;
  label: string;
  adminKey?: "bugReportVisible" | "featureRequestVisible";
}

const allNavItems: NavItem[] = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/files", icon: Folder, label: "Files" },
  { path: "/reports", icon: BarChart3, label: "Reports" },
  { path: "/osint", icon: Globe, label: "OSINT" },
  { path: "/bug-report", icon: Bug, label: "Bugs", adminKey: "bugReportVisible" },
  { path: "/feature-request", icon: Lightbulb, label: "Ideas", adminKey: "featureRequestVisible" },
  { path: "/about", icon: Info, label: "About" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export default function BottomNavigation() {
  const [location] = useLocation();
  const [adminSettings, setAdminSettings] = useState(loadAdminSettings());

  useEffect(() => {
    const interval = setInterval(() => {
      setAdminSettings(loadAdminSettings());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const visibleItems = allNavItems.filter((item) => {
    if (!item.adminKey) return true;
    return adminSettings[item.adminKey];
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-charcoal-800/90 backdrop-blur-sm border-t border-charcoal-700 z-40">
      <div className="max-w-md mx-auto px-2">
        <div className="flex items-center justify-around py-2">
          {visibleItems.map(({ path, icon: Icon, label }) => {
            const isActive = location === path;
            return (
              <Link
                key={path}
                href={path}
                className={cn(
                  "flex flex-col items-center py-2 px-2 transition-colors min-w-0",
                  isActive 
                    ? "text-matte-cyan-400" 
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-[10px] leading-tight truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
