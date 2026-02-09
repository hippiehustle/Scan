import { createRequire } from "module";
const require = createRequire(import.meta.url);

const tf = require("@tensorflow/tfjs-node");
const nsfw = require("nsfwjs");

let model: any = null;
let modelPromise: Promise<any> | null = null;

const MODEL_LOAD_TIMEOUT = 90000;
const MODEL_NAME = "InceptionV3";
const MODEL_INPUT_SIZE = 299;

export async function loadModel(): Promise<any> {
  if (model) return model;

  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        tf.enableProdMode();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Model load timed out after 90s")), MODEL_LOAD_TIMEOUT)
        );
        model = await Promise.race([
          nsfw.load(MODEL_NAME, { size: MODEL_INPUT_SIZE }),
          timeoutPromise,
        ]);
        console.log(`NSFW detection model (${MODEL_NAME}) loaded successfully`);
        return model;
      } catch (error) {
        modelPromise = null;
        console.error("Failed to load NSFW model:", error);
        throw error;
      }
    })();
  }

  return modelPromise;
}

export interface NsfwPrediction {
  isNsfw: boolean;
  confidence: number;
  flagCategory: string | null;
  supported: boolean;
  predictions: { className: string; probability: number }[];
}

function mapToFlagCategory(className: string): string | null {
  switch (className) {
    case "Porn":
      return "explicit";
    case "Hentai":
      return "adult";
    case "Sexy":
      return "suggestive";
    case "Drawing":
    case "Neutral":
      return null;
    default:
      return null;
  }
}

function getCategoryWeight(className: string): number {
  switch (className) {
    case "Porn":
      return 1.0;
    case "Hentai":
      return 0.9;
    case "Sexy":
      return 0.7;
    default:
      return 0;
  }
}

async function classifySingleTensor(
  nsfwModel: any,
  tensor: any
): Promise<{ className: string; probability: number }[]> {
  const predictions = await nsfwModel.classify(tensor);
  return predictions.map((p: any) => ({
    className: p.className,
    probability: p.probability,
  }));
}

function computeNsfwScore(predictions: { className: string; probability: number }[]): {
  isNsfw: boolean;
  confidence: number;
  highestCategory: string;
  combinedScore: number;
  weightedScore: number;
} {
  const nsfwCategories = ["Porn", "Hentai", "Sexy"];
  const nsfwPredictions = predictions.filter((p) =>
    nsfwCategories.includes(p.className)
  );

  const combinedScore = nsfwPredictions.reduce(
    (sum, p) => sum + p.probability, 0
  );

  const weightedScore = nsfwPredictions.reduce(
    (sum, p) => sum + p.probability * getCategoryWeight(p.className), 0
  );

  const highestNsfw = nsfwPredictions.reduce(
    (max, p) => (p.probability > max.probability ? p : max),
    { className: "Neutral", probability: 0 }
  );

  const pornScore = predictions.find(p => p.className === "Porn")?.probability || 0;
  const hentaiScore = predictions.find(p => p.className === "Hentai")?.probability || 0;
  const sexyScore = predictions.find(p => p.className === "Sexy")?.probability || 0;

  const isNsfw =
    pornScore >= 0.15 ||
    hentaiScore >= 0.15 ||
    sexyScore >= 0.25 ||
    combinedScore >= 0.30 ||
    weightedScore >= 0.20;

  return {
    isNsfw,
    confidence: Math.max(combinedScore, highestNsfw.probability),
    highestCategory: highestNsfw.className,
    combinedScore,
    weightedScore,
  };
}

function cropTensor(tensor: any, region: "center" | "top" | "bottom" | "left" | "right"): any {
  const [height, width] = tensor.shape;
  const cropH = Math.floor(height * 0.7);
  const cropW = Math.floor(width * 0.7);

  let startY = 0, startX = 0;

  switch (region) {
    case "center":
      startY = Math.floor((height - cropH) / 2);
      startX = Math.floor((width - cropW) / 2);
      break;
    case "top":
      startY = 0;
      startX = Math.floor((width - cropW) / 2);
      break;
    case "bottom":
      startY = height - cropH;
      startX = Math.floor((width - cropW) / 2);
      break;
    case "left":
      startY = Math.floor((height - cropH) / 2);
      startX = 0;
      break;
    case "right":
      startY = Math.floor((height - cropH) / 2);
      startX = width - cropW;
      break;
  }

  return tensor.slice([startY, startX, 0], [cropH, cropW, 3]);
}

export async function classifyImage(
  imageBuffer: Buffer,
  confidenceThreshold: number = 0.3
): Promise<NsfwPrediction> {
  const nsfwModel = await loadModel();

  const tensorsToDispose: any[] = [];
  try {
    const imageTensor = tf.node.decodeImage(imageBuffer, 3);
    tensorsToDispose.push(imageTensor);

    const fullPredictions = await classifySingleTensor(nsfwModel, imageTensor);
    const fullScore = computeNsfwScore(fullPredictions);

    console.log("Full image predictions:", fullPredictions.map(p => `${p.className}: ${(p.probability * 100).toFixed(1)}%`).join(", "));

    let bestScore = fullScore;
    let bestPredictions = fullPredictions;

    if (!fullScore.isNsfw || fullScore.confidence < 0.5) {
      const [height, width] = imageTensor.shape;

      if (height > 100 && width > 100) {
        const regions: ("center" | "top" | "bottom")[] = ["center", "top", "bottom"];

        for (const region of regions) {
          try {
            const cropped = cropTensor(imageTensor, region);
            tensorsToDispose.push(cropped);

            const cropPredictions = await classifySingleTensor(nsfwModel, cropped);
            const cropScore = computeNsfwScore(cropPredictions);

            console.log(`${region} crop predictions:`, cropPredictions.map(p => `${p.className}: ${(p.probability * 100).toFixed(1)}%`).join(", "));

            if (cropScore.weightedScore > bestScore.weightedScore) {
              bestScore = cropScore;
              bestPredictions = cropPredictions;
            }

            if (bestScore.isNsfw && bestScore.confidence >= 0.5) break;
          } catch (cropError) {
            console.warn(`Failed to analyze ${region} crop, skipping`);
          }
        }
      }
    }

    const isNsfw = bestScore.isNsfw;
    const flagCategory = isNsfw ? mapToFlagCategory(bestScore.highestCategory) : null;

    console.log(`Final result: combined=${(bestScore.combinedScore * 100).toFixed(1)}%, weighted=${(bestScore.weightedScore * 100).toFixed(1)}%, flagged=${isNsfw}, category=${flagCategory || "none"}`);

    return {
      isNsfw,
      confidence: bestScore.confidence,
      flagCategory,
      supported: true,
      predictions: bestPredictions,
    };
  } finally {
    for (const tensor of tensorsToDispose) {
      try {
        tensor.dispose();
      } catch {}
    }
  }
}

export function isImageFile(mimetype: string): boolean {
  const supported = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/webp",
  ];
  return supported.includes(mimetype);
}

export function getUnsupportedResult(): NsfwPrediction {
  return {
    isNsfw: false,
    confidence: 0,
    flagCategory: null,
    supported: false,
    predictions: [],
  };
}
