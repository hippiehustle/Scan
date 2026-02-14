import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, CheckCircle, FolderOpen, File, AlertTriangle, FolderTree } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const PROJECT_INDICATORS = [
  "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  ".git", ".gitignore", ".gitmodules",
  "Cargo.toml", "Cargo.lock",
  "go.mod", "go.sum",
  "requirements.txt", "setup.py", "pyproject.toml", "Pipfile", "poetry.lock",
  "composer.json", "composer.lock",
  "Gemfile", "Gemfile.lock",
  "build.gradle", "build.gradle.kts", "pom.xml", "settings.gradle",
  "CMakeLists.txt", "Makefile", "makefile",
  ".sln", ".csproj", ".fsproj", ".vbproj",
  "tsconfig.json", "jsconfig.json",
  "webpack.config.js", "vite.config.ts", "vite.config.js", "rollup.config.js",
  ".eslintrc", ".eslintrc.json", ".eslintrc.js",
  "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
  ".env", ".env.local", ".env.example",
  "pubspec.yaml",
  "Podfile", "Podfile.lock",
  ".xcodeproj", ".xcworkspace",
  "gradlew", "gradlew.bat",
  "mix.exs",
  "stack.yaml", "cabal.project",
  "deno.json", "deno.jsonc",
  "bun.lockb",
];

const PROJECT_DIRS = [
  "node_modules", ".git", "__pycache__", ".venv", "venv",
  "target", "build", "dist", ".gradle", ".idea", ".vscode",
  "vendor", ".next", ".nuxt", "out", ".svelte-kit",
  "bin", "obj", ".dart_tool", ".pub-cache",
  "Pods", ".expo", "android", "ios",
];

const MEDIA_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".ico", ".tiff", ".tif",
  ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm", ".m4v", ".3gp",
  ".mp3", ".wav", ".ogg", ".flac", ".aac", ".wma",
];

function isMediaFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return MEDIA_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function detectProjectFolders(files: File[]): Set<string> {
  const projectRoots = new Set<string>();
  
  for (const file of files) {
    const path = (file as any).webkitRelativePath || file.name;
    const parts = path.split("/");
    
    const fileName = parts[parts.length - 1];
    if (PROJECT_INDICATORS.includes(fileName)) {
      const projectRoot = parts.slice(0, -1).join("/");
      if (projectRoot) {
        projectRoots.add(projectRoot);
      }
    }
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (PROJECT_DIRS.includes(parts[i])) {
        const projectRoot = parts.slice(0, i).join("/");
        if (projectRoot) {
          projectRoots.add(projectRoot);
        }
      }
    }
  }
  
  return projectRoots;
}

function isInProjectFolder(filePath: string, projectRoots: string[]): boolean {
  for (let i = 0; i < projectRoots.length; i++) {
    const root = projectRoots[i];
    if (filePath === root || filePath.startsWith(root + "/")) {
      return true;
    }
  }
  return false;
}

interface FileWithMeta {
  file: File;
  relativePath: string;
  isProjectFile: boolean;
}

interface FileUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanWithFiles?: (files: File[]) => void;
  isScanning?: boolean;
}

