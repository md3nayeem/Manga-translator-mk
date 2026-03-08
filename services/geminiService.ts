
import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from "../types";

const NATURAL_BANGLA_PROMPT = `
## 🎯 CORE PRINCIPLE: SPEAK LIKE A REAL BENGALI PERSON
Your translations must sound like how friends talk to each other in Dhaka, Chittagong, or Kolkata - NOT like a textbook or formal essay.

## ✅ NATURAL BENGALI RULES:
1. USE COMMON LOAN WORDS: Use everyday words like friend/দোস্ত, boss/বস, cool/কুল, game/গেম, party/পার্টি, phone/ফোন, sorry/সরি, thanks/থ্যাংকস, OK/ওকে, serious/সিরিয়াস, tension/টেনশন, problem/প্রবলেম, chance/চান্স, time/টাইম, style/স্টাইল, yaar/ইয়ার, acha/আচ্ছা, sahi/সাহি, bilkul/বিলকুল, mushkil/মুশকিল.

2. CHARACTER PERSONALITY-BASED:
- Teenage Boy: Energetic, casual. Use: "ওয়াও!", "চল যাই!", "ইয়েস!", "ধুর!", "শালা!", দোস্ত, ইয়ার, ব্রো.
- Teenage Girl: Emotional, expressive. Use: "সিরিয়াসলি?", "ওহ মাই গড!", "কিউট!", আরে, ওহ, বাহ.
- Adult Male: Serious, direct. Use: "শোনো...", "বুঝলে?", "টেনশন নিও না".
- Adult Female: Mature, caring. Use: "তুমি ঠিক আছো?", "সাবধান", "আমি চিন্তিত".
- Villain/Tough: Harsh, cutting. Use: "মর!", "বোকা!", "চুপ কর!", "জঘন্য!".

3. SITUATIONAL:
- Combat: "নে এটা!", "সাবধান!", "আক্রমণ কর!". SFX: ধুম!, ঘুষ!, ছ্যাঁচ!.
- Emotional: "সরি/মাফ করো", "আমি তোমায় ভালোবাসি", "ছেড়ে যেও না".
- Comedy: "হাহা!", "ফানি", "বোকা!", "উপস!".
- Surprise: "কী?!", "অসম্ভব!", "সিরিয়াস নাকি?".

4. ADULT CONTENT (18+): Translate naturally without censoring. Use direct terms: সেক্স, চুমু/কিস, পাছা, হস্তমৈথুন, অর্গাজম, উত্তেজিত, বীর্য/মাল. Use asterisks (*) for extremely vulgar words (e.g., ল*ণ্ড, চ*দা).

5. GRAMMAR: Use Spoken Bengali (যাচ্ছি, করছো, আসবে) instead of Formal (যাইতেছি, করিতেছ, আসিবে). Use "তুই" for close friends, "তুমি" for casual, "আপনি" for formal.

6. PRESERVE JAPANESE: Keep names (Naruto/নারুতো), Jutsus (Rasengan/রাসেনগান), and honorifics (-san, -kun, -chan).

7. SFX: Translate to Bengali equivalents (ধুম!, ঘুষ!, কাঁই!, ধুক ধুক, ছ্যাঁচ!) or keep original if no equivalent.

8. STRICT "DO NOT USE": Never use archaic words like সমীপে, করিতেছি, যাইতেছি, গমন করা, ভোজন করা, ক্ষমাপ্রার্থী, অভিনন্দন, আলিঙ্গন, চুম্বন.
`;

const SYSTEM_INSTRUCTION = `
You are a professional Japanese to Bengali Manga Translator and Typesetter specializing in NATURAL, NATIVE Bengali.
Task:
1. Detect ALL text bubbles, narration boxes, and SFX.
2. Provide bounding boxes in PERCENTAGE (0-100).
3. Translate to natural, colloquial Bengali following the provided rules.
4. SHAPE RULES: Dialogue=oval, Narration=rectangular, Thought=cloud, SFX=none.
5. Return a JSON object with 'detectedTexts' array.
`;

