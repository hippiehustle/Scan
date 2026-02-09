import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, FileText, TrendingUp, AlertTriangle } from "lucide-react";

export default function Reports() {
  const { data: stats, isLoading } = useQuery<{ totalFiles: number; nsfwFound: number; processed: number }>({
    queryKey: ["/api/stats"],
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
    } catch (error) {
      console.error("Failed to export report:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-charcoal-800/60 rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-charcoal-600 rounded w-1/2 mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-charcoal-600 rounded"></div>
                <div className="h-4 bg-charcoal-600 rounded w-3/4"></div>
              </div>
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
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Scan Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-100">
                {stats?.totalFiles || 0}
              </div>
              <div className="text-xs text-gray-400">Total Files</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">
                {stats?.nsfwFound || 0}
              </div>
              <div className="text-xs text-gray-400">NSFW Detected</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Processing Progress</span>
              <span className="text-gray-300">{stats?.processed || 0}%</span>
            </div>
            <Progress value={stats?.processed || 0} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Risk Assessment</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">High Risk Files</span>
              <span className="text-sm font-medium text-red-400">
                {stats?.nsfwFound || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Medium Risk Files</span>
              <span className="text-sm font-medium text-yellow-400">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Safe Files</span>
              <span className="text-sm font-medium text-green-400">
                {(stats?.totalFiles || 0) - (stats?.nsfwFound || 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Export Options</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handleExportReport}
            className="w-full bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Detailed Report</span>
          </Button>
          
          <div className="text-xs text-gray-400 text-center">
            Report includes scan summary, detected files, and timestamps
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
