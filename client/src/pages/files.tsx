import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Video, Image, FileText, FolderOpen, CheckCircle } from "lucide-react";
import type { ScanResult } from "@shared/schema";

export default function Files() {
  const [filter, setFilter] = useState<"all" | "nsfw" | "safe">("all");

  const { data: allResults = [], isLoading: allLoading } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan-results"],
  });

  const { data: nsfwResults = [], isLoading: nsfwLoading } = useQuery<ScanResult[]>({
    queryKey: ["/api/nsfw-results"],
  });

  const isLoading = allLoading || nsfwLoading;

  const displayResults = filter === "nsfw" 
    ? nsfwResults 
    : filter === "safe"
    ? allResults.filter(r => !r.isNsfw)
    : allResults;

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "image":
        return <Image className="w-5 h-5" />;
      case "video":
        return <Video className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getFlagBadgeColor = (category: string | null) => {
    switch (category) {
      case "explicit":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "suggestive":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "adult":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-charcoal-800/60 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-charcoal-600 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-charcoal-600 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center justify-between">
            <span>Scanned Files</span>
            <Badge variant="outline" className="text-xs text-gray-400 border-charcoal-600">
              {allResults.length} total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
              className={`text-xs ${filter === "all" ? "bg-matte-cyan-600 hover:bg-matte-cyan-700" : ""}`}
            >
              All ({allResults.length})
            </Button>
            <Button
              size="sm"
              variant={filter === "nsfw" ? "default" : "outline"}
              onClick={() => setFilter("nsfw")}
              className={`text-xs ${filter === "nsfw" ? "bg-red-600 hover:bg-red-700" : ""}`}
            >
              Flagged ({nsfwResults.length})
            </Button>
            <Button
              size="sm"
              variant={filter === "safe" ? "default" : "outline"}
              onClick={() => setFilter("safe")}
              className={`text-xs ${filter === "safe" ? "bg-green-600 hover:bg-green-700" : ""}`}
            >
              Safe ({allResults.length - nsfwResults.length})
            </Button>
          </div>

          {displayResults.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No files found</p>
              <p className="text-sm">
                {filter === "all" 
                  ? "Start a scan to analyze your files" 
                  : `No ${filter} files detected`}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {displayResults.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center space-x-3 p-3 bg-charcoal-700/50 rounded-lg"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    file.isNsfw 
                      ? "bg-red-500/20 text-red-400" 
                      : "bg-green-500/20 text-green-400"
                  }`}>
                    {getFileIcon(file.fileType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">
                      {file.filename}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      {file.actionTaken === "moved" ? (
                        <span className="text-xs text-matte-cyan-400 flex items-center">
                          <FolderOpen className="w-3 h-3 mr-1" />
                          Organized
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 truncate">
                          {file.filepath}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {file.isNsfw && file.flagCategory && (
                      <Badge className={`text-xs ${getFlagBadgeColor(file.flagCategory)}`}>
                        {file.flagCategory}
                      </Badge>
                    )}
                    {file.isNsfw ? (
                      <Badge variant="destructive" className="text-xs">
                        {Math.round(file.confidence * 100)}%
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Safe
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
