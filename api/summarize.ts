import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 尚未設定，請在環境變數 (Environment Variables) 中配置 API Key。');
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
    throw new Error('NVIDIA_API_KEY 尚未設定，請在環境變數 (Environment Variables) 中配置 NVIDIA_API_KEY。');
  }
  return new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey,
    timeout: 60000,
    maxRetries: 2,
  });
}

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

export function sanitizeMindMap(node: any, path: string = '0'): any {
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

export function buildSystemInstruction(options: any) {
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
    const { rawText, pdfBase64, options, fileName } = req.body || {};

    if (!rawText && !pdfBase64) {
      return res.status(400).json({ error: '請上傳文件或貼上內文' });
    }

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

    const systemInstruction = buildSystemInstruction(options);
    let parsedData: any;

    const { isScanned } = req.body || {};

    // --- Protection: empty rawText handling ---
    const hasText = rawText && rawText.trim().length > 0;

    if (!hasText && provider === 'nvidia') {
      // NVIDIA models need rawText; pdfBase64 alone is useless for text-only models
      if (isScanned) {
        // Check if the selected NVIDIA model supports vision
        const isVisionModel = selectedModel.includes('vision') || selectedModel.includes('phi-4-multimodal');
        if (!isVisionModel) {
          return res.status(400).json({
            error: '此檔案為無純文字層之掃描版 PDF，目前選用的 NVIDIA 模型不支援視覺分析，請切換至 Gemini 3.6 Flash 或具備視覺能力之模型（如 Llama 3.2 Vision / Phi-4 Multimodal）。',
          });
        }
        // TODO Phase 2: implement NVIDIA vision model page-by-page image analysis
        return res.status(400).json({
          error: 'NVIDIA 視覺模型的掃描版 PDF 分析功能開發中，請暫時切換至 Gemini 2.5 Flash 處理掃描版文件。',
        });
      }
      // Not scanned but rawText still empty → extraction failure
      if (!pdfBase64) {
        return res.status(400).json({ error: '請上傳文件或貼上內文' });
      }
      return res.status(400).json({
        error: 'PDF 文字擷取失敗，請確認檔案未加密或已損毀。若為掃描版 PDF，請切換至 Gemini 模型。',
      });
    }

    if (provider === 'nvidia') {
      const nvidia = getNvidiaClient();
      const nvidiaPrompt = `${systemInstruction}

【文件標題/檔名】：${fileName || '文字文件'}
【文件原文內容】：
${rawText}

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

      const completion = await nvidia.chat.completions.create({
        model: selectedModel,
        messages: [{ role: 'user', content: nvidiaPrompt }],
        temperature: 0.2,
        max_tokens: 16000,
        extra_body: {
          chat_template_kwargs: { enable_thinking: true },
          reasoning_budget: 4096,
        },
      } as any);

      const rawOutput = completion.choices[0]?.message?.content || '{}';
      parsedData = safeParseJSON(rawOutput);
    } else {
      // Gemini API path
      const ai = getGenAI();
      const contentsParts: any[] = [];

      if (pdfBase64) {
        const cleanPdfBase64 = typeof pdfBase64 === 'string' ? pdfBase64.replace(/^data:[^;]+;base64,/, '') : pdfBase64;
        contentsParts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: cleanPdfBase64,
          },
        });
        contentsParts.push({
          text: `請詳細閱讀這份名為「${fileName || 'PDF文件'}」的 PDF 檔案內容，並依照系統指令要求進行完整的整理歸納與筆記生成。`,
        });
      } else {
        contentsParts.push({
          text: `【文件標題/檔名】：${fileName || '文字文件'}\n\n【文件原文內容】：\n${rawText}`,
        });
      }

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          documentTitle: { type: Type.STRING, description: '文件主題名稱' },
          executiveSummary: { type: Type.STRING, description: '執行摘要與全篇精華' },
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
                title: { type: Type.STRING, description: '重點主題與小標題' },
                points: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '極其詳細的條列推論與說明項目',
                },
              },
              required: ['title', 'points'],
            },
            description: '核心關鍵洞察與條列重點列表',
          },
          structuredOutline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                section: { type: Type.STRING, description: '章節標題' },
                summary: { type: Type.STRING, description: '章節簡述' },
                points: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '章節詳細要點',
                },
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
                term: { type: Type.STRING, description: '專有名詞' },
                definition: { type: Type.STRING, description: '定義解釋' },
                context: { type: Type.STRING, description: '出現脈絡或範例' },
              },
              required: ['term', 'definition'],
            },
          },
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: '複習問題' },
                answer: { type: Type.STRING, description: '詳細解答' },
                tag: { type: Type.STRING, description: '分類標籤' },
              },
              required: ['question', 'answer'],
            },
          },
          actionablePoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '行動建議與應用點',
          },
          importantQuotes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '關鍵引述或金句',
          },
          suggestedQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '建議追問或深度討論題目',
          },
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
        contents: { parts: contentsParts },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          maxOutputTokens: 32000,
          thinkingConfig: { thinkingBudget: selectedModel.includes('flash-lite') ? 4096 : 2048 },
        },
      });

      const resultText = response.text || '{}';
      parsedData = safeParseJSON(resultText);
    }

    if (parsedData && parsedData.mindmap) {
      parsedData.mindmap = sanitizeMindMap(parsedData.mindmap, '0');
    }

    return res.status(200).json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Summarize error:', error);
    let errMsg = error?.message || '生成摘要時發生錯誤，請確認 API Key 是否設定正確。';
    if (errMsg.includes('Connection error') || errMsg.includes('fetch failed')) {
      errMsg = '連線至 AI 服務伺服器失敗 (Connection Error)，可能是網路中斷、API 服務暫時繁忙或防火牆阻擋。請稍後重試，或切換至 Google Gemini API 模型。';
    }
    return res.status(500).json({
      error: errMsg,
    });
  }
}