export default function FileUploadModal({ open, onOpenChange, onScanWithFiles, isScanning }: FileUploadModalProps) {
  const [filesWithMeta, setFilesWithMeta] = useState<FileWithMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [scanMode, setScanMode] = useState<"files" | "folder">("files");
  const [folderName, setFolderName] = useState("");
  const [projectFoldersDetected, setProjectFoldersDetected] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const uploadMutation = useMutation({
    mutationFn: async (filesToUpload: FileWithMeta[]) => {
      const formData = new FormData();
      
      const metadataArray: Array<{ relativePath: string; isProjectFile: boolean }> = [];
      filesToUpload.forEach((fwm) => {
        formData.append("files", fwm.file);
        metadataArray.push({
          relativePath: fwm.relativePath,
          isProjectFile: fwm.isProjectFile,
        });
      });
      
      formData.append("metadata", JSON.stringify(metadataArray));
      formData.append("isFolderScan", scanMode === "folder" ? "true" : "false");
      formData.append("folderName", folderName);

      return new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 60);
            setUploadProgress(percent);
            setUploadStatus(`Uploading... ${Math.round((event.loaded / event.total) * 100)}%`);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(70);
            setUploadStatus("Running NSFW analysis...");
            try {
              const result = JSON.parse(xhr.responseText);
              setUploadProgress(100);
              setUploadStatus("Analysis complete!");
              resolve(result);
            } catch {
              reject(new Error("Invalid response"));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nsfw-results"] });

      const nsfwCount = data?.results?.filter((r: any) => r.isNsfw).length || 0;
      const totalCount = data?.results?.length || 0;
      const projectFileCount = data?.results?.filter((r: any) => r.isProjectFile).length || 0;

      let description = `Analyzed ${totalCount} file${totalCount !== 1 ? "s" : ""}. `;
      if (nsfwCount > 0) {
        description += `${nsfwCount} flagged as NSFW.`;
      } else {
        description += "No NSFW content detected.";
      }
      if (projectFileCount > 0) {
        description += ` ${projectFileCount} from project folders (will be copied, not moved).`;
      }

      toast({
        title: "Scan complete",
        description,
        variant: nsfwCount > 0 ? "destructive" : "default",
      });

      setTimeout(() => {
        onOpenChange(false);
        resetState();
        if (data?.session?.id) {
          setLocation(`/scan/${data.session.id}`);
        }
      }, 1500);
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "There was an error processing your files. Please try again.",
        variant: "destructive",
      });
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus("");
    },
  });

  const resetState = () => {
    setFilesWithMeta([]);
    setUploadProgress(0);
    setUploadStatus("");
    setUploading(false);
    setFolderName("");
    setProjectFoldersDetected([]);
  };

  const handleFileSelect = () => {
    if (scanMode === "folder") {
      folderInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const newFiles: FileWithMeta[] = selectedFiles.map(f => ({
      file: f,
      relativePath: f.name,
      isProjectFile: false,
    }));
    setFilesWithMeta((prev) => [...prev, ...newFiles]);
    if (event.target) event.target.value = "";
  };

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(event.target.files || []);
    if (allFiles.length === 0) return;

    const firstPath = (allFiles[0] as any).webkitRelativePath || "";
    const rootFolder = firstPath.split("/")[0] || "Selected Folder";
    setFolderName(rootFolder);

    const projectRootsSet = detectProjectFolders(allFiles);
    const projectRootsArray = Array.from(projectRootsSet);
    setProjectFoldersDetected(projectRootsArray);

    const mediaFiles = allFiles.filter(f => {
      const path = (f as any).webkitRelativePath || f.name;
      return isMediaFile(path);
    });

    const newFiles: FileWithMeta[] = mediaFiles.map(f => {
      const relativePath = (f as any).webkitRelativePath || f.name;
      const inProject = isInProjectFolder(relativePath, projectRootsArray);
      return {
        file: f,
        relativePath,
        isProjectFile: inProject,
      };
    });

    setFilesWithMeta(newFiles);
    if (event.target) event.target.value = "";
  };

  const handleUpload = async () => {
    if (filesWithMeta.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("Preparing files...");
    uploadMutation.mutate(filesWithMeta);
  };

  const handleRemoveFile = (index: number) => {
    setFilesWithMeta(filesWithMeta.filter((_, i) => i !== index));
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    const newFiles: FileWithMeta[] = droppedFiles.map(f => ({
      file: f,
      relativePath: f.name,
      isProjectFile: false,
    }));
    setFilesWithMeta((prev) => [...prev, ...newFiles]);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSize = filesWithMeta.reduce((sum, f) => sum + f.file.size, 0);
  const projectFileCount = filesWithMeta.filter(f => f.isProjectFile).length;
  const regularFileCount = filesWithMeta.length - projectFileCount;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!uploading) { onOpenChange(val); if (!val) resetState(); } }}>
      <DialogContent className="bg-charcoal-800 border border-charcoal-700 text-gray-100 max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Upload & Scan</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!uploading ? (
            <>
              <div className="flex rounded-xl overflow-hidden border border-charcoal-600">
                <button
                  onClick={() => { setScanMode("files"); setFilesWithMeta([]); setProjectFoldersDetected([]); }}
                  className={`flex-1 py-2.5 px-3 text-sm font-medium flex items-center justify-center space-x-1.5 transition-colors ${
                    scanMode === "files"
                      ? "bg-matte-cyan-600 text-white"
                      : "bg-charcoal-700 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <File className="w-4 h-4" />
                  <span>Files</span>
                </button>
                <button
                  onClick={() => { setScanMode("folder"); setFilesWithMeta([]); setProjectFoldersDetected([]); }}
                  className={`flex-1 py-2.5 px-3 text-sm font-medium flex items-center justify-center space-x-1.5 transition-colors ${
                    scanMode === "folder"
                      ? "bg-matte-cyan-600 text-white"
                      : "bg-charcoal-700 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Folder</span>
                </button>
              </div>

              <div
                className="border-2 border-dashed border-charcoal-600 rounded-xl p-6 text-center hover:border-matte-cyan-600 transition-colors cursor-pointer"
                onDrop={scanMode === "files" ? handleDrop : undefined}
                onDragOver={scanMode === "files" ? handleDragOver : undefined}
                onClick={handleFileSelect}
              >
                {scanMode === "folder" ? (
                  <>
                    <FolderTree className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-300 mb-1 text-sm">Select a folder to scan</p>
                    <span className="text-matte-cyan-400 hover:text-matte-cyan-300 transition-colors font-medium text-sm">
                      Choose Folder
                    </span>
                    <p className="text-xs text-gray-500 mt-2">
                      Scans all media in root folder and subfolders
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-300 mb-1 text-sm">Drop files here or</p>
                    <span className="text-matte-cyan-400 hover:text-matte-cyan-300 transition-colors font-medium text-sm">
                      Choose Files
                    </span>
                    <p className="text-xs text-gray-500 mt-2">
                      Supports images (JPG, PNG, GIF, BMP, WebP)
                    </p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />

              <input
                ref={folderInputRef}
                type="file"
                {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
                onChange={handleFolderChange}
                className="hidden"
              />

              {folderName && scanMode === "folder" && (
                <div className="bg-charcoal-700/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <FolderOpen className="w-4 h-4 text-matte-cyan-400" />
                    <span className="text-sm font-medium text-gray-200">{folderName}</span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>Media files found: <span className="text-gray-200">{filesWithMeta.length}</span></div>
                    {projectFoldersDetected.length > 0 && (
                      <div className="flex items-start space-x-1.5 mt-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-yellow-400 font-medium">
                            {projectFoldersDetected.length} project folder{projectFoldersDetected.length !== 1 ? "s" : ""} detected
                          </span>
                          <p className="text-gray-500 mt-0.5">
                            Media in project folders will be <span className="text-yellow-300">copied</span> instead of moved to preserve project integrity.
                          </p>
                          <div className="mt-1 space-y-0.5">
                            {projectFoldersDetected.slice(0, 3).map((dir, i) => (
                              <div key={i} className="text-gray-500 font-mono text-[10px] truncate">/{dir}/</div>
                            ))}
                            {projectFoldersDetected.length > 3 && (
                              <div className="text-gray-500 text-[10px]">+{projectFoldersDetected.length - 3} more</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {filesWithMeta.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-200">
                      {scanMode === "folder" ? "Media Files" : "Selected Files"} ({filesWithMeta.length})
                    </h4>
                    <span className="text-xs text-gray-400">{formatFileSize(totalSize)}</span>
                  </div>
                  {scanMode === "folder" && (projectFileCount > 0 || regularFileCount > 0) && (
                    <div className="flex gap-2 text-xs">
                      {regularFileCount > 0 && (
                        <span className="bg-matte-cyan-600/20 text-matte-cyan-400 px-2 py-0.5 rounded">
                          {regularFileCount} regular (move)
                        </span>
                      )}
                      {projectFileCount > 0 && (
                        <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                          {projectFileCount} project (copy)
                        </span>
                      )}
                    </div>
                  )}
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {filesWithMeta.map((fwm, index) => (
                      <div key={index} className="flex items-center justify-between bg-charcoal-700 rounded p-2">
                        <div className="flex-1 min-w-0 mr-2">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-300 truncate block">
                              {scanMode === "folder" ? fwm.relativePath : fwm.file.name}
                            </span>
                            {fwm.isProjectFile && (
                              <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1 rounded flex-shrink-0">
                                proj
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">{formatFileSize(fwm.file.size)}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveFile(index)}
                          className="p-1 h-auto text-gray-400 hover:text-gray-200"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={filesWithMeta.length === 0 || uploadMutation.isPending}
                className="w-full bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200"
              >
                Start Analysis ({filesWithMeta.length} file{filesWithMeta.length !== 1 ? "s" : ""})
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-matte-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  {uploadProgress === 100 ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <Upload className="w-6 h-6 text-white animate-pulse" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-100">
                  {uploadProgress === 100 ? "Analysis Complete!" : "Scanning Files..."}
                </h3>
                <p className="text-sm text-gray-400">
                  {uploadStatus || "Please wait while we analyze your files"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Progress</span>
                  <span className="text-gray-300">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>

              <p className="text-xs text-gray-500 text-center">
                {filesWithMeta.length} file{filesWithMeta.length !== 1 ? "s" : ""} being analyzed with NSFW detection model
                {scanMode === "folder" && folderName && (
                  <span className="block mt-1">Scanning folder: {folderName}</span>
                )}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
