export function safeParseJSON(jsonString: string): any {
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
