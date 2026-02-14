import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FolderOpen,
  FolderTree,
  Calendar,
  FileType,
  Layers,
  MoveRight,
  Clock,
  CheckCircle,
  ArrowLeft,
  Sparkles,
  Image,
  Video,
  FileText,
  Archive,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { ScanResult } from "@shared/schema";

interface FileOrganizerProps {
  sessionId?: string;
}

const FLAG_CATEGORIES = [
  { id: "explicit", label: "Explicit", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { id: "suggestive", label: "Suggestive", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { id: "adult", label: "Adult", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { id: "violent", label: "Violent", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { id: "disturbing", label: "Disturbing", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
];

const FILE_TYPES = [
  { id: "image", label: "Images", icon: Image },
  { id: "video", label: "Videos", icon: Video },
  { id: "document", label: "Documents", icon: FileText },
];

type OrganizeMode = "category" | "date" | "filetype" | "custom";

export default function FileOrganizer({ sessionId }: FileOrganizerProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [destinationFolder, setDestinationFolder] = useState("/SecureScanner");
  const [mode, setMode] = useState<OrganizeMode>("category");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "explicit", "suggestive", "adult", "violent", "disturbing",
  ]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([
    "image", "video", "document",
  ]);
  const [organizeResult, setOrganizeResult] = useState<{ moved: number; renamed: number; copied: number } | null>(null);

  const { data: nsfwResults = [] } = useQuery<ScanResult[]>({
    queryKey: sessionId ? ["/api/scan-results", sessionId] : ["/api/nsfw-results"],
  });

  const flaggedFiles = sessionId
    ? nsfwResults.filter((r) => r.isNsfw && r.actionTaken === "none")
    : nsfwResults.filter((r) => r.actionTaken === "none");

  const projectFiles = flaggedFiles.filter((r) => r.isProjectFile);
  const regularFiles = flaggedFiles.filter((r) => !r.isProjectFile);

  const filteredCount = flaggedFiles.filter((r) => {
    const categoryMatch = selectedCategories.length === 0 || (r.flagCategory && selectedCategories.includes(r.flagCategory));
    const typeMatch = selectedFileTypes.length === 0 || selectedFileTypes.includes(r.fileType);
    return categoryMatch && typeMatch;
  }).length;

  const organizeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/organize-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationFolder,
          mode,
          filterCategories: selectedCategories.length < FLAG_CATEGORIES.length ? selectedCategories : undefined,
          filterFileTypes: selectedFileTypes.length < FILE_TYPES.length ? selectedFileTypes : undefined,
          sessionId: sessionId || undefined,
        }),
      });
      if (!response.ok) throw new Error("Failed to organize files");
      return response.json();
    },
    onSuccess: (data) => {
      setOrganizeResult({ moved: data.moved, renamed: data.renamed, copied: data.copied || 0 });
      queryClient.invalidateQueries({ queryKey: ["/api/nsfw-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      const parts = [`${data.moved} files moved`];
      if (data.copied > 0) parts.push(`${data.copied} project files copied`);
      toast({
        title: "Files organized successfully",
        description: parts.join(", ") + ".",
      });
    },
    onError: () => {
      toast({
        title: "Organization failed",
        description: "There was an error organizing the files.",
        variant: "destructive",
      });
    },
  });

  const handleOrganize = () => {
    setOrganizeResult(null);
    organizeMutation.mutate();
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const toggleFileType = (typeId: string) => {
    setSelectedFileTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  const applyPresetDate = () => {
    setMode("date");
    setDestinationFolder("/SecureScanner/Sorted");
    setSelectedCategories(FLAG_CATEGORIES.map((c) => c.id));
    setSelectedFileTypes(FILE_TYPES.map((t) => t.id));
  };

  const applyPresetFileType = () => {
    setMode("filetype");
    setDestinationFolder("/SecureScanner/Sorted");
    setSelectedCategories(FLAG_CATEGORIES.map((c) => c.id));
    setSelectedFileTypes(FILE_TYPES.map((t) => t.id));
  };

  const getPreviewStructure = (): string[] => {
    const base = destinationFolder || "/SecureScanner";
    switch (mode) {
      case "category":
        return selectedCategories.map((c) => `${base}/${c}/`);
      case "date":
        return [
          `${base}/2026-02-10/`,
          `${base}/2026-02-09/`,
          `${base}/Undetermined/`,
        ];
      case "filetype":
        return [
          `${base}/Images/`,
          `${base}/Videos/`,
          `${base}/Documents/`,
          `${base}/Archives/`,
          `${base}/Other/`,
        ].filter((_, i) => {
          if (i === 0) return selectedFileTypes.includes("image");
          if (i === 1) return selectedFileTypes.includes("video");
          if (i === 2) return selectedFileTypes.includes("document");
          return true;
        });
      case "custom":
        return selectedCategories.map((c) => `${base}/${c}/`);
      default:
        return [`${base}/`];
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
      <div className="flex items-center space-x-3">
        <Button
          onClick={() => setLocation(sessionId ? `/scan/${sessionId}` : "/files")}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-matte-cyan-600 rounded-full flex items-center justify-center mx-auto">
          <FolderTree className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-100">File Organizer</h1>
        <p className="text-gray-400">
          Customize how flagged files are moved and sorted
        </p>
        {flaggedFiles.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
              {flaggedFiles.length} flagged files pending
            </Badge>
            {projectFiles.length > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                {projectFiles.length} from project folders (copy)
              </Badge>
            )}
            {regularFiles.length > 0 && (
              <Badge className="bg-matte-cyan-600/20 text-matte-cyan-400 border border-matte-cyan-500/30">
                {regularFiles.length} regular files (move)
              </Badge>
            )}
          </div>
        )}
      </div>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-100 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-matte-cyan-400" />
            <span>Quick Presets</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={applyPresetDate}
              className={`p-4 rounded-xl border transition-all text-left space-y-2 ${
                mode === "date"
                  ? "bg-matte-cyan-600/20 border-matte-cyan-500/50"
                  : "bg-charcoal-700/50 border-charcoal-600 hover:border-charcoal-500"
              }`}
            >
              <Calendar className={`w-6 h-6 ${mode === "date" ? "text-matte-cyan-400" : "text-gray-400"}`} />
              <div className="text-sm font-medium text-gray-200">Sort by Date</div>
              <p className="text-xs text-gray-400">
                Organizes into date folders from file metadata. Unknown dates go to "Undetermined"
              </p>
            </button>
            <button
              onClick={applyPresetFileType}
              className={`p-4 rounded-xl border transition-all text-left space-y-2 ${
                mode === "filetype"
                  ? "bg-matte-cyan-600/20 border-matte-cyan-500/50"
                  : "bg-charcoal-700/50 border-charcoal-600 hover:border-charcoal-500"
              }`}
            >
              <FileType className={`w-6 h-6 ${mode === "filetype" ? "text-matte-cyan-400" : "text-gray-400"}`} />
              <div className="text-sm font-medium text-gray-200">Sort by File Type</div>
              <p className="text-xs text-gray-400">
                Groups into Images, Videos, Documents, Archives
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-100 flex items-center space-x-2">
            <FolderOpen className="w-4 h-4" />
            <span>Destination Folder</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={destinationFolder}
            onChange={(e) => setDestinationFolder(e.target.value)}
            placeholder="/SecureScanner"
            className="bg-charcoal-700 border-charcoal-600 text-gray-200"
          />
          <p className="text-xs text-gray-500 mt-2">
            Root folder where organized files will be placed
          </p>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-100 flex items-center space-x-2">
            <Layers className="w-4 h-4" />
            <span>Organization Mode</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={mode}
            onValueChange={(val) => setMode(val as OrganizeMode)}
            className="space-y-3"
          >
            <label className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
              mode === "category" ? "bg-matte-cyan-600/15 border border-matte-cyan-500/30" : "bg-charcoal-700/40 border border-transparent hover:bg-charcoal-700/60"
            }`}>
              <RadioGroupItem value="category" className="border-gray-500 text-matte-cyan-500" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-200">By Category</div>
                <div className="text-xs text-gray-400">
                  Sort into subfolders by detection category (explicit, suggestive, etc.)
                </div>
              </div>
            </label>

            <label className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
              mode === "date" ? "bg-matte-cyan-600/15 border border-matte-cyan-500/30" : "bg-charcoal-700/40 border border-transparent hover:bg-charcoal-700/60"
            }`}>
              <RadioGroupItem value="date" className="border-gray-500 text-matte-cyan-500" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-200">By Date</div>
                <div className="text-xs text-gray-400">
                  Sort by date from filename or file metadata. Files without a detectable date go to "Undetermined"
                </div>
              </div>
            </label>

            <label className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
              mode === "filetype" ? "bg-matte-cyan-600/15 border border-matte-cyan-500/30" : "bg-charcoal-700/40 border border-transparent hover:bg-charcoal-700/60"
            }`}>
              <RadioGroupItem value="filetype" className="border-gray-500 text-matte-cyan-500" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-200">By File Type</div>
                <div className="text-xs text-gray-400">
                  Group into Images, Videos, Documents, Archives, and Other
                </div>
              </div>
            </label>

            <label className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
              mode === "custom" ? "bg-matte-cyan-600/15 border border-matte-cyan-500/30" : "bg-charcoal-700/40 border border-transparent hover:bg-charcoal-700/60"
            }`}>
              <RadioGroupItem value="custom" className="border-gray-500 text-matte-cyan-500" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-200">Custom (by Category)</div>
                <div className="text-xs text-gray-400">
                  Same as category mode but you choose exactly which ones below
                </div>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-100 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Filter by Category</span>
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">
            Choose which flag categories to include when organizing
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {FLAG_CATEGORIES.map((cat) => (
              <label
                key={cat.id}
                className="flex items-center space-x-2 p-2 rounded-lg cursor-pointer hover:bg-charcoal-700/40"
              >
                <Checkbox
                  checked={selectedCategories.includes(cat.id)}
                  onCheckedChange={() => toggleCategory(cat.id)}
                  className="border-charcoal-600 data-[state=checked]:bg-matte-cyan-600"
                />
                <Badge className={`text-xs ${cat.color}`}>{cat.label}</Badge>
              </label>
            ))}
          </div>
          <div className="flex space-x-2 mt-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedCategories(FLAG_CATEGORIES.map((c) => c.id))}
              className="text-xs text-matte-cyan-400 hover:text-matte-cyan-300"
            >
              Select All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedCategories([])}
              className="text-xs text-gray-400 hover:text-gray-300"
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-100 flex items-center space-x-2">
            <FileType className="w-4 h-4" />
            <span>Filter by File Type</span>
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">
            Choose which file types to include
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {FILE_TYPES.map((ft) => {
              const Icon = ft.icon;
              return (
                <label
                  key={ft.id}
                  className="flex items-center space-x-2 p-2 rounded-lg cursor-pointer hover:bg-charcoal-700/40"
                >
                  <Checkbox
                    checked={selectedFileTypes.includes(ft.id)}
                    onCheckedChange={() => toggleFileType(ft.id)}
                    className="border-charcoal-600 data-[state=checked]:bg-matte-cyan-600"
                  />
                  <Icon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">{ft.label}</span>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-100 flex items-center space-x-2">
            <Info className="w-4 h-4 text-matte-cyan-400" />
            <span>Folder Preview</span>
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">
            Preview of the folder structure that will be created
          </p>
        </CardHeader>
        <CardContent>
          <div className="bg-charcoal-900/60 rounded-lg p-4 font-mono text-xs space-y-1">
            <div className="text-matte-cyan-400 font-semibold">
              {destinationFolder || "/SecureScanner"}/
            </div>
            {getPreviewStructure().map((path, i) => (
              <div key={i} className="text-gray-400 pl-4">
                {mode === "date" && path.includes("Undetermined") ? (
                  <span className="text-yellow-400/80">{path.split("/").pop()}</span>
                ) : (
                  <span>{path.split("/").filter(Boolean).pop()}/</span>
                )}
              </div>
            ))}
            <div className="text-gray-600 pl-8 italic">
              renamed_files_here...
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {organizeResult && (
          <div className="flex items-center justify-center space-x-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-sm text-green-400">
              {organizeResult.moved} files moved{organizeResult.copied > 0 ? `, ${organizeResult.copied} project files copied` : ""} successfully
            </span>
          </div>
        )}

        <div className="flex space-x-3">
          <Button
            onClick={handleOrganize}
            disabled={
              organizeMutation.isPending ||
              filteredCount === 0 ||
              !destinationFolder.trim()
            }
            className="flex-1 bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white font-semibold py-3 rounded-xl transition-all duration-200"
          >
            {organizeMutation.isPending ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Organizing...
              </>
            ) : (
              <>
                <MoveRight className="w-4 h-4 mr-2" />
                Organize {filteredCount} Files
              </>
            )}
          </Button>

          <Button
            onClick={() => setLocation(sessionId ? `/scan/${sessionId}` : "/")}
            variant="outline"
            className="bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 border-charcoal-600 font-semibold py-3 px-6 rounded-xl"
          >
            Cancel
          </Button>
        </div>

        <p className="text-center text-xs text-gray-500">
          Regular files will be moved to the destination. Files from project folders will be copied to preserve project integrity.
        </p>
      </div>
    </div>
  );
}
