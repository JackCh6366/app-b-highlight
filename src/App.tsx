import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUploadSection } from './components/FileUploadSection';
import { OptionsConfigSection } from './components/OptionsConfigSection';
import { SummaryResultView } from './components/SummaryResultView';
import { SavedNotesView } from './components/SavedNotesView';
import { FileMetadata, DocumentSummaryResult, SummaryOptions, SavedNote } from './types';
import { SAMPLE_DOCS, SampleDoc } from './data/SampleDocs';
import { getSavedNotes } from './utils/storageUtils';
import { Sparkles, AlertTriangle, ArrowLeft, BookOpen, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'summarize' | 'saved_notes' | 'samples'>('summarize');
  const [currentFile, setCurrentFile] = useState<FileMetadata | null>(null);
  
  const [options, setOptions] = useState<SummaryOptions>({
    mode: 'comprehensive',
    length: 'detailed',
    language: '繁體中文',
    includeExamCards: true,
    includeTerms: true,
    includeMindmap: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatusMessage, setLoadingStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<DocumentSummaryResult | null>(null);
  const [savedNotesCount, setSavedNotesCount] = useState<number>(0);

  useEffect(() => {
    setSavedNotesCount(getSavedNotes().length);
  }, []);

  const handleUpdateSavedNotesCount = () => {
    setSavedNotesCount(getSavedNotes().length);
  };

  const handleStartSummarize = async () => {
    if (!currentFile) return;

    setIsLoading(true);
    setErrorMessage(null);

    const isLongDoc = (currentFile.wordCount && currentFile.wordCount > 30000) || (currentFile.rawText && currentFile.rawText.length > 30000);
    const endpoint = isLongDoc ? '/api/summarize-long' : '/api/summarize';

    if (isLongDoc) {
      setLoadingStatusMessage('長文件（超過 30,000 字）已自動切分為多個段落逐段深度分析中...');
    } else {
      setLoadingStatusMessage(null);
    }

    try {
      // Optimization: Only send pdfBase64 if document is scanned or has no text layer, preventing Vercel 4.5MB payload limit error
      const shouldSendPdfBase64 = currentFile.isScanned || !currentFile.rawText || currentFile.rawText.trim().length === 0;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawText: currentFile.rawText || '',
          pdfBase64: shouldSendPdfBase64 ? (currentFile.base64Data || null) : null,
          fileName: currentFile.name,
          isScanned: currentFile.isScanned || false,
          options,
        }),
      });

      const contentType = res.headers.get('content-type');
      let data: any = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `伺服器回應錯誤 (HTTP ${res.status})`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || '整理歸納時發生錯誤，請稍後重試或檢查檔案內容。');
      }

      setSummaryResult(data.data);
    } catch (err: any) {
      console.error('Summarize failed', err);
      let msg = err.message || '';
      if (msg.includes('PAYLOAD_TOO_LARGE') || msg.includes('413') || msg.includes('Request Entity Too Large')) {
        msg = '上傳的檔案傳輸資料量過大（超過 Vercel 雲端 API 4.5MB 限制）。請注意：若是掃描版 PDF 請壓縮檔案或裁切頁數；純文字 PDF 可直接抽取文字後處理。';
      } else if (msg === 'Failed to fetch') {
        msg = '無法連線至後端服務，可能是網路中斷、檔案過大或伺服器正在重新啟動中。';
      } else if (!msg) {
        msg = '連線至 AI 服務失敗，請檢查 API Key 或網路狀態。';
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      setLoadingStatusMessage(null);
    }
  };

  const handleSelectSampleAndSummarize = (sample: SampleDoc) => {
    const englishWords = (sample.content.match(/[a-zA-Z0-9]+/g) || []).length;
    const chineseChars = (sample.content.match(/[\u4e00-\u9fa5]/g) || []).length;

    const fileMeta: FileMetadata = {
      id: 'sample_' + sample.id,
      name: `${sample.title}`,
      size: new Blob([sample.content]).size,
      type: sample.type,
      uploadDate: new Date().toLocaleDateString('zh-TW'),
      wordCount: englishWords + chineseChars,
      rawText: sample.content,
    };

    setCurrentFile(fileMeta);
    setSummaryResult(null);
    setActiveTab('summarize');
  };

  const handleOpenSavedNoteDetail = (savedNote: SavedNote) => {
    setCurrentFile({
      id: savedNote.id,
      name: savedNote.fileName,
      size: 0,
      type: savedNote.fileType,
      uploadDate: savedNote.createdAt,
      wordCount: 0,
    });
    setSummaryResult(savedNote.summaryResult);
    setActiveTab('summarize');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        savedNotesCount={savedNotesCount}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* TAB 1: Document Summarizer */}
        {activeTab === 'summarize' && (
          <div className="space-y-8">
            {/* If result exists, render back button */}
            {summaryResult && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSummaryResult(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-2 border border-slate-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>重新選擇文件或更改設定</span>
                </button>
              </div>
            )}

            {!summaryResult ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: File Upload (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  <FileUploadSection
                    currentFile={currentFile}
                    onFileLoaded={(fileMeta) => {
                      setCurrentFile(fileMeta);
                      setErrorMessage(null);
                    }}
                    onClearFile={() => {
                      setCurrentFile(null);
                      setSummaryResult(null);
                    }}
                    isLoading={isLoading}
                  />
                </div>

                {/* Right: Options & Start Button (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  <OptionsConfigSection
                    options={options}
                    setOptions={setOptions}
                    onStartSummarize={handleStartSummarize}
                    isLoading={isLoading}
                    loadingStatusMessage={loadingStatusMessage}
                    isScanned={currentFile?.isScanned}
                    disabled={!currentFile}
                  />
                </div>
              </div>
            ) : (
              /* Summary Output View */
              <SummaryResultView
                result={summaryResult}
                fileInfo={currentFile}
                options={options}
                onSaveSuccess={handleUpdateSavedNotesCount}
              />
            )}

            {/* Error Message Box */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">整理過程遇到錯誤：</p>
                  <p className="mt-0.5 text-rose-300">{errorMessage}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Saved Notes Library */}
        {activeTab === 'saved_notes' && (
          <SavedNotesView
            onOpenNoteDetail={handleOpenSavedNoteDetail}
            onNotesUpdated={handleUpdateSavedNotesCount}
          />
        )}

        {/* TAB 3: Sample Documents Showcase */}
        {activeTab === 'samples' && (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <span>內建示範文件庫</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                選擇下方優質示範文件，立即體驗強大的 AI 重點歸納與筆記導出功能
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SAMPLE_DOCS.map((sample) => (
                <div
                  key={sample.id}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-700/80 hover:border-indigo-500/60 transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                        {sample.category}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        {sample.type}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-100">{sample.title}</h3>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {sample.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleSelectSampleAndSummarize(sample)}
                    className="w-full py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-bold transition-all border border-indigo-500/30 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>載入並開始 AI 歸納</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>DocMind © 2026 — 高效閱讀、重點整理與筆記歸納工具 (Powered by Gemini AI)</p>
      </footer>
    </div>
  );
}
