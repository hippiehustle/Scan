import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export function useScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState("Ready to scan");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const scanMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setIsScanning(true);
      setProgress(5);
      setCurrentOperation("Creating scan session...");

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      setProgress(10);
      setCurrentOperation("Uploading files...");

      const xhr = new XMLHttpRequest();
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const uploadPercent = Math.round((event.loaded / event.total) * 50);
            setProgress(10 + uploadPercent);
            setCurrentOperation(`Uploading... ${Math.round((event.loaded / event.total) * 100)}%`);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(70);
            setCurrentOperation("Analyzing content with NSFW model...");
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid response"));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      const result = await uploadPromise;

      setProgress(90);
      setCurrentOperation("Finalizing results...");

      await new Promise((resolve) => setTimeout(resolve, 500));
      setProgress(100);
      setCurrentOperation("Scan complete");

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nsfw-results"] });
      if (data?.session?.id) {
        setTimeout(() => {
          setLocation(`/scan/${data.session.id}`);
          setIsScanning(false);
          setProgress(0);
          setCurrentOperation("Ready to scan");
        }, 1000);
      } else {
        setIsScanning(false);
        setProgress(0);
        setCurrentOperation("Ready to scan");
      }
    },
    onError: () => {
      setIsScanning(false);
      setProgress(0);
      setCurrentOperation("Scan failed - try again");
      setTimeout(() => setCurrentOperation("Ready to scan"), 3000);
    },
  });

  const startScanWithFiles = (files: File[]) => {
    if (isScanning || files.length === 0) return;
    scanMutation.mutate(files);
  };

  return {
    isScanning,
    progress,
    currentOperation,
    startScanWithFiles,
    scanError: scanMutation.error,
  };
}
