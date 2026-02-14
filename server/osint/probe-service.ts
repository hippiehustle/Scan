import { readFileSync } from "fs";
import { join } from "path";

export interface MaigretSite {
  name: string;
  urlMain: string;
  url: string;
  checkType: string;
  tags: string[];
  alexaRank: number;
  presenseStrs: string[];
  absenceStrs: string[];
}

export interface ProbeResult {
  siteName: string;
  siteUrl: string;
  profileUrl: string | null;
  status: "found" | "not_found" | "error" | "timeout";
  tags: string[];
  isNsfw: boolean;
  responseTime: number;
}

const NSFW_TAGS = new Set(["porn", "dating", "erotic", "webcam", "nsfw", "adult", "hentai", "xxx"]);
const CONCURRENCY = 15;
const SITE_TIMEOUT = 8000;

let sitesCache: MaigretSite[] | null = null;

export function loadSites(): MaigretSite[] {
  if (sitesCache) return sitesCache;
  try {
    const dataPath = join(process.cwd(), "server/osint/maigret-sites.json");
    const raw = readFileSync(dataPath, "utf-8");
    sitesCache = JSON.parse(raw);
    return sitesCache!;
  } catch (err) {
    console.error("Failed to load Maigret sites:", err);
    return [];
  }
}

export function getSiteStats() {
  const sites = loadSites();
  const tagCounts: Record<string, number> = {};
  let nsfwCount = 0;

  sites.forEach((s) => {
    const hasNsfw = s.tags.some((t) => NSFW_TAGS.has(t.toLowerCase()));
    if (hasNsfw) nsfwCount++;
    s.tags.forEach((t) => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  return {
    totalSites: sites.length,
    nsfwSites: nsfwCount,
    tags: Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function filterSites(
  tagFilters: string[] = [],
  nsfwOnly: boolean = false,
  limit?: number
): MaigretSite[] {
  let sites = loadSites();

  if (nsfwOnly) {
    sites = sites.filter((s) =>
      s.tags.some((t) => NSFW_TAGS.has(t.toLowerCase()))
    );
  }

  if (tagFilters.length > 0) {
    const filterSet = new Set(tagFilters.map((t) => t.toLowerCase()));
    sites = sites.filter((s) =>
      s.tags.some((t) => filterSet.has(t.toLowerCase()))
    );
  }

  if (limit && limit > 0) {
    sites = sites.slice(0, limit);
  }

  return sites;
}

function isSiteNsfw(tags: string[]): boolean {
  return tags.some((t) => NSFW_TAGS.has(t.toLowerCase()));
}

async function probeSite(
  site: MaigretSite,
  username: string
): Promise<ProbeResult> {
  const startTime = Date.now();
  const profileUrl = site.url.replace(/\{username\}/g, username);

  const base: Omit<ProbeResult, "status" | "responseTime"> = {
    siteName: site.name,
    siteUrl: site.urlMain,
    profileUrl,
    tags: site.tags,
    isNsfw: isSiteNsfw(site.tags),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SITE_TIMEOUT);

    const response = await fetch(profileUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);
    const elapsed = Date.now() - startTime;

    if (site.checkType === "status_code") {
      return {
        ...base,
        status: response.status >= 200 && response.status < 400 ? "found" : "not_found",
        responseTime: elapsed,
      };
    }

    if (site.checkType === "response_url") {
      const finalUrl = response.url;
      const isRedirected =
        !finalUrl.toLowerCase().includes(username.toLowerCase());
      return {
        ...base,
        status: isRedirected ? "not_found" : "found",
        responseTime: elapsed,
      };
    }

    if (site.checkType === "message") {
      const body = await response.text();
      if (site.absenceStrs.length > 0) {
        const absent = site.absenceStrs.some((s) => body.includes(s));
        if (absent) {
          return { ...base, status: "not_found", responseTime: elapsed };
        }
      }
      if (site.presenseStrs.length > 0) {
        const present = site.presenseStrs.some((s) => body.includes(s));
        return {
          ...base,
          status: present ? "found" : "not_found",
          responseTime: elapsed,
        };
      }
      return {
        ...base,
        status: response.status >= 200 && response.status < 400 ? "found" : "not_found",
        responseTime: elapsed,
      };
    }

    if (site.checkType.startsWith("engine_")) {
      if (response.status === 200) {
        const body = await response.text();
        const usernameInPage = body.toLowerCase().includes(username.toLowerCase());
        const is404Page = body.includes("404") || body.includes("not found") || body.includes("does not exist");
        return {
          ...base,
          status: usernameInPage && !is404Page ? "found" : "not_found",
          responseTime: elapsed,
        };
      }
      return { ...base, status: "not_found", responseTime: elapsed };
    }

    return {
      ...base,
      status: response.status >= 200 && response.status < 400 ? "found" : "not_found",
      responseTime: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      ...base,
      status: err?.name === "AbortError" ? "timeout" : "error",
      responseTime: Date.now() - startTime,
    };
  }
}

export async function* probeUsername(
  username: string,
  sites: MaigretSite[],
  onProgress?: (checked: number, total: number) => void
): AsyncGenerator<ProbeResult> {
  let checked = 0;
  const total = sites.length;
  let activePromises: Promise<ProbeResult>[] = [];
  let siteIndex = 0;

  const resolveOne = async (): Promise<ProbeResult> => {
    const result = await Promise.race(activePromises);
    activePromises = activePromises.filter((p) => p !== (result as any));
    return result;
  };

  while (siteIndex < sites.length || activePromises.length > 0) {
    while (activePromises.length < CONCURRENCY && siteIndex < sites.length) {
      const site = sites[siteIndex++];
      const promise = probeSite(site, username);
      (promise as any).__resolved = false;
      promise.then((r) => {
        (promise as any).__resolved = true;
        return r;
      });
      activePromises.push(promise);
    }

    if (activePromises.length > 0) {
      const result = await Promise.race(activePromises);
      activePromises.splice(
        activePromises.findIndex(
          (p) =>
            (p as any).__resolved ||
            p === Promise.resolve(result).then(() => result)
        ),
        1
      );
      checked++;
      if (onProgress) onProgress(checked, total);
      yield result;
    }
  }
}

export async function runProbe(
  username: string,
  sites: MaigretSite[]
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const total = sites.length;
  let completed = 0;

  const batches: MaigretSite[][] = [];
  for (let i = 0; i < sites.length; i += CONCURRENCY) {
    batches.push(sites.slice(i, i + CONCURRENCY));
  }

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map((site) => probeSite(site, username))
    );

    for (const result of batchResults) {
      completed++;
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
}
