import { GoogleGenAI } from '@google/genai';
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
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, documentSummary, rawTextSnippet, language = '繁體中文', options } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: '無效的對話訊息格式' });
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

    if (provider === 'nvidia') {
      const nvidia = getNvidiaClient();
      const formattedMessages = [
        { role: 'system', content: systemInstruction },
        ...messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      ];

      const completion = await nvidia.chat.completions.create({
        model: selectedModel,
        messages: formattedMessages as any,
        temperature: 0.3,
        max_tokens: 2048,
      });

      return res.status(200).json({
        success: true,
        reply: completion.choices[0]?.message?.content || '無法生成回應。',
      });
    } else {
      const ai = getGenAI();

      const chatHistory = messages.slice(0, -1).map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const lastUserMessage = messages[messages.length - 1]?.content || '請說明這份文件的核心要點';

      const chat = ai.chats.create({
        model: selectedModel,
        history: chatHistory,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: selectedModel.includes('flash-lite') ? 'HIGH' : 'MEDIUM' },
        } as any,
      });

      const response = await chat.sendMessage({ message: lastUserMessage });

      return res.status(200).json({
        success: true,
        reply: response.text || '無法生成回應。',
      });
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: error?.message || '對話回應生成失敗' });
  }
}
