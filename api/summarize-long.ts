import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';
import { safeParseJSON, sanitizeMindMap, buildSystemInstruction } from '../lib/ai-helpers';

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
    timeout: 60000,
    maxRetries: 2,
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(rawText: string, maxChunkLength = 8000): string[] {
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
              thinkingConfig: { thinkingBudget: selectedModel.includes('flash-lite') ? 4096 : 2048 },
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

    const chunks = chunkText(activeText, 8000);
    const chunkResults: string[] = [];

    // Map Phase: Process chunk by chunk with delay throttle (400ms) to respect rate limits
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) {
        await delay(400); // 400ms throttling between chunks
      }

      const chunk = chunks[i];
      const mapPrompt = `請詳細分析以下長文件第 ${i + 1} / ${chunks.length} 段落內容，提取該段落的核心概念、章節大綱與重要數據說明：\n\n${chunk}`;

      if (provider === 'nvidia') {
        const nvidia = getNvidiaClient();
        const completion = await nvidia.chat.completions.create({
          model: selectedModel,
          messages: [{ role: 'user', content: mapPrompt }],
          temperature: 0.2,
          max_tokens: 2048,
        });
        chunkResults.push(`【段落 ${i + 1} 分析筆記】：\n${completion.choices[0]?.message?.content || ''}`);
      } else {
        const ai = getGenAI();
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: mapPrompt,
          config: {
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingBudget: selectedModel.includes('flash-lite') ? 4096 : 2048 },
          },
        });
        chunkResults.push(`【段落 ${i + 1} 分析筆記】：\n${response.text || ''}`);
      }
    }

    // Reduce Phase: Combine all chunk notes into single structured summary
    const combinedNotes = chunkResults.join('\n\n---\n\n');
    const systemInstruction = buildSystemInstruction(options);
    let parsedData: any;

    if (provider === 'nvidia') {
      const nvidia = getNvidiaClient();
      const nvidiaPrompt = `${systemInstruction}

【文件標題/檔名】：${fileName || '長文件'}
【長文件全篇分段研析彙整資訊】：
${combinedNotes}

請根據上述全篇各分段研析資訊，彙整生成完整的 JSON 結構化筆記。`;

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
      chunksCount: chunks.length,
      data: parsedData,
    });
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
