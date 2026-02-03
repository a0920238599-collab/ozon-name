
import { ProductInput, ProductResult } from "../types";

/**
 * 延迟函数
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const processProductsWithDeepSeek = async (
  products: ProductInput[],
  apiKey: string
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

    输出格式必须是纯 JSON 数组，每个对象包含：sku, russianName, russianDescription, backTranslation。不要包含任何 Markdown 代码块包裹。

    待处理产品数据：
    ${products.map(p => `SKU: ${p.sku}, 中文名: ${p.chineseName}`).join('\n')}
  `;

  const makeRequest = async (attempt: number): Promise<any> => {
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "You are a professional e-commerce specialist. Output only valid JSON arrays." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429 && attempt < 3) {
          const waitTime = Math.pow(2, attempt + 1) * 1000;
          await delay(waitTime);
          return makeRequest(attempt + 1);
        }
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let content = data.choices[0].message.content.trim();
      
      // Attempt to find JSON array if wrapped in text
      if (content.includes("[") && content.includes("]")) {
        content = content.substring(content.indexOf("["), content.lastIndexOf("]") + 1);
      }
      
      return JSON.parse(content);
    } catch (error: any) {
      if (attempt < 2) {
        await delay(2000);
        return makeRequest(attempt + 1);
      }
      throw error;
    }
  };

  try {
    const rawResults = await makeRequest(0);
    const results = Array.isArray(rawResults) ? rawResults : (rawResults.products || []);

    return results.map((res: any) => {
      const original = products.find(p => p.sku === res.sku);
      return {
        sku: res.sku,
        chineseName: original?.chineseName || "未知",
        russianName: res.russianName,
        russianDescription: res.russianDescription,
        backTranslation: res.backTranslation
      };
    });
  } catch (error: any) {
    console.error("DeepSeek API Error:", error);
    throw new Error(`DeepSeek 处理失败: ${error.message}`);
  }
};
