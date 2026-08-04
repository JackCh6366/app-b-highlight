import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 尚未設定，請在環境變數配置 API Key。');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getNvidiaClient() {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY 尚未設定，請在環境變數配置 NVIDIA_API_KEY。');
  }
  return new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey,
    timeout: 25000,
    maxRetries: 0,
  });
}

/**
 * 偵測 AI 回傳內容是否陷入重複性迴圈 (Degenerate Repetition Loop)。
 * 本函式是為了防止中小型模型在生成結構化 JSON 時，因為沒有懲罰機制而反覆輸出無意義的相同詞彙。
 * 
 * 偵測邏輯：
 * 1. 使用正規表示式將文字切分成 token（支援英文單字與中文單字/字元）。
 * 2. 計算連續 5 個 token 的 5-gram 出現頻率。
 * 3. 若某個 5-gram 的出現頻率佔整體 tokens 的比例過高（例如大於 5% 且出現次數大於 8 次），判定為重複。
 * 4. 同時檢查 3-gram 的連續重複，若同一個 3-gram 連續重複出現 6 次以上，判定為重複。
 */
export function detectRepetitionLoop(text: string): boolean {
  if (!text || text.length < 150) return false;

  const tokens = text.match(/[\u4e00-\u9fa5]|[a-zA-Z0-9']+/g) || [];
  if (tokens.length < 50) return false;

  const tokensLower = tokens.map(t => t.toLowerCase());

  // 1. 檢查 n-gram (n=5) 的重複率
  const n = 5;
  const counts: Record<string, number> = {};
  for (let i = 0; i <= tokensLower.length - n; i++) {
    const gram = tokensLower.slice(i, i + n).join(' ');
    counts[gram] = (counts[gram] || 0) + 1;
  }

  // 門檻：佔總 token 的 5%，且至少出現 8 次
  const thresholdCount = Math.max(8, tokensLower.length * 0.05);
  for (const gram in counts) {
    if (counts[gram] > thresholdCount) {
      return true;
    }
  }

  // 2. 檢查 3-gram 的連續重複 (例如 "Blueprint Architecture Matrix Blueprint Architecture Matrix ...")
  const m = 3;
  let consecutiveCount = 0;
  let lastGram = '';
  for (let i = 0; i <= tokensLower.length - m; i += m) {
    const gram = tokensLower.slice(i, i + m).join(' ');
    if (gram === lastGram) {
      consecutiveCount++;
      if (consecutiveCount >= 6) {
        return true;
      }
    } else {
      lastGram = gram;
      consecutiveCount = 1;
    }
  }

  return false;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Process chunks in parallel batches to reduce total execution time
async function processInParallelBatches<T>(items: T[], batchSize: number, fn: (item: T, index: number) => Promise<string>): Promise<string[]> {
  const results: string[] = new Array(items.length);
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, batchIdx) => fn(item, i + batchIdx))
    );
    batchResults.forEach((r, batchIdx) => {
      results[i + batchIdx] = r;
    });
    // Small delay between batches to respect rate limits
    if (i + batchSize < items.length) {
      await delay(200);
    }
  }
  return results;
}

