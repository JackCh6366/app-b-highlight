import mammoth from 'mammoth';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileBase64 } = req.body || {};

    if (!fileBase64) {
      return res.status(400).json({ error: '請提供完整的 Word (.docx) 檔案 base64 資料' });
    }

    const cleanBase64 = typeof fileBase64 === 'string' ? fileBase64.replace(/^data:[^;]+;base64,/, '') : fileBase64;
    const buffer = Buffer.from(cleanBase64, 'base64');

    const result = await mammoth.extractRawText({ buffer });
    const rawText = result.value || '';

    const englishWords = (rawText.match(/[a-zA-Z0-9]+/g) || []).length;
    const chineseChars = (rawText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const wordCount = englishWords + chineseChars;

    return res.status(200).json({
      success: true,
      text: rawText,
      wordCount,
      messages: result.messages,
    });
  } catch (error: any) {
    console.error('Word parsing error:', error);
    return res.status(500).json({ error: error?.message || 'Word 檔案解析失敗' });
  }
}
