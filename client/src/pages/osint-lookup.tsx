import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Globe,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Filter,
  Eye,
  EyeOff,
  Users,
  Activity,
  ChevronDown,
  ChevronUp,
  StopCircle,
} from "lucide-react";
import type { OsintScan, OsintResult } from "@shared/schema";

const NSFW_TAGS = new Set(["porn", "dating", "erotic", "webcam", "nsfw", "adult", "hentai", "xxx"]);

export default function OsintLookup() {
  const [username, setUsername] = useState("");
  const [nsfwOnly, setNsfwOnly] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeScanId, setActiveScanId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showFoundOnly, setShowFoundOnly] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  const { data: siteStats } = useQuery<{
    totalSites: number;
    nsfwSites: number;
    tags: { tag: string; count: number }[];
  }>({
    queryKey: ["/api/osint/sites"],
  });

  const { data: activeScan, refetch: refetchScan } = useQuery<OsintScan>({
    queryKey: ["/api/osint/scan", activeScanId],
    queryFn: async () => {
      const res = await fetch(`/api/osint/scan/${activeScanId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch scan");
      return res.json();
    },
    enabled: !!activeScanId,
    refetchInterval: activeScanId ? 2000 : false,
  });

  const { data: scanResults, refetch: refetchResults } = useQuery<OsintResult[]>({
    queryKey: ["/api/osint/scan", activeScanId, "results"],
    queryFn: async () => {
      const res = await fetch(`/api/osint/scan/${activeScanId}/results`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
    enabled: !!activeScanId,
    refetchInterval: activeScanId && activeScan?.status === "active" ? 3000 : false,
  });

  const { data: scanHistory } = useQuery<OsintScan[]>({
    queryKey: ["/api/osint/scans"],
  });

  useEffect(() => {
    if (activeScan?.status === "completed" || activeScan?.status === "cancelled") {
      refetchResults();
    }
  }, [activeScan?.status]);

  const startScan = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/osint/scan", {
        username: username.trim(),
        tagFilters: selectedTags,
        nsfwOnly,
        siteLimit: undefined,
      });
      return res.json();
    },
    onSuccess: (scan: OsintScan) => {
      setActiveScanId(scan.id);
      toast({ title: "Scan started", description: `Checking ${scan.totalSites} sites for "${scan.username}"` });
      queryClient.invalidateQueries({ queryKey: ["/api/osint/scans"] });
    },
    onError: () => {
      toast({ title: "Scan failed", description: "Could not start username lookup", variant: "destructive" });
    },
  });

  const cancelScan = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/osint/scan/${activeScanId}/cancel`, {});
    },
    onSuccess: () => {
      toast({ title: "Scan cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/osint/scans"] });
    },
  });

  const handleStartScan = () => {
    if (!username.trim()) {
      toast({ title: "Enter a username", variant: "destructive" });
      return;
    }
    startScan.mutate();
  };

  const loadPreviousScan = (scan: OsintScan) => {
    setActiveScanId(scan.id);
    setUsername(scan.username);
    setShowHistory(false);
  };

  const progress = activeScan
    ? Math.round(((activeScan.checkedSites || 0) / Math.max(activeScan.totalSites || 1, 1)) * 100)
    : 0;

  const isActive = activeScan?.status === "active";
  const isComplete = activeScan?.status === "completed" || activeScan?.status === "cancelled";

  const foundResults = scanResults?.filter(r => r.status === "found") || [];
  const nsfwResults = foundResults.filter(r => r.isNsfw);
  const displayResults = showFoundOnly
    ? foundResults
    : scanResults || [];

  const topTags = siteStats?.tags.slice(0, 20) || [];

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <Globe className="w-6 h-6 text-matte-cyan-400" />
          <h1 className="text-xl font-bold text-gray-100">OSINT Lookup</h1>
        </div>
        <p className="text-sm text-gray-400">
          Search {siteStats?.totalSites?.toLocaleString() || "2,600+"} websites for username profiles
        </p>
      </div>

      <Card className="bg-charcoal-800 border-charcoal-700">
        <CardContent className="pt-4 space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Enter username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isActive && handleStartScan()}
              className="bg-charcoal-900 border-charcoal-600 text-gray-100 placeholder-gray-500"
              disabled={isActive}
            />
            {isActive ? (
              <Button
                onClick={() => cancelScan.mutate()}
                variant="destructive"
                size="icon"
                className="shrink-0"
              >
                <StopCircle className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleStartScan}
                disabled={startScan.isPending || !username.trim()}
                className="bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white shrink-0"
              >
                {startScan.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <div className="flex items-center space-x-2">
              <Switch
                id="nsfw-filter"
                checked={nsfwOnly}
                onCheckedChange={setNsfwOnly}
                disabled={isActive}
              />
              <Label htmlFor="nsfw-filter" className="text-xs text-gray-400">
                NSFW only ({siteStats?.nsfwSites || 0})
              </Label>
            </div>
          </div>

          {showFilters && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Filter by category:</p>
              <div className="flex flex-wrap gap-1.5">
                {topTags.map(({ tag, count }) => {
                  const isSelected = selectedTags.includes(tag);
                  const isNsfw = NSFW_TAGS.has(tag.toLowerCase());
                  return (
                    <Badge
                      key={tag}
                      variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer text-[10px] transition-colors ${
                        isSelected
                          ? isNsfw
                            ? "bg-red-600/80 hover:bg-red-700 text-white border-red-500"
                            : "bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white"
                          : isNsfw
                            ? "border-red-500/50 text-red-400 hover:bg-red-500/20"
                            : "border-charcoal-600 text-gray-400 hover:bg-charcoal-700"
                      }`}
                      onClick={() => {
                        if (isActive) return;
                        setSelectedTags(prev =>
                          isSelected ? prev.filter(t => t !== tag) : [...prev, tag]
                        );
                      }}
                    >
                      {tag} ({count})
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {activeScan && (
        <Card className="bg-charcoal-800 border-charcoal-700">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isActive ? (
                  <Loader2 className="w-4 h-4 text-matte-cyan-400 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                )}
                <span className="text-sm font-medium text-gray-200">
                  @{activeScan.username}
                </span>
              </div>
              <Badge
                variant="outline"
                className={
                  isActive
                    ? "border-matte-cyan-500 text-matte-cyan-400"
                    : "border-green-500 text-green-400"
                }
              >
                {activeScan.status}
              </Badge>
            </div>

            <Progress value={progress} className="h-2" />

            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-gray-100">{activeScan.checkedSites || 0}</p>
                <p className="text-[10px] text-gray-500">Checked</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-100">{activeScan.totalSites || 0}</p>
                <p className="text-[10px] text-gray-500">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-400">{activeScan.foundCount || 0}</p>
                <p className="text-[10px] text-gray-500">Found</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-400">{activeScan.nsfwFoundCount || 0}</p>
                <p className="text-[10px] text-gray-500">NSFW</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {scanResults && scanResults.length > 0 && (
        <Card className="bg-charcoal-800 border-charcoal-700">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-gray-200">
                Results ({foundResults.length} found)
              </CardTitle>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowFoundOnly(!showFoundOnly)}
                  className="flex items-center space-x-1 text-xs text-gray-400 hover:text-gray-200"
                >
                  {showFoundOnly ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{showFoundOnly ? "Found only" : "All"}</span>
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2 max-h-[400px] overflow-y-auto">
            {displayResults.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No results yet...</p>
            )}
            {displayResults.map((result) => (
              <ResultItem key={result.id} result={result} />
            ))}
          </CardContent>
        </Card>
      )}

      {scanHistory && scanHistory.length > 0 && (
        <Card className="bg-charcoal-800 border-charcoal-700">
          <CardHeader className="py-3 px-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full"
            >
              <CardTitle className="text-sm text-gray-200 flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Scan History ({scanHistory.length})</span>
              </CardTitle>
              {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
          </CardHeader>
          {showHistory && (
            <CardContent className="px-4 pb-4 space-y-2">
              {scanHistory.map((scan) => (
                <button
                  key={scan.id}
                  onClick={() => loadPreviousScan(scan)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    scan.id === activeScanId
                      ? "bg-matte-cyan-600/20 border border-matte-cyan-500/30"
                      : "bg-charcoal-900 hover:bg-charcoal-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-200">@{scan.username}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        scan.status === "completed"
                          ? "border-green-500/50 text-green-400"
                          : scan.status === "active"
                            ? "border-matte-cyan-500/50 text-matte-cyan-400"
                            : "border-gray-500/50 text-gray-400"
                      }`}
                    >
                      {scan.status}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                    <span>{scan.foundCount || 0} found</span>
                    <span>{scan.nsfwFoundCount || 0} NSFW</span>
                    <span>{scan.totalSites} sites</span>
                  </div>
                </button>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      <div className="text-center space-y-1">
        <p className="text-[10px] text-gray-600">
          Powered by Maigret OSINT database
        </p>
        <p className="text-[10px] text-gray-600">
          {siteStats?.totalSites?.toLocaleString() || "2,600+"} sites |{" "}
          {siteStats?.tags.length || 0} categories |{" "}
          {siteStats?.nsfwSites || 0} NSFW sources
        </p>
      </div>
    </div>
  );
}

function ResultItem({ result }: { result: OsintResult }) {
  const isFound = result.status === "found";
  const isError = result.status === "error" || result.status === "timeout";

  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-lg ${
        isFound
          ? result.isNsfw
            ? "bg-red-500/10 border border-red-500/20"
            : "bg-green-500/10 border border-green-500/20"
          : isError
            ? "bg-yellow-500/5 border border-yellow-500/10"
            : "bg-charcoal-900 border border-charcoal-700/50"
      }`}
    >
      <div className="flex items-center space-x-2 min-w-0 flex-1">
        <div className="shrink-0">
          {isFound ? (
            <CheckCircle2 className={`w-4 h-4 ${result.isNsfw ? "text-red-400" : "text-green-400"}`} />
          ) : isError ? (
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          ) : (
            <XCircle className="w-4 h-4 text-gray-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5">
            <p className="text-sm font-medium text-gray-200 truncate">{result.siteName}</p>
            {result.isNsfw && (
              <Badge className="bg-red-600/80 text-white text-[8px] px-1 py-0">NSFW</Badge>
            )}
          </div>
          {result.tags && result.tags.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-0.5">
              {result.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[9px] text-gray-500">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-1.5 shrink-0">
        {result.responseTime != null && (
          <span className="text-[10px] text-gray-600">{result.responseTime}ms</span>
        )}
        {isFound && result.profileUrl && (
          <a
            href={result.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-matte-cyan-400 hover:text-matte-cyan-300"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
