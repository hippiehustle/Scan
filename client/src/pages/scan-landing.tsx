import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Pause, 
  Play, 
  Square, 
  FileText, 
  Image, 
  Video,
  FolderOpen,
  Download,
  Trash2,
  MoveRight,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { ScanSession, ScanResult } from "@shared/schema";

interface ScanLandingProps {
  sessionId?: string;
}

export default function ScanLanding({ sessionId }: ScanLandingProps) {
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useQuery<ScanSession>({
    queryKey: ["/api/scan-sessions", sessionId],
    enabled: !!sessionId,
  });

  const { data: results = [], isLoading: resultsLoading } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan-results", sessionId],
    enabled: !!sessionId,
  });

  const organizeFilesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/organize-files/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error("Failed to organize files");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-results", sessionId] });
      toast({
        title: "Files organized successfully",
        description: "Flagged files have been moved and renamed according to their categories.",
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

  const pauseScanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/scan-sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to pause scan");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-sessions", sessionId] });
    },
  });

  const resumeScanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/scan-sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to resume scan");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-sessions", sessionId] });
    },
  });

  const stopScanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/scan-sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to stop scan");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-sessions", sessionId] });
      setLocation("/");
    },
  });

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "image":
        return <Image className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getFlagBadgeColor = (category: string) => {
    switch (category) {
      case "explicit":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "suggestive":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "adult":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "violent":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "disturbing":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const handleOrganizeFiles = () => {
    setIsProcessing(true);
    organizeFilesMutation.mutate();
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const progress = session ? Math.round((session.processedFiles / Math.max(session.totalFiles, 1)) * 100) : 0;
  const flaggedResults = results.filter(r => r.isNsfw);

  if (sessionLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-charcoal-600 rounded w-1/3"></div>
          <div className="h-32 bg-charcoal-600 rounded"></div>
          <div className="h-24 bg-charcoal-600 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Scan Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-matte-cyan-600 rounded-full flex items-center justify-center mx-auto">
          <Search className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-100">Content Scan in Progress</h1>
        <p className="text-gray-400">
          {session?.status === "completed" 
            ? "Scan completed successfully" 
            : session?.status === "paused" 
            ? "Scan is currently paused"
            : "Analyzing your files for inappropriate content"}
        </p>
      </div>

      {/* Progress Card */}
      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-100">Scan Progress</h2>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                session?.status === "active" ? 'bg-green-500 animate-pulse' :
                session?.status === "paused" ? 'bg-yellow-500' :
                session?.status === "completed" ? 'bg-matte-cyan-500' :
                'bg-gray-500'
              }`}></div>
              <span className="text-sm text-gray-400 capitalize">
                {session?.status || "Unknown"}
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Overall Progress</span>
              <span className="text-gray-300">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-gray-100">{session?.totalFiles || 0}</div>
                <div className="text-xs text-gray-400">Total Files</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-400">{session?.processedFiles || 0}</div>
                <div className="text-xs text-gray-400">Processed</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-400">{session?.nsfwFound || 0}</div>
                <div className="text-xs text-gray-400">Flagged</div>
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-charcoal-600">
            {session?.status === "active" && (
              <Button
                onClick={() => pauseScanMutation.mutate()}
                disabled={pauseScanMutation.isPending}
                className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30"
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause Scan
              </Button>
            )}
            
            {session?.status === "paused" && (
              <Button
                onClick={() => resumeScanMutation.mutate()}
                disabled={resumeScanMutation.isPending}
                className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
              >
                <Play className="w-4 h-4 mr-2" />
                Resume Scan
              </Button>
            )}
            
            <Button
              onClick={() => stopScanMutation.mutate()}
              disabled={stopScanMutation.isPending}
              variant="outline"
              className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Flagged Files */}
      {flaggedResults.length > 0 && (
        <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span>Flagged Content</span>
              </h2>
              <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
                {flaggedResults.length} files
              </Badge>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {flaggedResults.slice(0, 10).map((result) => (
                <div
                  key={result.id}
                  className="flex items-center space-x-3 p-3 bg-charcoal-700/50 rounded-lg"
                >
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400">
                    {getFileIcon(result.fileType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">
                      {result.filename}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {result.filepath}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {result.flagCategory && (
                      <Badge className={`text-xs ${getFlagBadgeColor(result.flagCategory)}`}>
                        {result.flagCategory}
                      </Badge>
                    )}
                    <Badge variant="destructive" className="text-xs">
                      {Math.round(result.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {flaggedResults.length > 10 && (
              <div className="text-center text-sm text-gray-400">
                Showing 10 of {flaggedResults.length} flagged files
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* File Organization */}
      {session?.status === "completed" && flaggedResults.length > 0 && (
        <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-matte-cyan-600 rounded-full flex items-center justify-center mx-auto">
                <FolderOpen className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-100">Organize Flagged Files</h3>
              <p className="text-sm text-gray-400">
                Move all flagged files to categorized folders and rename them based on their content flags
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleOrganizeFiles}
                disabled={isProcessing || organizeFilesMutation.isPending}
                className="bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <MoveRight className="w-4 h-4" />
                    <span>Organize Files</span>
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => setLocation("/files")}
                variant="outline"
                className="bg-charcoal-700 hover:bg-charcoal-600 text-gray-200 border-charcoal-600 font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>View Details</span>
              </Button>
            </div>

            <div className="text-xs text-gray-400 text-center pt-2 border-t border-charcoal-600">
              Files will be organized into: /SecureScanner/[category]/[renamed_files]
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-center">
        <Button
          onClick={() => setLocation("/")}
          variant="ghost"
          className="text-matte-cyan-400 hover:text-matte-cyan-300"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}