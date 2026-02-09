import { useQuery } from "@tanstack/react-query";

export default function QuickStats() {
  const { data: stats, isLoading } = useQuery<{ totalFiles: number; nsfwFound: number; processed: number }>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-charcoal-800/60 backdrop-blur-sm rounded-xl p-4 border border-charcoal-700 animate-pulse">
            <div className="text-center">
              <div className="h-8 bg-charcoal-600 rounded w-12 mx-auto mb-2"></div>
              <div className="h-3 bg-charcoal-600 rounded w-16 mx-auto"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-charcoal-800/60 backdrop-blur-sm rounded-xl p-4 border border-charcoal-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-100">
            {stats?.totalFiles || 0}
          </div>
          <div className="text-xs text-gray-400 mt-1">Total Files</div>
        </div>
      </div>
      <div className="bg-charcoal-800/60 backdrop-blur-sm rounded-xl p-4 border border-charcoal-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">
            {stats?.nsfwFound || 0}
          </div>
          <div className="text-xs text-gray-400 mt-1">NSFW Found</div>
        </div>
      </div>
      <div className="bg-charcoal-800/60 backdrop-blur-sm rounded-xl p-4 border border-charcoal-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">
            {stats?.processed || 0}%
          </div>
          <div className="text-xs text-gray-400 mt-1">Processed</div>
        </div>
      </div>
    </div>
  );
}
