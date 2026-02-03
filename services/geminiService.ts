
import { GoogleGenAI, Type } from "@google/genai";
import { ProductInput, ProductResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      sku: { type: Type.STRING },
      russianName: { type: Type.STRING, description: 'Optimized Russian name for Ozon' },
      russianDescription: { type: Type.STRING, description: 'Short product description in Russian' },
      backTranslation: { type: Type.STRING, description: 'Chinese translation of the Russian name' },
    },
    required: ["sku", "russianName", "russianDescription", "backTranslation"],
  },
};

/**
 * 延迟函数
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 带重试逻辑的生成函数
 */
async function generateWithRetry(prompt: string, maxRetries = 3): Promise<any> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });
      return JSON.parse(response.text.trim());
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error.message?.includes('429') || error.status === 429;
      
      if (isRateLimit && attempt < maxRetries - 1) {
        // 指数退避：第一次重试等待 2s, 第二次 4s, 第三次 8s...
        const waitTime = Math.pow(2, attempt + 1) * 1000;
        console.warn(`检测到 API 频率限制 (429)，将在 ${waitTime}ms 后进行第 ${attempt + 1} 次重试...`);
        await delay(waitTime);
        continue;
      }
      
      // 如果不是频率限制错误，或者已达到最大重试次数，则抛出
      throw error;
    }
  }
  throw lastError;
}

export const processProductsBatch = async (
  products: ProductInput[]
): Promise<ProductResult[]> => {
  const prompt = `
    你是一位专业的跨境电商运营专家，精通俄语和 Ozon 平台的 SEO 优化。
    
    任务：
    1. 接收产品列表（SKU 和 中文名）。
    2. 为每个产品生成一个符合 Ozon 命名规则的俄文名称。
       规则：[品类名称] + [品牌(若无则省略)] + [型号] + [关键属性(如颜色、尺寸、材质)]。
       要求：
       - 禁止使用“最便宜”、“最好”、“促销”等词汇。
       - **特别注意：生成的俄文名称中绝对不要包含 SKU 编号信息。**
       - 确保名称符合俄罗斯消费者的搜索习惯（SEO）。
    3. 为每个产品写一段俄文产品简介（100字左右），强调卖点、功能和使用场景。
    4. 将生成的俄文名称翻译回中文。

    待处理产品数据：
    ${products.map(p => `SKU: ${p.sku}, 中文名: ${p.chineseName}`).join('\n')}
  `;

  try {
    const results = await generateWithRetry(prompt);
    
    // Map back to include original Chinese name
    return results.map((res: any) => {
      const original = products.find(p => p.sku === res.sku);
      return {
        ...res,
        chineseName: original?.chineseName || "未知",
      };
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("API 额度可能不足或连接超时。建议减小单次处理量或稍后再试。");
  }
};