function chunkText(rawText: string, maxChunkLength = 15000): string[] {
  if (!rawText || rawText.length <= maxChunkLength) return [rawText];

  const chunks: string[] = [];
  const sections = rawText.split(/(?=\n#{1,3}\s|\n第[0-9一二三四五六七八九十]+[章節])/g);

  let currentChunk = '';
  for (const sec of sections) {
    if ((currentChunk + sec).length > maxChunkLength && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = sec;
    } else {
      currentChunk += sec;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChunkLength) {
      finalChunks.push(chunk);
    } else {
      for (let i = 0; i < chunk.length; i += maxChunkLength) {
        finalChunks.push(chunk.slice(i, i + maxChunkLength));
      }
    }
  }

  return finalChunks;
}

/**
 * 【搶救機制/最後防線】：
 * 當 AI 產生的 JSON 字串因長度上限或錯誤被截斷時，此函式會嘗試清除無效結尾、補齊未閉合的括號。
 * 請注意：此為最後防線搶救機制，在正常流程中，若偵測到重複性迴圈，應優先透過 API 重複性偵測與重試機制排除，避免走到這一步。
 */
function safeParseJSON(jsonString: string): any {
  if (!jsonString) return {};

  let cleaned = jsonString.trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  const firstBrace = cleaned.search(/[\{\[]/);
  if (firstBrace > 0) {
    cleaned = cleaned.substring(firstBrace);
  }

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    try {
      const sanitized = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
        if (c === '\n') return '\\n';
        if (c === '\r') return '\\r';
        if (c === '\t') return '\\t';
        return '';
      });
      return JSON.parse(sanitized);
    } catch (_) {}
  }

  let repaired = cleaned;
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      isEscaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        if (stack.length > 0) stack.pop();
      }
    }
  }

  if (inString) {
    repaired += '"';
  }

  repaired = repaired.replace(/,\s*$/, '');

  while (stack.length > 0) {
    const openChar = stack.pop();
    if (openChar === '{') repaired += '}';
    else if (openChar === '[') repaired += ']';
  }

  try {
    return JSON.parse(repaired);
  } catch (repairErr) {
    let cutPos = repaired.length;
    while (cutPos > 50) {
      cutPos = Math.max(
        repaired.lastIndexOf(',', cutPos - 1),
        repaired.lastIndexOf('{', cutPos - 1),
        repaired.lastIndexOf('[', cutPos - 1)
      );
      if (cutPos <= 0) break;

      let sub = repaired.substring(0, cutPos);
      sub = sub.replace(/,\s*$/, '');

      let subInStr = false;
      let subEsc = false;
      const subStack: string[] = [];
      for (let i = 0; i < sub.length; i++) {
        const c = sub[i];
        if (subEsc) {
          subEsc = false;
          continue;
        }
        if (c === '\\' && subInStr) {
          subEsc = true;
          continue;
        }
        if (c === '"') {
          subInStr = !subInStr;
          continue;
        }
        if (!subInStr) {
          if (c === '{' || c === '[') subStack.push(c);
          else if (c === '}' || c === ']') {
            if (subStack.length > 0) subStack.pop();
          }
        }
      }
      if (subInStr) sub += '"';
      sub = sub.replace(/,\s*$/, '');
      while (subStack.length > 0) {
        const topChar = subStack.pop();
        if (topChar === '{') sub += '}';
        else if (topChar === '[') sub += ']';
      }

      try {
        return JSON.parse(sub);
      } catch (_) {}
    }
    throw new Error('無法解析 AI 回傳之 JSON 內容，請檢查輸入文件長度。');
  }
}

function sanitizeMindMap(node: any, path: string = '0'): any {
  if (!node || typeof node !== 'object') {
    return { id: path, label: String(node || '核心主題'), children: [] };
  }

  const sanitizedNode: any = {
    id: path,
    label: typeof node.label === 'string' && node.label.trim() ? node.label.trim() : '主要概念',
  };

  if (Array.isArray(node.children) && node.children.length > 0) {
    sanitizedNode.children = node.children.map((child: any, idx: number) =>
      sanitizeMindMap(child, `${path}-${idx}`)
    );
  }

  return sanitizedNode;
}

