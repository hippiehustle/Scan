import QuickStats from "@/components/dashboard/quick-stats";
import ScanningStatus from "@/components/dashboard/scanning-status";
import RecentFindings from "@/components/dashboard/recent-findings";
import QuickActions from "@/components/dashboard/quick-actions";
import { Button } from "@/components/ui/button";
import { Search, Upload, Settings, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import FileUploadModal from "@/components/upload/file-upload-modal";
import { useScanner } from "@/hooks/use-scanner";

export default function Home() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { isScanning, startScanWithFiles } = useScanner();

  const handleQuickScan = () => {
    setShowUploadModal(true);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <QuickStats />
      <ScanningStatus />
      
      <div className="space-y-3">
        <Button 
          className="w-full bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 active:scale-95"
          onClick={() => setShowUploadModal(true)}
          disabled={isScanning}
        >
          <Search className="w-5 h-5" />
          <span>{isScanning ? "Scanning..." : "Start New Scan"}</span>
        </Button>
        
        <div className="grid grid-cols-2 gap-3">
          <Link href="/scan-config">
            <Button
              variant="outline"
              className="w-full bg-charcoal-800 hover:bg-charcoal-700 text-gray-200 font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 border border-charcoal-600"
            >
              <Settings className="w-4 h-4" />
              <span>Custom Scan</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            className="bg-charcoal-800 hover:bg-charcoal-700 text-gray-200 font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 border border-charcoal-600"
            onClick={() => setShowUploadModal(true)}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Files</span>
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 border border-purple-500/30"
            onClick={handleQuickScan}
            disabled={isScanning}
          >
            <Zap className="w-4 h-4" />
            <span>Quick Scan</span>
          </Button>
          <Link href="/reports">
            <Button
              variant="outline"
              className="w-full bg-charcoal-800 hover:bg-charcoal-700 text-gray-200 font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 border border-charcoal-600"
            >
              <span>View Reports</span>
            </Button>
          </Link>
        </div>
      </div>

      <RecentFindings />
      <QuickActions />

      <FileUploadModal 
        open={showUploadModal} 
        onOpenChange={setShowUploadModal}
        onScanWithFiles={startScanWithFiles}
        isScanning={isScanning}
      />
    </div>
  );
}
