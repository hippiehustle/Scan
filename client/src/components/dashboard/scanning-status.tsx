import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import type { ScanSession } from "@shared/schema";

export default function ScanningStatus() {
  const { data: activeSessions = [] } = useQuery<ScanSession[]>({
    queryKey: ["/api/scan-sessions/active"],
    refetchInterval: 5000,
  });

  const { data: allSessions = [] } = useQuery<ScanSession[]>({
    queryKey: ["/api/scan-sessions"],
  });

  const activeSession = activeSessions.length > 0 ? activeSessions[0] : null;
  const latestSession = !activeSession && allSessions.length > 0 ? allSessions[0] : null;
  const displaySession = activeSession || latestSession;
  const isScanning = !!activeSession;

  const progress = displaySession
    ? Math.round(((displaySession.processedFiles ?? 0) / Math.max(displaySession.totalFiles ?? 1, 1)) * 100)
    : 0;

  const statusText = isScanning
    ? `Processing ${activeSession!.processedFiles ?? 0}/${activeSession!.totalFiles ?? 0} files`
    : latestSession
    ? `Last scan: ${latestSession.processedFiles ?? 0} file${(latestSession.processedFiles ?? 0) !== 1 ? "s" : ""} analyzed`
    : "Ready to scan";

  return (
    <div className="bg-charcoal-800/60 backdrop-blur-sm rounded-xl p-6 border border-charcoal-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-100">Scanning Progress</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            isScanning ? 'bg-matte-cyan-500 animate-pulse' 
            : latestSession?.status === 'completed' ? 'bg-green-500' 
            : 'bg-gray-500'
          }`}></div>
          <span className="text-sm text-gray-400">{statusText}</span>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Overall Progress</span>
          <span className="text-gray-300">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-gray-500">
          <span>
            {isScanning ? `Scanning (${activeSession!.status})` 
            : latestSession ? `Completed` 
            : "No scans yet"}
          </span>
          <span>
            {displaySession && (displaySession.nsfwFound ?? 0) > 0 
              ? `${displaySession.nsfwFound} flagged` 
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