function buildSystemInstruction(options: any) {
  const modePrompts: Record<string, string> = {
    comprehensive: '綜合全方位總結：提供高品質、條理極其分明且極盡詳細的全篇總覽、關鍵發現、章節拆解與大綱、重點術語及測驗點。',
    concise: '極簡核心要點：快速提取精華，去蕪存菁，以精鍊列點呈現最高價值的內容。',
    academic: '學術論文與深度研究模式：著重於研究背景、問題意識、方法論、關鍵數據與實驗結果、結論與未來展望，條列詳細，專業嚴謹。',
    exam_prep: '考試複習與學習備考模式：強調關鍵考點、核心定義、記憶口訣與練習問答題（Flashcards），條列詳細，專為學生與備考者設計。',
    business: '商業與決策簡報模式：強調執行摘要 (Executive Summary)、SWOT 分析/關鍵決策點、行動建議 (Action Items) 與商業影響，條列清晰完整。',
    quick_reading: '高效快速閱讀模式：快速理解文章大意、脈絡架構與重點金句。',
  };

  const targetLang = options?.language || '繁體中文';
  const targetLength = options?.length || 'detailed';
  const modeDesc = modePrompts[options?.mode] || modePrompts.comprehensive;
  const customInstruction = options?.customPrompt ? `【使用者額外自訂要求】：${options.customPrompt}` : '';

  return `你是一位世界級的高級研究員、學術學者與學習效率專家。你的任務是將使用者提供的文件（PDF、Word 或文章）進行極致深度閱讀、全面解析與結構化歸納。

【總結模式方針】：${modeDesc}
【目標輸出語言】：必須全程使用【${targetLang}】輸出內容，語句流暢專業，專有名詞可附帶英文原名。
【摘要深度要求】：${targetLength}（請盡可能詳細且深入，條列式列表要發揮豐富詳實的說明內容，切勿過度簡略，盡量涵蓋文中所有重要數據、推論、技術細節與論點）。
【嚴格輸出規範】：請嚴格遵守以下輸出規範與結構，保持精確嚴謹，避免發散內容。
${customInstruction}

【詳細輸出指導原則】：
1. documentTitle: 為這份文件起一個清晰精準且具學術/專業質感的中文主題名稱。
2. executiveSummary: 2-4 段極其完整、高濃縮且通順的執行摘要/核心總覽。
3. mindmap: 建立完整多層級的樹狀心智圖結構 (Root Node -> Level 1 主主題 -> Level 2 子主題 -> Level 3 關鍵點)，層級豐富，視覺化理解全篇脈絡。
4. keyTakeaways: 條列 6-10 個極其詳細的核心關鍵重點與洞察。每點為一個物件，包含 title (小標題) 與 points (3-5 點深入的條列式推論/說明，包含因果關係、數據、研究結果等)。
5. structuredOutline: 依照文件內容完整結構化拆解所有章節 (Section)。每個章節包含小結 (summary)、3 至 5 點詳細條列要點 (points)，並盡可能填寫 subSections 深入次要細節。
6. keyTerms: 提取文件中 6-10 個核心專有名詞或重要概念，給予專業嚴謹的定義與詳細的出現脈絡/範例。
7. flashcards: 生成 6-8 個關鍵複習問答題 (問題與完整詳細的解答)，協助讀者自我測驗記憶。
8. actionablePoints: 提出 3 至 6 點具體的實踐行動建議、應用場景或進一步延伸研析方向。
9. importantQuotes: 摘錄 3-5 句最具代表性或啟發性的原文/金句與重點文句。
10. suggestedQuestions: 提出 3 個使用者可以進一步追問、延伸思考或研究的學術問題。`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rawText, pdfBase64, isScanned, options, fileName } = req.body || {};

    let provider = options?.aiProvider || options?.provider || 'gemini';
    let selectedModel = options?.aiModel || options?.model;

    if (!selectedModel) {
      if (provider === 'nvidia_nim' || provider === 'nvidia') {
        selectedModel = 'nvidia/nemotron-3-ultra-550b-a55b';
      } else {
        selectedModel = 'gemini-3.6-flash';
      }
    }

    if (provider === 'nvidia_nim') provider = 'nvidia';

    let activeText = rawText || '';

    // If rawText is empty, check scanned status and PDF base64 fallback
    if (!activeText || activeText.trim().length === 0) {
      if (pdfBase64 && (provider === 'gemini' || selectedModel.includes('vision') || selectedModel.includes('phi-4-multimodal'))) {
        // Fallback for PDF vision mode when text layer is absent
        if (provider === 'gemini') {
          const ai = getGenAI();
          const cleanPdfBase64 = typeof pdfBase64 === 'string' ? pdfBase64.replace(/^data:[^;]+;base64,/, '') : pdfBase64;
          const systemInstruction = buildSystemInstruction(options);
          const response = await ai.models.generateContent({
            model: selectedModel,
            contents: {
              parts: [
                { inlineData: { mimeType: 'application/pdf', data: cleanPdfBase64 } },
                { text: `請詳細閱讀這份掃描版 PDF 檔案「${fileName || 'PDF文件'}」的內容，並進行長文件整理歸納。` },
              ],
            },
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              maxOutputTokens: 32000,
            },
          });
          const resultText = response.text || '{}';
          let parsedData = safeParseJSON(resultText);
          if (parsedData && parsedData.mindmap) {
            parsedData.mindmap = sanitizeMindMap(parsedData.mindmap, '0');
          }
          return res.status(200).json({ success: true, chunksCount: 1, data: parsedData });
        }
      }

      if (isScanned) {
        return res.status(400).json({
          error: '此檔案為無純文字層之掃描版 PDF，目前選用的 AI 模型不支援視覺分析，請於右側切換至 Gemini 3.6 Flash 或具備視覺能力之模型。',
        });
      }

      return res.status(400).json({
        error: 'PDF 文字擷取失敗，請確認檔案未加密或已損毀。',
      });
    }

    // For NVIDIA: skip Map phase entirely — single call with truncated text to stay within timeout
    // For Gemini: use parallel map-reduce since it's fast enough

    if (provider === 'nvidia') {
      // NVIDIA models are slower; send truncated raw text directly in one call
      const truncatedText = activeText.slice(0, 30000);
      const systemInstruction = buildSystemInstruction(options);
      const nvidia = getNvidiaClient();
      const nvidiaPrompt = `${systemInstruction}

【文件標題/檔名】：${fileName || '長文件'}
【文件原文內容（截取前 30000 字元）】：
${truncatedText}

請根據上述文件內容，彙整生成完整的 JSON 結構化筆記。
請務必以純 JSON 格式回應 (Strict JSON Only)，包含以下結構：
{
  "documentTitle": "...",
  "executiveSummary": "...",
  "mindmap": { "id": "0", "label": "...", "children": [{ "id": "0-0", "label": "...", "children": [] }] },
  "keyTakeaways": [{ "title": "...", "points": ["..."] }],
  "structuredOutline": [{ "section": "...", "summary": "...", "points": ["..."], "subSections": [{ "title": "...", "detail": "..." }] }],
  "keyTerms": [{ "term": "...", "definition": "...", "context": "..." }],
  "flashcards": [{ "question": "...", "answer": "...", "tag": "..." }],
  "actionablePoints": ["..."],
  "importantQuotes": ["..."],
  "suggestedQuestions": ["..."]
}`;

      // 呼叫 NVIDIA NIM API，加入 frequency_penalty 與 presence_penalty 重複懲罰參數以避免 degenerate repetition
      let completion = await nvidia.chat.completions.create({
        model: selectedModel,
        messages: [{ role: 'user', content: nvidiaPrompt }],
        temperature: 0.2,
        max_tokens: 8000,
        frequency_penalty: 0.4, // 懲罰重複 token
        presence_penalty: 0.3,   // 懲罰已出現 token
      });

      let rawOutput = completion.choices[0]?.message?.content || '{}';

      // 檢查是否陷入重複迴圈
      if (detectRepetitionLoop(rawOutput)) {
        console.warn(`[NVIDIA Repetition Detected] Model ${selectedModel} output contains repetition loop. Retrying with lower temperature (0.05) and higher penalty parameters...`);
        
        // 降低溫度 (0.05 < 0.1) 增加確定性，提高懲罰係數進行重試
        completion = await nvidia.chat.completions.create({
          model: selectedModel,
          messages: [{ role: 'user', content: nvidiaPrompt }],
          temperature: 0.05,
          max_tokens: 8000,
          frequency_penalty: 0.6,
          presence_penalty: 0.5,
        });

        rawOutput = completion.choices[0]?.message?.content || '{}';

        // 若重試後依然陷入重複迴圈，直接回傳錯誤提示，避免回傳殘缺/被截斷的 JSON 結果
        if (detectRepetitionLoop(rawOutput)) {
          console.error(`[NVIDIA Repetition Failure] Model ${selectedModel} retry still failed with repetition loop.`);
          return res.status(500).json({
            error: '此模型在生成本文件大綱時發生重複輸出問題，建議切換至 gemini-3.6-flash 或縮短文件內容後重試。',
          });
        }
      }

      let parsedData = safeParseJSON(rawOutput);
      if (parsedData && parsedData.mindmap) {
        parsedData.mindmap = sanitizeMindMap(parsedData.mindmap, '0');
      }
      return res.status(200).json({ success: true, chunksCount: 1, data: parsedData });
    } else {
      // Gemini path: use parallel map-reduce
      const chunks = chunkText(activeText, 15000);
      const maxChunks = 4;
      const effectiveChunks = chunks.length > maxChunks ? chunks.slice(0, maxChunks) : chunks;

      const chunkResults = await processInParallelBatches(effectiveChunks, 4, async (chunk, i) => {
        const mapPrompt = `請簡要分析以下長文件第 ${i + 1} / ${effectiveChunks.length} 段落內容，提取核心概念與重要數據：\n\n${chunk}`;
        const ai = getGenAI();
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: mapPrompt,
          config: {
            maxOutputTokens: 2048,
          },
        });
        return `【段落 ${i + 1} 分析筆記】：\n${response.text || ''}`;
      });

      const combinedNotes = chunkResults.join('\n\n---\n\n');
      const systemInstruction = buildSystemInstruction(options);
      const ai = getGenAI();
      const reduceContent = `【文件標題/檔名】：${fileName || '長文件'}\n\n【長文件全篇分段研析彙整資訊】：\n${combinedNotes}`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          documentTitle: { type: Type.STRING },
          executiveSummary: { type: Type.STRING },
          mindmap: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              children: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    children: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          label: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
              },
            },
            required: ['label'],
          },
          keyTakeaways: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                points: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['title', 'points'],
            },
          },
          structuredOutline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                section: { type: Type.STRING },
                summary: { type: Type.STRING },
                points: { type: Type.ARRAY, items: { type: Type.STRING } },
                subSections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      detail: { type: Type.STRING },
                    },
                  },
                },
              },
              required: ['section', 'summary', 'points'],
            },
          },
          keyTerms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                definition: { type: Type.STRING },
                context: { type: Type.STRING },
              },
              required: ['term', 'definition'],
            },
          },
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
                tag: { type: Type.STRING },
              },
              required: ['question', 'answer'],
            },
          },
          actionablePoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          importantQuotes: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'documentTitle',
          'executiveSummary',
          'mindmap',
          'keyTakeaways',
          'structuredOutline',
          'keyTerms',
          'flashcards',
          'actionablePoints',
          'importantQuotes',
          'suggestedQuestions',
        ],
      };

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: reduceContent,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          maxOutputTokens: 32000,
        },
      });

      const resultText = response.text || '{}';
      let parsedData = safeParseJSON(resultText);
      if (parsedData && parsedData.mindmap) {
        parsedData.mindmap = sanitizeMindMap(parsedData.mindmap, '0');
      }
      return res.status(200).json({
        success: true,
        chunksCount: effectiveChunks.length,
        data: parsedData,
      });
    }
  } catch (error: any) {
    console.error('Summarize-long error:', error);
    let errMsg = error?.message || '長文件分段歸納處理失敗，請重試。';
    if (errMsg.includes('Connection error') || errMsg.includes('fetch failed')) {
      errMsg = '連線至 AI 服務伺服器失敗 (Connection Error)，可能是網路中斷、API 服務暫時繁忙或防火牆阻擋。請稍後重試，或切換至 Google Gemini API 模型。';
    }
    return res.status(500).json({
      error: errMsg,
    });
  }
}
