import type { NsfwPrediction } from "./nsfw-model";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const SENTISIGHT_ENDPOINT = "https://platform.sentisight.ai/api/pm-predict/NSFW-classification/";
const CONFIG_PATH = join(process.cwd(), ".sentisight-config.json");

let sentisightEnabled = false;

function loadPersistedState(): boolean {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return !!data.enabled;
    }
  } catch {}
  return false;
}

function persistState(enabled: boolean) {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify({ enabled }), "utf-8");
  } catch (e) {
    console.warn("Could not persist SentiSight config:", e);
  }
}

sentisightEnabled = loadPersistedState();
if (sentisightEnabled) {
  console.log("SentiSight.ai detection restored from config: enabled");
}

export function isSentisightEnabled(): boolean {
  return sentisightEnabled;
}

export function setSentisightEnabled(enabled: boolean) {
  sentisightEnabled = enabled;
  persistState(enabled);
  console.log(`SentiSight.ai detection ${enabled ? "enabled" : "disabled"}`);
}

export async function classifyWithSentisight(imageBuffer: Buffer): Promise<NsfwPrediction> {
  const apiKey = process.env.SENTISIGHT_API_KEY;
  if (!apiKey) {
    throw new Error("SENTISIGHT_API_KEY not configured");
  }

  const response = await fetch(SENTISIGHT_ENDPOINT, {
    method: "POST",
    headers: {
      "X-Auth-token": apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`SentiSight API error (${response.status}): ${text}`);
  }

  let result: any;
  const responseText = await response.text();
  try {
    result = JSON.parse(responseText);
  } catch {
    console.error("SentiSight returned non-JSON response:", responseText.substring(0, 200));
    throw new Error("SentiSight returned invalid response format");
  }

  console.log("SentiSight raw response:", JSON.stringify(result));

  let unsafeScore = 0;
  let safeScore = 0;
  let parsed = false;

  if (Array.isArray(result)) {
    for (const item of result) {
      const label = (item.label || item.className || "").toLowerCase();
      const score = item.score ?? item.probability ?? item.confidence ?? 0;
      if (label.includes("unsafe") || label.includes("nsfw") || label.includes("porn") || label.includes("hentai") || label.includes("sexy")) {
        unsafeScore = Math.max(unsafeScore, score);
        parsed = true;
      } else if (label.includes("safe") || label.includes("sfw") || label.includes("neutral") || label.includes("drawing")) {
        safeScore = Math.max(safeScore, score);
        parsed = true;
      }
    }
  } else if (typeof result === "object" && result !== null) {
    for (const [key, val] of Object.entries(result)) {
      const k = key.toLowerCase();
      const v = typeof val === "number" ? val : 0;
      if (k.includes("unsafe") || k.includes("nsfw")) {
        unsafeScore = Math.max(unsafeScore, v);
        parsed = true;
      } else if (k.includes("safe") || k.includes("sfw")) {
        safeScore = Math.max(safeScore, v);
        parsed = true;
      }
    }
  }

  if (!parsed) {
    console.warn("SentiSight response format unrecognized, falling back to safe:", JSON.stringify(result).substring(0, 200));
  }

  const isNsfw = unsafeScore > safeScore && unsafeScore >= 0.3;

  let flagCategory: string | null = null;
  if (isNsfw) {
    if (unsafeScore >= 0.8) flagCategory = "explicit";
    else if (unsafeScore >= 0.5) flagCategory = "adult";
    else flagCategory = "suggestive";
  }

  console.log(`SentiSight result: safe=${(safeScore * 100).toFixed(1)}%, unsafe=${(unsafeScore * 100).toFixed(1)}%, flagged=${isNsfw}, category=${flagCategory || "none"}`);

  return {
    isNsfw,
    confidence: Math.max(unsafeScore, safeScore),
    flagCategory,
    supported: true,
    predictions: [
      { className: "Unsafe", probability: unsafeScore },
      { className: "Safe", probability: safeScore },
    ],
  };
}

export async function checkSentisightAvailability(): Promise<boolean> {
  const apiKey = process.env.SENTISIGHT_API_KEY;
  return !!apiKey && apiKey.length > 0;
}
