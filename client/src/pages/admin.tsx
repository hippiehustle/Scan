import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  Crown,
  Cloud,
  Bug,
  Lightbulb,
  BarChart3,
  Lock,
  LogOut,
  Zap,
  Activity,
  Server,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { loadAdminSettings, saveAdminSettings, isAdminUnlocked, lockAdmin, type AdminSettings } from "@/lib/admin-store";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AdminSettings>(loadAdminSettings);

  useEffect(() => {
    if (!isAdminUnlocked()) {
      setLocation("/about");
    }
  }, [setLocation]);

  useEffect(() => {
    saveAdminSettings(settings);
  }, [settings]);

  const { data: stats } = useQuery<{
    totalFiles: number;
    nsfwFound: number;
    processed: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: apiStatus } = useQuery<{ sentisightAvailable: boolean }>({
    queryKey: ["/api/admin/sentisight-status"],
    retry: false,
  });

  const updateSetting = (key: keyof AdminSettings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    toast({
      title: "Setting Updated",
      description: `${key} has been ${value ? "enabled" : "disabled"}.`,
    });
  };

  const handleLockAdmin = () => {
    lockAdmin();
    toast({ title: "Admin Locked", description: "Admin panel has been locked." });
    setLocation("/about");
  };

  const handleSyncSentisight = async () => {
    try {
      const res = await fetch("/api/admin/sentisight-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: settings.sentisightEnabled }),
      });
      if (res.ok) {
        toast({ title: "SentiSight Synced", description: `Cloud detection ${settings.sentisightEnabled ? "enabled" : "disabled"} on server.` });
      }
    } catch {
      toast({ title: "Sync Failed", description: "Could not update server setting.", variant: "destructive" });
    }
  };

  useEffect(() => {
    handleSyncSentisight();
  }, [settings.sentisightEnabled]);

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-matte-cyan" />
          <h1 className="text-xl font-bold text-gray-100">Admin Panel</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLockAdmin}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4 mr-1" />
          Lock
        </Button>
      </div>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            <span>Premium Features</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-200">
                Unlock Premium
              </Label>
              <p className="text-xs text-gray-400">
                Enable all premium features for free (deep scan, auto-organize, secure backup, advanced reports)
              </p>
            </div>
            <Switch
              checked={settings.premiumUnlocked}
              onCheckedChange={(v) => updateSetting("premiumUnlocked", v)}
            />
          </div>

          {settings.premiumUnlocked && (
            <div className="pl-3 border-l-2 border-yellow-400/30 space-y-1">
              <div className="flex items-center space-x-2 text-xs text-green-400">
                <Zap className="w-3 h-3" /> <span>Deep Scan Mode</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-green-400">
                <Zap className="w-3 h-3" /> <span>Auto-Organize</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-green-400">
                <Zap className="w-3 h-3" /> <span>Secure Backup</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-green-400">
                <Zap className="w-3 h-3" /> <span>Advanced Reports & Export</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-green-400">
                <Zap className="w-3 h-3" /> <span>Priority Processing</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Cloud className="w-5 h-5 text-blue-400" />
            <span>SentiSight.ai Detection</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-200">
                Enable Cloud Detection
              </Label>
              <p className="text-xs text-gray-400">
                Use SentiSight.ai API instead of built-in InceptionV3 model for NSFW scans
              </p>
            </div>
            <Switch
              checked={settings.sentisightEnabled}
              onCheckedChange={(v) => updateSetting("sentisightEnabled", v)}
            />
          </div>

          <div className="bg-charcoal-900/60 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 flex items-center space-x-1">
                <Server className="w-3 h-3" />
                <span>API Status</span>
              </span>
              <span className={apiStatus?.sentisightAvailable ? "text-green-400" : "text-yellow-400"}>
                {apiStatus?.sentisightAvailable ? "Connected" : "Checking..."}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 flex items-center space-x-1">
                <Activity className="w-3 h-3" />
                <span>Active Engine</span>
              </span>
              <span className="text-gray-200">
                {settings.sentisightEnabled ? "SentiSight.ai" : "InceptionV3 (Local)"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Bug className="w-5 h-5 text-orange-400" />
            <span>Navigation Visibility</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-200">
                Bug Report Tab
              </Label>
              <p className="text-xs text-gray-400">
                Show bug report tab in bottom navigation
              </p>
            </div>
            <Switch
              checked={settings.bugReportVisible}
              onCheckedChange={(v) => updateSetting("bugReportVisible", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-200 flex items-center space-x-1">
                <span>Feature Request Tab</span>
              </Label>
              <p className="text-xs text-gray-400">
                Show feature request tab in bottom navigation
              </p>
            </div>
            <Switch
              checked={settings.featureRequestVisible}
              onCheckedChange={(v) => updateSetting("featureRequestVisible", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-matte-cyan" />
            <span>System Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-charcoal-900/60 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-matte-cyan">{stats?.processed ?? 0}</p>
              <p className="text-xs text-gray-400">Files Processed</p>
            </div>
            <div className="bg-charcoal-900/60 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-200">{stats?.totalFiles ?? 0}</p>
              <p className="text-xs text-gray-400">Total Files</p>
            </div>
            <div className="bg-charcoal-900/60 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{stats?.nsfwFound ?? 0}</p>
              <p className="text-xs text-gray-400">NSFW Found</p>
            </div>
            <div className="bg-charcoal-900/60 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{(stats?.totalFiles ?? 0) - (stats?.nsfwFound ?? 0)}</p>
              <p className="text-xs text-gray-400">Clean Files</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Lock className="w-5 h-5 text-red-400" />
            <span>Admin Security</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={handleLockAdmin}
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
          >
            <Lock className="w-4 h-4 mr-2" />
            Lock Admin Panel
          </Button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Locking will require the Easter egg to re-enter.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
