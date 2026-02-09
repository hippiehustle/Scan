import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Folder, 
  FileType, 
  Target, 
  Sliders,
  Play,
  Clock,
  Shield,
  Palette,
  Volume2,
  Eye,
  ChevronRight,
  Plus,
  X
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function ScanConfig() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Scan Configuration State
  const [scanType, setScanType] = useState("full");
  const [targetFolders, setTargetFolders] = useState<string[]>([]);
  const [newFolder, setNewFolder] = useState("");
  const [fileTypes, setFileTypes] = useState(["image", "video", "document"]);
  const [confidenceThreshold, setConfidenceThreshold] = useState([30]);
  const [autoActions, setAutoActions] = useState<string[]>([]);
  
  // App Customization State
  const [themeColor, setThemeColor] = useState("cyan");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [customCSSEnabled, setCustomCSSEnabled] = useState(false);
  const [customCSS, setCustomCSS] = useState("");

  const startScanMutation = useMutation({
    mutationFn: async () => {
      const scanConfig = {
        userId: null,
        scanType,
        targetFolders,
        fileTypes,
        confidenceThreshold: confidenceThreshold[0] / 100,
        autoActions,
        customSettings: JSON.stringify({
          theme: themeColor,
          sound: soundEnabled,
          notifications: notificationsEnabled,
          animations: animationsEnabled,
          compactMode,
          autoRefresh,
          customCSS: customCSSEnabled ? customCSS : null,
        }),
      };

      const response = await fetch("/api/scan-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanConfig),
      });
      
      if (!response.ok) {
        throw new Error("Failed to start scan");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Scan started successfully",
        description: "Your customized scan is now running.",
      });
      setLocation(`/scan/${data.id}`);
    },
    onError: () => {
      toast({
        title: "Failed to start scan",
        description: "There was an error starting your scan.",
        variant: "destructive",
      });
    },
  });

  const addFolder = () => {
    if (newFolder.trim() && !targetFolders.includes(newFolder.trim())) {
      setTargetFolders([...targetFolders, newFolder.trim()]);
      setNewFolder("");
    }
  };

  const removeFolder = (folder: string) => {
    setTargetFolders(targetFolders.filter(f => f !== folder));
  };

  const toggleFileType = (type: string) => {
    if (fileTypes.includes(type)) {
      setFileTypes(fileTypes.filter(t => t !== type));
    } else {
      setFileTypes([...fileTypes, type]);
    }
  };

  const toggleAutoAction = (action: string) => {
    if (autoActions.includes(action)) {
      setAutoActions(autoActions.filter(a => a !== action));
    } else {
      setAutoActions([...autoActions, action]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-matte-cyan-600 rounded-full flex items-center justify-center mx-auto">
          <Settings className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-100">Scan Configuration</h1>
        <p className="text-gray-400">Customize your scan settings and app preferences</p>
      </div>

      {/* Scan Settings */}
      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Scan Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scan Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-200">Scan Type</Label>
            <Select value={scanType} onValueChange={setScanType}>
              <SelectTrigger className="bg-charcoal-700 border-charcoal-600 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-700 border-charcoal-600">
                <SelectItem value="full">Full System Scan</SelectItem>
                <SelectItem value="quick">Quick Scan</SelectItem>
                <SelectItem value="custom">Custom Folders</SelectItem>
                <SelectItem value="scheduled">Scheduled Scan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target Folders */}
          {(scanType === "custom" || scanType === "scheduled") && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-200 flex items-center space-x-2">
                <Folder className="w-4 h-4" />
                <span>Target Folders</span>
              </Label>
              <div className="flex space-x-2">
                <Input
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  placeholder="/path/to/folder"
                  className="bg-charcoal-700 border-charcoal-600 text-gray-200"
                  onKeyPress={(e) => e.key === "Enter" && addFolder()}
                />
                <Button onClick={addFolder} size="sm" className="bg-matte-cyan-600 hover:bg-matte-cyan-700">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {targetFolders.map((folder) => (
                  <Badge
                    key={folder}
                    className="bg-charcoal-700 text-gray-200 border border-charcoal-600 pr-1"
                  >
                    {folder}
                    <Button
                      onClick={() => removeFolder(folder)}
                      size="sm"
                      variant="ghost"
                      className="p-0 h-auto ml-1 text-gray-400 hover:text-gray-200"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* File Types */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-200 flex items-center space-x-2">
              <FileType className="w-4 h-4" />
              <span>File Types to Scan</span>
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {["image", "video", "document", "audio", "archive", "executable"].map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    checked={fileTypes.includes(type)}
                    onCheckedChange={() => toggleFileType(type)}
                    className="border-charcoal-600 data-[state=checked]:bg-matte-cyan-600"
                  />
                  <Label className="text-sm text-gray-300 capitalize">{type}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence Threshold */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-200 flex items-center space-x-2">
              <Sliders className="w-4 h-4" />
              <span>Detection Confidence Threshold: {confidenceThreshold[0]}%</span>
            </Label>
            <Slider
              value={confidenceThreshold}
              onValueChange={setConfidenceThreshold}
              max={100}
              min={10}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Low Sensitivity</span>
              <span>High Sensitivity</span>
            </div>
          </div>

          {/* Auto Actions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-200">Automatic Actions</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "move", label: "Move to Secure Folder", icon: "📁" },
                { id: "rename", label: "Rename Files", icon: "📝" },
                { id: "backup", label: "Create Backup", icon: "💾" },
                { id: "quarantine", label: "Quarantine Files", icon: "🔒" }
              ].map((action) => (
                <div key={action.id} className="flex items-center space-x-2">
                  <Checkbox
                    checked={autoActions.includes(action.id)}
                    onCheckedChange={() => toggleAutoAction(action.id)}
                    className="border-charcoal-600 data-[state=checked]:bg-matte-cyan-600"
                  />
                  <Label className="text-sm text-gray-300">{action.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Customization */}
      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Palette className="w-5 h-5" />
            <span>App Customization</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Color */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-200">Theme Color</Label>
            <Select value={themeColor} onValueChange={setThemeColor}>
              <SelectTrigger className="bg-charcoal-700 border-charcoal-600 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-700 border-charcoal-600">
                <SelectItem value="cyan">Matte Cyan</SelectItem>
                <SelectItem value="blue">Ocean Blue</SelectItem>
                <SelectItem value="purple">Deep Purple</SelectItem>
                <SelectItem value="green">Forest Green</SelectItem>
                <SelectItem value="orange">Sunset Orange</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* UI Preferences */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-gray-200">Interface Preferences</Label>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-200 flex items-center space-x-2">
                  <Volume2 className="w-4 h-4" />
                  <span>Sound Effects</span>
                </Label>
                <p className="text-xs text-gray-400">Play sounds for notifications and actions</p>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-200">Notifications</Label>
                <p className="text-xs text-gray-400">Show system notifications</p>
              </div>
              <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-200 flex items-center space-x-2">
                  <Eye className="w-4 h-4" />
                  <span>Animations</span>
                </Label>
                <p className="text-xs text-gray-400">Enable smooth transitions and animations</p>
              </div>
              <Switch checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-200">Compact Mode</Label>
                <p className="text-xs text-gray-400">Reduce spacing for smaller screens</p>
              </div>
              <Switch checked={compactMode} onCheckedChange={setCompactMode} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-200">Auto Refresh</Label>
                <p className="text-xs text-gray-400">Automatically update scan progress</p>
              </div>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
          </div>

          {/* Custom CSS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-200">Custom Styling</Label>
              <Switch checked={customCSSEnabled} onCheckedChange={setCustomCSSEnabled} />
            </div>
            {customCSSEnabled && (
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Custom CSS (Advanced Users)</Label>
                <Textarea
                  value={customCSS}
                  onChange={(e) => setCustomCSS(e.target.value)}
                  placeholder=".custom-class { color: #fff; }"
                  className="bg-charcoal-700 border-charcoal-600 text-gray-200 font-mono text-xs"
                  rows={4}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <Button
          onClick={() => startScanMutation.mutate()}
          disabled={startScanMutation.isPending || fileTypes.length === 0}
          className="flex-1 bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>{startScanMutation.isPending ? "Starting..." : "Start Custom Scan"}</span>
        </Button>
        
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          className="bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 border-charcoal-600 font-semibold py-3 px-6 rounded-xl"
        >
          Cancel
        </Button>
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-400">
          Your scan configuration will be saved for future use
        </p>
      </div>
    </div>
  );
}