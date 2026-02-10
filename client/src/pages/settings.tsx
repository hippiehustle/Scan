import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  Bell, 
  Database, 
  Download,
  Trash2,
  Info,
  Check,
  Smartphone
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AppSettings {
  autoOrganize: boolean;
  secureBackup: boolean;
  deepScan: boolean;
  scanAlerts: boolean;
  detectionAlerts: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoOrganize: false,
  secureBackup: true,
  deepScan: false,
  scanAlerts: true,
  detectionAlerts: true,
};

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem("securescanner-settings");
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem("securescanner-settings", JSON.stringify(settings));
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSetting = (key: keyof AppSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportData = async () => {
    try {
      const response = await fetch("/api/export/report");
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `securescanner-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Data exported",
        description: "Your data has been downloaded successfully.",
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Could not export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const clearHistoryMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/scan-history"),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nsfw-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-sessions"] });
      toast({
        title: "History cleared",
        description: `Removed ${data.deleted} record${data.deleted !== 1 ? "s" : ""} from scan history.`,
      });
    },
    onError: () => {
      toast({
        title: "Clear failed",
        description: "Could not clear scan history. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      {saved && (
        <div className="fixed top-4 right-4 bg-green-500/20 text-green-400 px-4 py-2 rounded-lg border border-green-500/30 flex items-center space-x-2 z-50 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span className="text-sm">Settings saved</span>
        </div>
      )}

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Security Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-200">
                Auto-organize NSFW content
              </Label>
              <p className="text-xs text-gray-400">
                Automatically move detected content to secure folders after scanning
              </p>
            </div>
            <Switch 
              checked={settings.autoOrganize}
              onCheckedChange={(val) => updateSetting("autoOrganize", val)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-200">
                Secure backup
              </Label>
              <p className="text-xs text-gray-400">
                Create backups before organizing files
              </p>
            </div>
            <Switch 
              checked={settings.secureBackup}
              onCheckedChange={(val) => updateSetting("secureBackup", val)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-200">
                Deep scan mode
              </Label>
              <p className="text-xs text-gray-400">
                Enhanced detection with higher accuracy (slower)
              </p>
            </div>
            <Switch 
              checked={settings.deepScan}
              onCheckedChange={(val) => updateSetting("deepScan", val)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Bell className="w-5 h-5" />
            <span>Notifications</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-200">
                Scan completion alerts
              </Label>
              <p className="text-xs text-gray-400">
                Show notification when scans finish
              </p>
            </div>
            <Switch 
              checked={settings.scanAlerts}
              onCheckedChange={(val) => updateSetting("scanAlerts", val)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-200">
                Detection alerts
              </Label>
              <p className="text-xs text-gray-400">
                Immediate alerts for flagged content
              </p>
            </div>
            <Switch 
              checked={settings.detectionAlerts}
              onCheckedChange={(val) => updateSetting("detectionAlerts", val)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Data Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            onClick={handleExportData}
            className="w-full bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 border-charcoal-600 justify-start"
          >
            <Download className="w-4 h-4 mr-2" />
            Export all data
          </Button>
          
          <Button
            variant="outline"
            onClick={() => clearHistoryMutation.mutate()}
            disabled={clearHistoryMutation.isPending}
            className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30 justify-start"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {clearHistoryMutation.isPending ? "Clearing..." : "Clear scan history"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Smartphone className="w-5 h-5" />
            <span>Android App</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-400">
            Install SecureScanner as a native Android app for the best experience.
          </p>
          <a
            href="/api/download-apk"
            download="SecureScanner.apk"
            className="inline-flex items-center justify-start w-full px-4 py-2 rounded-md text-sm font-medium bg-matte-cyan/20 hover:bg-matte-cyan/30 text-matte-cyan border border-matte-cyan/30 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Android APK
          </a>
          <p className="text-xs text-gray-500">
            After downloading, open the file on your Android device. You may need to allow installation from unknown sources in your device settings.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Info className="w-5 h-5" />
            <span>About</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Version</span>
              <span className="text-gray-200">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Detection Model</span>
              <span className="text-gray-200">InceptionV3</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Accuracy</span>
              <span className="text-gray-200">~93%</span>
            </div>
          </div>
          
          <div className="pt-2 border-t border-charcoal-600">
            <p className="text-xs text-gray-400 text-center">
              SecureScanner helps protect your privacy by detecting and managing inappropriate content.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
