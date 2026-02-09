import { Button } from "@/components/ui/button";
import { FolderOpen, Download, FileText, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function QuickActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const organizeAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/organize-all"),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nsfw-results"] });
      toast({
        title: "Files organized",
        description: `Moved ${data.moved} file${data.moved !== 1 ? "s" : ""} to secure folders.`,
      });
    },
    onError: () => {
      toast({
        title: "Organization failed",
        description: "Could not organize files. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/scan-history"),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nsfw-results"] });
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

  const handleExportReport = async () => {
    try {
      const response = await fetch("/api/export/report");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nsfw-scan-report.json";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Report exported",
        description: "Your scan report has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not generate the report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBackupAll = async () => {
    try {
      const response = await fetch("/api/export/report");
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `securescanner-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Backup created",
        description: "Your data backup has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Backup failed",
        description: "Could not create backup. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-charcoal-800/60 backdrop-blur-sm rounded-xl p-6 border border-charcoal-700">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">Quick Actions</h2>
      
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => organizeAllMutation.mutate()}
          disabled={organizeAllMutation.isPending}
          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium py-3 px-4 rounded-xl transition-all duration-200 flex flex-col items-center space-y-1 border border-red-500/30 h-auto"
        >
          <FolderOpen className="w-5 h-5" />
          <span className="text-xs">{organizeAllMutation.isPending ? "Moving..." : "Move NSFW"}</span>
        </Button>
        
        <Button
          onClick={handleBackupAll}
          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium py-3 px-4 rounded-xl transition-all duration-200 flex flex-col items-center space-y-1 border border-blue-500/30 h-auto"
        >
          <Download className="w-5 h-5" />
          <span className="text-xs">Backup All</span>
        </Button>
        
        <Button
          onClick={handleExportReport}
          className="bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium py-3 px-4 rounded-xl transition-all duration-200 flex flex-col items-center space-y-1 border border-green-500/30 h-auto"
        >
          <FileText className="w-5 h-5" />
          <span className="text-xs">Export Report</span>
        </Button>
        
        <Button
          onClick={() => clearHistoryMutation.mutate()}
          disabled={clearHistoryMutation.isPending}
          className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-medium py-3 px-4 rounded-xl transition-all duration-200 flex flex-col items-center space-y-1 border border-orange-500/30 h-auto"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-xs">{clearHistoryMutation.isPending ? "Clearing..." : "Clear History"}</span>
        </Button>
      </div>
    </div>
  );
}
