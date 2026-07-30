import express from 'express';
import path from 'path';
import multer from 'multer';
import mammoth from 'mammoth';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

const app = express();
const PORT = 3000;

// Increase JSON payload size limit for base64 PDFs
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to instantiate Gemini AI
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 尚未設定，請在 AI Studio 設定 (Settings) 中的 Secrets 配置 API Key。');
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

/**
 * Safely parse JSON from Gemini response, repairing truncated JSON strings if necessary.
 */
function safeParseJSON(jsonString: string): any {
  if (!jsonString) return {};

  let cleaned = jsonString.trim();

  // Strip markdown code blocks if wrapped
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    // Strip leading/trailing ``` if present
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Ensure string starts with { or [
  const firstBrace = cleaned.search(/[\{\[]/);
  if (firstBrace > 0) {
    cleaned = cleaned.substring(firstBrace);
  }

  // 1. Direct parse
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // 2. Sanitize control characters (raw newlines/tabs inside strings)
    try {
      const sanitized = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
        if (c === '\n') return '\\n';
        if (c === '\r') return '\\r';
        if (c === '\t') return '\\t';
        return '';
      });
      return JSON.parse(sanitized);
    } catch (_) {
      // Continue to auto-repair strategy
    }
  }

  // 3. Auto-repair strategy for truncated JSON
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

  // Close open containers in reverse order
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
      } catch (_) {
        // try previous cut point
      }
    }
    throw new Error('無法解構分析結果 JSON，請嘗試稍微減少文獻長度或選擇「均衡扎實」深度。');
  }
}

// 1. Parse Word (.docx) endpoint using mammoth
app.post('/api/parse-doc', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請提供要解析的檔案' });
    }
    const buffer = req.file.buffer;
    const result = await mammoth.extractRawText({ buffer });
    const rawText = result.value || '';
    
    // Estimate word count (Chinese chars + English words)
    const englishWords = (rawText.match(/[a-zA-Z0-9]+/g) || []).length;
    const chineseChars = (rawText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const wordCount = englishWords + chineseChars;

    res.json({
      success: true,
      text: rawText,
      wordCount,
      messages: result.messages,
    });
  } catch (error: any) {
    console.error('Word parsing error:', error);
    res.status(500).json({ error: error?.message || 'Word 檔案解析失敗' });
  }
});

// 2. Summarize document endpoint using Gemini 3.6 Flash
app.post('/api/summarize', async (req, res) => {
  try {
    const { rawText, pdfBase64, options, fileName } = req.body;

    if (!rawText && !pdfBase64) {
      return res.status(400).json({ error: '請上傳文件或貼上內文' });
    }

    const ai = getGenAI();

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

    const systemInstruction = `你是一位世界級的高級研究員、學術學者與學習效率專家。你的任務是將使用者提供的文件（PDF、Word 或文章）進行極致深度閱讀、全面解析與結構化歸納。

【總結模式方針】：${modeDesc}
【目標輸出語言】：必須全程使用【${targetLang}】輸出內容，語句流暢專業，專有名詞可附帶英文原名。
【摘要深度要求】：${targetLength}（請盡可能詳細且深入，條列式列表要發揮豐富詳實的說明內容，切勿過度簡略，盡量涵蓋文中所有重要數據、推論、技術細節與論點）。
${customInstruction}

【詳細輸出指導原則】：
1. documentTitle: 為這份文件起一個清晰精準且具學術/專業質感的中文主題名稱。
2. executiveSummary: 2-4 段極其完整、高濃縮且通順的執行摘要/核心總覽。
3. keyTakeaways: 條列 6-10 個極其詳細的核心關鍵重點與洞察。每點皆需包含明確的小標題與深入的條列式推論/說明（包含因果關係、數據、研究結果等）。
4. structuredOutline: 依照文件內容完整結構化拆解所有章節 (Section)。每個章節包含小結 (summary)、3 至 5 點詳細條列要點 (points)，並盡可能填寫 subSections 深入次要細節。
5. keyTerms: 提取文件中 6-10 個核心專有名詞或重要概念，給予專業嚴謹的定義與詳細的出現脈絡/範例。
6. flashcards: 生成 6-8 個關鍵複習問答題 (問題與完整詳細的解答)，協助讀者自我測驗記憶。
7. mindmap: 建立完整多層級的樹狀心智圖結構 (Root Node -> Level 1 主主題 -> Level 2 子主題 -> Level 3 關鍵點)，層級豐富，視覺化理解全篇脈絡。
8. actionablePoints: 提出 3 至 6 點具體的實踐行動建議、應用場景或進一步延伸研析方向。
9. importantQuotes: 摘錄 3-5 句最具代表性或啟發性的原文/金句與重點文句。
10. suggestedQuestions: 提出 3 個使用者可以進一步追問、延伸思考或研究的學術問題。`;

    // Construct prompt content
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
        keyTakeaways: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '核心關鍵洞察與重點列點',
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
          required: ['id', 'label'],
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
        'keyTakeaways',
        'structuredOutline',
        'keyTerms',
        'flashcards',
        'mindmap',
        'actionablePoints',
        'importantQuotes',
        'suggestedQuestions',
      ],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: contentsParts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    const resultText = response.text || '{}';
    const parsedData = safeParseJSON(resultText);

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Summarize error:', error);
    res.status(500).json({
      error: error?.message || '生成摘要時發生錯誤，請確認 API Key 是否設定正確。',
    });
  }
});

// 3. Document Chat endpoint for continuous Q&A
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, documentSummary, rawTextSnippet, pdfBase64, language = '繁體中文' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: '無效的對話訊息格式' });
    }

    const ai = getGenAI();

    const systemInstruction = `你是一位專業且親切的文件學習助理。你正在協助使用者針對這份文件進行深度探討、解答疑問或擴充說明。

【關於這份文件資訊】：
主題：${documentSummary?.documentTitle || '未命名文件'}
執行摘要：${documentSummary?.executiveSummary || ''}
${rawTextSnippet ? `【文件內容片段】：\n${rawTextSnippet.slice(0, 8000)}\n...` : ''}

【回答準則】：
1. 嚴格根據上述文件內容與對話上下文回答問題。若文件未提及相關內容，請坦誠告知並提供合理推論。
2. 回答語言：【${language}】。
3. 語氣專業、清晰，多利用條列式（Bullet points）增加易讀性。
4. 鼓勵引導使用者進行深入學習與思考。`;

    const chatHistory = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastUserMessage = messages[messages.length - 1]?.content || '請說明這份文件的核心要點';

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: chatHistory,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    const response = await chat.sendMessage({ message: lastUserMessage });

    res.json({
      success: true,
      reply: response.text || '無法生成回應。',
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error?.message || '對話回應生成失敗' });
  }
});

// Global Express error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Express Global Error]:', err);
  if (res.headersSent) {
    return;
  }
  res.status(err.status || err.statusCode || 500).json({
    success: false,
    error: err.message || '伺服器處理請求時發生錯誤，請檢查檔案大小或網路連線。',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DocMind Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
