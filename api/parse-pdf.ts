import { extractText, getDocumentProxy } from 'unpdf';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pdfBase64, fileBase64 } = req.body || {};
    const base64Input = pdfBase64 || fileBase64;

    if (!base64Input) {
      return res.status(400).json({ error: '請提供完整的 PDF 檔案 base64 資料' });
    }

    const cleanBase64 = typeof base64Input === 'string' ? base64Input.replace(/^data:[^;]+;base64,/, '') : base64Input;
    const buffer = Buffer.from(cleanBase64, 'base64');

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });

    const rawText: string = Array.isArray(text) ? text.join('\n\n') : (text || '');
    const pageCount: number = totalPages || 1;

    const englishWords = (rawText.match(/[a-zA-Z0-9]+/g) || []).length;
    const chineseChars = (rawText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const wordCount = englishWords + chineseChars;

    // Detect if PDF is scanned (no text layer or extremely low word count)
    const isScanned = wordCount < pageCount * 30 || rawText.trim().length < 50;

    return res.status(200).json({
      success: true,
      text: rawText,
      wordCount,
      pageCount,
      isScanned,
    });
  } catch (error: any) {
    console.error('PDF parsing error:', error);
    return res.status(500).json({
      error: error?.message || 'PDF 文字擷取失敗，請確認檔案未加密或已損毀。',
    });
  }
}