export async function processMangaPage(base64Image: string, retryCount = 0): Promise<TranslationResult> {
  const MAX_RETRIES = 2;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: "Analyze this manga page. Detect every text area. Return the coordinates as percentages (0-100) relative to the image width and height. For each area, provide the original text, the Bengali translation, the type (dialogue, thought, sfx, narration), and the shape (oval, rectangular, cloud, none)." },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image,
            },
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + "\n\n" + NATURAL_BANGLA_PROMPT,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 2000 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedTexts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  originalText: { type: Type.STRING },
                  translatedText: { type: Type.STRING },
                  position: {
                    type: Type.OBJECT,
                    properties: {
                      left: { type: Type.NUMBER },
                      top: { type: Type.NUMBER },
                      width: { type: Type.NUMBER },
                      height: { type: Type.NUMBER },
                    },
                    required: ["left", "top", "width", "height"],
                  },
                  type: { type: Type.STRING, description: "One of: dialogue, thought, sfx, narration" },
                  shape: { type: Type.STRING, description: "One of: oval, rectangular, cloud, none" },
                  confidence: { type: Type.NUMBER, description: "Confidence score from 0 to 1" },
                },
                required: ["id", "originalText", "translatedText", "position", "type", "shape", "confidence"],
              },
            },
          },
          required: ["detectedTexts"],
        },
      },
    });

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error("দুঃখিত, এই ছবিটি এআই-এর সেফটি ফিল্টারে আটকে গেছে। দয়া করে অন্য কোনো ছবি চেষ্টা করুন।");
    }

    const text = response.text;
    if (!text) throw new Error("এআই থেকে কোনো উত্তর পাওয়া যায়নি। (Empty response)");

    let cleanJson = text.trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    
    let rawData;
    try {
      rawData = JSON.parse(cleanJson);
    } catch (e) {
      throw new Error("এআই থেকে আসা তথ্যগুলো সঠিক ফরম্যাটে নেই। (JSON parse error)");
    }

    if (!rawData.detectedTexts || !Array.isArray(rawData.detectedTexts)) {
      throw new Error("এআই কোনো টেক্সট শনাক্ত করতে পারেনি। (Invalid structure)");
    }

    if (rawData.detectedTexts.length === 0) {
      throw new Error("এই পাতায় কোনো টেক্সট খুঁজে পাওয়া যায়নি। দয়া করে অন্য কোনো ছবি চেষ্টা করুন।");
    }
    
    // Force cleaning layer defaults and ensure coordinates are valid
    rawData.detectedTexts = rawData.detectedTexts.map((block: any) => {
      const pos = block.position || { left: 0, top: 0, width: 0, height: 0 };
      
      // Ensure we have numbers
      let left = Number(pos.left) || 0;
      let top = Number(pos.top) || 0;
      let width = Number(pos.width) || 5;
      let height = Number(pos.height) || 5;

      // Heuristic to detect coordinate system and normalize to 0-100
      const values = [left, top, width, height];
      const maxVal = Math.max(...values);
      
      if (maxVal > 100) {
        // Likely 0-1000 scale (common for some models)
        left /= 10;
        top /= 10;
        width /= 10;
        height /= 10;
      } else if (maxVal > 0 && maxVal <= 1.1) {
        // Likely 0-1 scale
        left *= 100;
        top *= 100;
        width *= 100;
        height *= 100;
      }

      // Clamp to 0-100 range to ensure they stay on image
      left = Math.min(Math.max(0, left), 98);
      top = Math.min(Math.max(0, top), 98);
      width = Math.min(Math.max(2, width), 100 - left);
      height = Math.min(Math.max(2, height), 100 - top);

      let forcedShape = block.shape;
      if (block.type !== 'sfx' && (!forcedShape || forcedShape === 'none')) {
        forcedShape = 'rectangular';
      }
      
      return {
        id: block.id || Math.random().toString(36).substr(2, 9),
        originalText: block.originalText || "",
        translatedText: block.translatedText || "",
        type: block.type || "dialogue",
        confidence: block.confidence || 0.5,
        position: { left, top, width, height },
        shape: forcedShape,
        visible: true,
        style: {
          fontSize: block.type === 'sfx' ? 24 : 20,
          fontFamily: 'Noto Sans Bengali',
          fill: '#000000',
          backgroundColor: '#ffffff',
          fontWeight: '700',
          textAlign: 'center',
          bold: true
        }
      };
    });

    return rawData as TranslationResult;
  } catch (error: any) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 2000));
      return processMangaPage(base64Image, retryCount + 1);
    }
    throw error;
  }
}
