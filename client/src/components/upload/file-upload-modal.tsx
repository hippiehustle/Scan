import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, CheckCircle, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface FileUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanWithFiles?: (files: File[]) => void;
  isScanning?: boolean;
}

export default function FileUploadModal({ open, onOpenChange, onScanWithFiles, isScanning }: FileUploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const uploadMutation = useMutation({
    mutationFn: async (filesToUpload: File[]) => {
      const formData = new FormData();
      filesToUpload.forEach((file) => {
        formData.append("files", file);
      });

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

      toast({
        title: "Scan complete",
        description: `Analyzed ${totalCount} file${totalCount !== 1 ? "s" : ""}. ${nsfwCount > 0 ? `${nsfwCount} flagged as NSFW.` : "No NSFW content detected."}`,
        variant: nsfwCount > 0 ? "destructive" : "default",
      });

      setTimeout(() => {
        onOpenChange(false);
        setFiles([]);
        setUploadProgress(0);
        setUploadStatus("");
        setUploading(false);
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

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
    if (event.target) event.target.value = "";
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("Preparing files...");
    uploadMutation.mutate(files);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!uploading) onOpenChange(val); }}>
      <DialogContent className="bg-charcoal-800 border border-charcoal-700 text-gray-100 max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Upload & Scan Files</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!uploading ? (
            <>
              <div
                className="border-2 border-dashed border-charcoal-600 rounded-xl p-8 text-center hover:border-matte-cyan-600 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={handleFileSelect}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-300 mb-2">Drop files here or</p>
                <span className="text-matte-cyan-400 hover:text-matte-cyan-300 transition-colors font-medium">
                  Choose Files
                </span>
                <p className="text-xs text-gray-500 mt-2">
                  Supports images (JPG, PNG, GIF, BMP, WebP)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />

              {files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-200">
                    Selected Files ({files.length}):
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-charcoal-700 rounded p-2">
                        <div className="flex-1 min-w-0 mr-2">
                          <span className="text-xs text-gray-300 truncate block">{file.name}</span>
                          <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
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
                disabled={files.length === 0 || uploadMutation.isPending}
                className="w-full bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200"
              >
                Start Analysis ({files.length} file{files.length !== 1 ? "s" : ""})
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
                {files.length} file{files.length !== 1 ? "s" : ""} being analyzed with NSFW detection model
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
