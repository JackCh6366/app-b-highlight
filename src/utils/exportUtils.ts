import { DocumentSummaryResult, SavedNote } from '../types';

/**
 * Convert DocumentSummaryResult into a clean, well-formatted Markdown string.
 */
export function generateMarkdownNote(
  result: DocumentSummaryResult,
  userNotes?: string,
  fileName?: string
): string {
  const dateStr = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let md = `# 📝 ${result.documentTitle}\n\n`;
  md += `> **來源檔案**：${fileName || '文字文件'}  \n`;
  md += `> **整理日期**：${dateStr}  \n\n`;

  if (userNotes && userNotes.trim()) {
    md += `## 💡 個人學習筆記與補充\n\n${userNotes.trim()}\n\n---\n\n`;
  }

  md += `## 📌 執行摘要 (Executive Summary)\n\n${result.executiveSummary}\n\n`;

  if (result.keyTakeaways && result.keyTakeaways.length > 0) {
    md += `## 🎯 核心關鍵重點 (Key Takeaways)\n\n`;
    result.keyTakeaways.forEach((takeaway: any, idx) => {
      if (typeof takeaway === 'string') {
        md += `${idx + 1}. ${takeaway}\n`;
      } else {
        md += `### ${idx + 1}. ${takeaway.title || '核心重點'}\n`;
        if (Array.isArray(takeaway.points)) {
          takeaway.points.forEach((pt: string) => {
            md += `- ${pt}\n`;
          });
        }
        md += `\n`;
      }
    });
    md += `\n`;
  }

  if (result.structuredOutline && result.structuredOutline.length > 0) {
    md += `## 📚 結構化章節大綱 (Structured Outline)\n\n`;
    result.structuredOutline.forEach((section) => {
      md += `### ${section.section}\n\n`;
      if (section.summary) {
        md += `*${section.summary}*\n\n`;
      }
      section.points.forEach((point) => {
        md += `- ${point}\n`;
      });
      if (section.subSections && section.subSections.length > 0) {
        section.subSections.forEach((sub) => {
          md += `  - **${sub.title}**：${sub.detail}\n`;
        });
      }
      md += `\n`;
    });
  }

  if (result.keyTerms && result.keyTerms.length > 0) {
    md += `## 🏷️ 核心專有名詞與概念 (Key Terms)\n\n`;
    md += `| 專有名詞 | 定義與解析 | 脈絡 / 範例 |\n`;
    md += `| :--- | :--- | :--- |\n`;
    result.keyTerms.forEach((term) => {
      md += `| **${term.term}** | ${term.definition.replace(/\n/g, ' ')} | ${
        term.context ? term.context.replace(/\n/g, ' ') : '-'
      } |\n`;
    });
    md += `\n`;
  }

  if (result.flashcards && result.flashcards.length > 0) {
    md += `## 🂠 學習複習考點卡片 (Flashcards)\n\n`;
    result.flashcards.forEach((fc, idx) => {
      md += `### Q${idx + 1}: ${fc.question}${fc.tag ? ` *[${fc.tag}]*` : ''}\n`;
      md += `**答**：${fc.answer}\n\n`;
    });
  }

  if (result.actionablePoints && result.actionablePoints.length > 0) {
    md += `## 🚀 實踐行動建議 (Action Items)\n\n`;
    result.actionablePoints.forEach((act) => {
      md += `- [ ] ${act}\n`;
    });
    md += `\n`;
  }

  if (result.importantQuotes && result.importantQuotes.length > 0) {
    md += `## 💬 重要金句與關鍵引述 (Quotes)\n\n`;
    result.importantQuotes.forEach((quote) => {
      md += `> 「${quote}」\n\n`;
    });
  }

  if (result.suggestedQuestions && result.suggestedQuestions.length > 0) {
    md += `## ❓ 深度延伸思考題 (Suggested Questions)\n\n`;
    result.suggestedQuestions.forEach((q, idx) => {
      md += `${idx + 1}. ${q}\n`;
    });
    md += `\n`;
  }

  md += `---\n*本筆記由 DocMind AI 自動整理導出*`;

  return md;
}

/**
 * Trigger browser file download
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}
