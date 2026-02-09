import { createRequire } from "module";
const require = createRequire(import.meta.url);

const tf = require("@tensorflow/tfjs-node");
const nsfw = require("nsfwjs");

let model: any = null;
let modelPromise: Promise<any> | null = null;

const MODEL_LOAD_TIMEOUT = 60000;

export async function loadModel(): Promise<any> {
  if (model) return model;

  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        tf.enableProdMode();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Model load timed out after 60s")), MODEL_LOAD_TIMEOUT)
        );
        model = await Promise.race([
          nsfw.load("MobileNetV2Mid", { size: 224 }),
          timeoutPromise,
        ]);
        console.log("NSFW detection model loaded successfully");
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

export async function classifyImage(
  imageBuffer: Buffer,
  confidenceThreshold: number = 0.3
): Promise<NsfwPrediction> {
  const nsfwModel = await loadModel();

  let imageTensor: any = null;
  try {
    imageTensor = tf.node.decodeImage(imageBuffer, 3);

    const predictions = await nsfwModel.classify(imageTensor);

    console.log("NSFW predictions:", predictions.map((p: any) => `${p.className}: ${(p.probability * 100).toFixed(1)}%`).join(", "));

    const nsfwCategories = ["Porn", "Hentai", "Sexy"];
    const nsfwPredictions = predictions.filter((p: any) =>
      nsfwCategories.includes(p.className)
    );

    const combinedNsfwScore = nsfwPredictions.reduce(
      (sum: number, p: any) => sum + p.probability, 0
    );

    const highestNsfw = nsfwPredictions.reduce(
      (max: any, p: any) => (p.probability > max.probability ? p : max),
      { className: "Neutral", probability: 0 }
    );

    const isNsfw = combinedNsfwScore >= confidenceThreshold;
    const flagCategory = isNsfw ? mapToFlagCategory(highestNsfw.className) : null;
    const confidence = Math.max(combinedNsfwScore, highestNsfw.probability);

    console.log(`Combined NSFW score: ${(combinedNsfwScore * 100).toFixed(1)}%, threshold: ${(confidenceThreshold * 100).toFixed(1)}%, flagged: ${isNsfw}`);

    return {
      isNsfw,
      confidence,
      flagCategory,
      supported: true,
      predictions: predictions.map((p: any) => ({
        className: p.className,
        probability: p.probability,
      })),
    };
  } finally {
    if (imageTensor) {
      imageTensor.dispose();
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
