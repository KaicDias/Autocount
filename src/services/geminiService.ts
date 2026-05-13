import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface DetectionResult {
  count: number;
  items: string[];
  summary: string;
}

export async function analyzeInventoryMedia(base64Data: string, mimeType: string): Promise<DetectionResult> {
  const model = "gemini-3-flash-preview";
  
  const isVideo = mimeType.startsWith("video/");
  const prompt = isVideo 
    ? `Analyze this video of an industrial rack or shelf. 
       Observe the items throughout the video.
       1. Detect all individual items/boxes shown.
       2. Count the maximum number of items visible at once or the total unique items if they move.
       3. Identify the type of items.
       
       Return the result in JSON format with the following structure:
       {
         "count": number,
         "items": string[],
         "summary": "A brief technical summary of the video detection"
       }`
    : `Analyze this image of an industrial rack or shelf. 
       Perform the following steps:
       1. Detect all individual items/boxes.
       2. Count them accurately.
       3. Identify the type of items if possible.
       
       Return the result in JSON format with the following structure:
       {
         "count": number,
         "items": string[],
         "summary": "A brief technical summary of the detection"
       }`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data.split(",")[1]
            }
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          count: { type: Type.NUMBER },
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING }
        },
        required: ["count", "items", "summary"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as DetectionResult;
}
