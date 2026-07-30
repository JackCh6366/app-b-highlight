import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';
import { safeParseJSON, sanitizeMindMap, buildSystemInstruction } from './_lib/ai-helpers';

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
