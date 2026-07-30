import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  FileSearch,
  Sparkles,
  Zap,
} from 'lucide-react';
import { FileMetadata, FileType } from '../types';
import { SAMPLE_DOCS, SampleDoc } from '../data/SampleDocs';

interface FileUploadSectionProps {
  currentFile: FileMetadata | null;
  onFileLoaded: (fileData: FileMetadata) => void;
  onClearFile: () => void;
  isLoading: boolean;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  currentFile,
  onFileLoaded,
  onClearFile,
  isLoading,
}) => {
  const [activeInputType, setActiveInputType] = useState<'upload' | 'text'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file select or drop
  const handleFileChange = async (file: File) => {
    setParseError(null);
    setIsParsing(true);

    const fileName = file.name;
    const fileSize = file.size;
    const lowerName = fileName.toLowerCase();

    try {
      if (lowerName.endsWith('.pdf')) {
        // PDF: Convert to base64 for Gemini API direct native PDF vision parsing
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip data URI header if present
          const base64Data = result.includes(',') ? result.split(',')[1] : result;
          
          const estimatedWords = Math.round(fileSize / 10);

          onFileLoaded({
            id: 'file_' + Date.now(),
            name: fileName,
            size: fileSize,
            type: 'pdf',
            uploadDate: new Date().toLocaleDateString('zh-TW'),
            wordCount: estimatedWords,
            base64Data,
            mimeType: 'application/pdf',
          });
          setIsParsing(false);
        };
        reader.onerror = () => {
          setParseError('PDF 讀取失敗，請重試。');
          setIsParsing(false);
        };
        reader.readAsDataURL(file);
      } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
        // Word file: send to backend /api/parse-doc with mammoth
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/parse-doc', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Word 檔案解析失敗');
        }

        onFileLoaded({
          id: 'file_' + Date.now(),
          name: fileName,
          size: fileSize,
          type: 'docx',
          uploadDate: new Date().toLocaleDateString('zh-TW'),
          wordCount: data.wordCount || data.text.length,
          rawText: data.text,
        });
        setIsParsing(false);
      } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
        // Plain text or markdown
        const text = await file.text();
        const englishWords = (text.match(/[a-zA-Z0-9]+/g) || []).length;
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;

        onFileLoaded({
          id: 'file_' + Date.now(),
          name: fileName,
          size: fileSize,
          type: 'text',
          uploadDate: new Date().toLocaleDateString('zh-TW'),
          wordCount: englishWords + chineseChars,
          rawText: text,
        });
        setIsParsing(false);
      } else {
        setParseError('僅支援 PDF (.pdf)、Word (.docx, .doc) 及純文字 (.txt, .md) 格式');
        setIsParsing(false);
      }
    } catch (err: any) {
      console.error('File parsing error', err);
      setParseError(err.message || '文件讀取失敗');
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmPastedText = () => {
    if (!pastedText.trim()) return;
    const title = textTitle.trim() || '自訂文字貼上內容';
    const englishWords = (pastedText.match(/[a-zA-Z0-9]+/g) || []).length;
    const chineseChars = (pastedText.match(/[\u4e00-\u9fa5]/g) || []).length;

    onFileLoaded({
      id: 'text_' + Date.now(),
      name: title,
      size: new Blob([pastedText]).size,
      type: 'text',
      uploadDate: new Date().toLocaleDateString('zh-TW'),
      wordCount: englishWords + chineseChars,
      rawText: pastedText,
    });
  };

  const handleSelectSample = (sample: SampleDoc) => {
    const englishWords = (sample.content.match(/[a-zA-Z0-9]+/g) || []).length;
    const chineseChars = (sample.content.match(/[\u4e00-\u9fa5]/g) || []).length;

    onFileLoaded({
      id: 'sample_' + sample.id,
      name: `${sample.title}`,
      size: new Blob([sample.content]).size,
      type: sample.type,
      uploadDate: new Date().toLocaleDateString('zh-TW'),
      wordCount: englishWords + chineseChars,
      rawText: sample.content,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="bg-white border border-[#1A1A1A]/10 rounded-sm p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1A1A1A]/10">
        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
            <span className="w-2 h-2 bg-[#1A1A1A] rounded-full inline-block"></span>
            <span>01. 選擇或上傳文獻檔案</span>
          </h2>
          <p className="text-xs font-serif italic text-[#1A1A1A]/60 mt-1">
            支援 PDF、Word (.docx) 與文字貼上，系統將自動解析內文結構與數據
          </p>
        </div>

        {/* Sub input tabs */}
        <div className="flex items-center gap-1 bg-[#ECEAE4] p-1 border border-[#1A1A1A]/10">
          <button
            onClick={() => setActiveInputType('upload')}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
              activeInputType === 'upload'
                ? 'bg-[#1A1A1A] text-[#F9F8F6]'
                : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
            }`}
          >
            拖曳 / 上傳檔案
          </button>
          <button
            onClick={() => setActiveInputType('text')}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
              activeInputType === 'text'
                ? 'bg-[#1A1A1A] text-[#F9F8F6]'
                : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
            }`}
          >
            貼上文章內文
          </button>
        </div>
      </div>

      {/* Selected File Card */}
      {currentFile ? (
        <div className="bg-[#F9F8F6] border border-[#1A1A1A] p-6 relative transition-all">
          <button
            onClick={onClearFile}
            disabled={isLoading}
            className="absolute top-4 right-4 p-1.5 text-[#1A1A1A]/60 hover:text-[#1A1A1A] hover:bg-[#ECEAE4] transition-all disabled:opacity-50"
            title="移除文件"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#1A1A1A] text-[#F9F8F6] font-serif text-lg font-bold">
              {currentFile.type.toUpperCase()}
            </div>

            <div className="flex-1 min-w-0 pr-8">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold px-2 py-0.5 border border-[#1A1A1A] uppercase tracking-widest text-[#1A1A1A]">
                  {currentFile.type}
                </span>
                <h3 className="text-base font-bold text-[#1A1A1A] truncate serif italic">
                  {currentFile.name}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[#1A1A1A]/70 mt-2 font-mono">
                <span>大小: {formatFileSize(currentFile.size)}</span>
                <span>•</span>
                <span>字數約計: {currentFile.wordCount.toLocaleString()} 字</span>
                <span>•</span>
                <span className="text-[#1A1A1A] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> 已就緒
                </span>
              </div>

              {currentFile.rawText && (
                <div className="mt-4 p-3 bg-white text-xs text-[#1A1A1A]/80 border border-[#1A1A1A]/10 font-serif italic max-h-24 overflow-y-auto leading-relaxed">
                  <p className="line-clamp-3">
                    {currentFile.rawText.slice(0, 300)}...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeInputType === 'upload' ? (
        <div>
          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed p-10 text-center cursor-pointer transition-all duration-200 ${
              isDragOver
                ? 'border-[#1A1A1A] bg-[#ECEAE4]'
                : 'border-[#1A1A1A]/30 bg-[#F9F8F6] hover:border-[#1A1A1A] hover:bg-[#ECEAE4]/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              accept=".pdf,.docx,.doc,.txt,.md"
              className="hidden"
            />

            {isParsing ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-8 h-8 border-2 border-[#1A1A1A]/20 border-t-[#1A1A1A] rounded-full animate-spin mb-3"></div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">正在解析與提取文本數據...</p>
                <p className="text-[11px] font-serif italic text-[#1A1A1A]/60 mt-1">請稍候片刻</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-[#1A1A1A] text-[#F9F8F6] flex items-center justify-center mb-4">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">
                  點擊上傳或將 PDF / Word 檔案拖曳至此區域
                </p>
                <p className="text-xs font-serif italic text-[#1A1A1A]/60 mt-2">
                  支援格式：<span className="font-sans font-bold uppercase text-[#1A1A1A]">PDF (.pdf)</span>、
                  <span className="font-sans font-bold uppercase text-[#1A1A1A]">Word (.docx)</span>、
                  <span className="font-sans font-bold uppercase text-[#1A1A1A]">純文字 (.txt, .md)</span>
                </p>
              </div>
            )}
          </div>

          {/* Quick Sample Selector */}
          <div className="mt-6 pt-5 border-t border-[#1A1A1A]/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/60 mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#1A1A1A]" /> 快速載入經典示範文獻：
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SAMPLE_DOCS.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className="text-left p-4 bg-[#F9F8F6] border border-[#1A1A1A]/10 hover:border-[#1A1A1A] transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold px-2 py-0.5 border border-[#1A1A1A]/30 uppercase text-[#1A1A1A]">
                      {sample.category}
                    </span>
                    <Sparkles className="w-3.5 h-3.5 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h4 className="text-xs font-bold text-[#1A1A1A] mt-2 line-clamp-1 serif italic">
                    {sample.title}
                  </h4>
                  <p className="text-[11px] text-[#1A1A1A]/60 line-clamp-2 mt-1">
                    {sample.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Text Area Input */
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-1">
              文獻標題 / 主題 (選填)
            </label>
            <input
              type="text"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              placeholder="例：生成式 AI 與高等教育變革"
              className="w-full px-4 py-2.5 bg-[#F9F8F6] border border-[#1A1A1A]/20 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-1">
              文章與研究全文內文
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={7}
              placeholder="請貼上論文、簡報、演講稿或經典文獻全文..."
              className="w-full px-4 py-3 bg-[#F9F8F6] border border-[#1A1A1A]/20 text-[#1A1A1A] text-sm leading-relaxed focus:outline-none focus:border-[#1A1A1A] font-serif italic"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleConfirmPastedText}
              disabled={!pastedText.trim()}
              className="px-6 py-3 bg-[#1A1A1A] text-[#F9F8F6] text-xs font-bold uppercase tracking-[0.2em] hover:bg-[#333] transition-colors disabled:opacity-40"
            >
              載入文章全文
            </button>
          </div>
        </div>
      )}

      {/* Parse error alert */}
      {parseError && (
        <div className="mt-4 p-3 border border-[#1A1A1A] bg-rose-50 text-rose-900 text-xs flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}
    </div>
  );
};
