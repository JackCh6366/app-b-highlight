import React, { useState } from 'react';
import {
  FileText,
  Bookmark,
  Download,
  Copy,
  Check,
  ListOrdered,
  BookOpen,
  HelpCircle,
  Network,
  MessageSquare,
  Sparkles,
  Edit3,
  Quote,
  CheckSquare,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DocumentSummaryResult, FileMetadata, ChatMessage, SummaryOptions } from '../types';
import { generateMarkdownNote, downloadFile, copyToClipboard } from '../utils/exportUtils';
import { saveNote } from '../utils/storageUtils';
import { MindMapViewer } from './MindMapViewer';
import { FlashcardViewer } from './FlashcardViewer';

interface SummaryResultViewProps {
  result: DocumentSummaryResult;
  fileInfo: FileMetadata | null;
  options?: SummaryOptions;
  onSaveSuccess: () => void;
}

export const SummaryResultView: React.FC<SummaryResultViewProps> = ({
  result,
  fileInfo,
  options,
  onSaveSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<
    'summary' | 'outline' | 'terms' | 'flashcards' | 'mindmap' | 'chat'
  >('summary');

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [showNotesEditor, setShowNotesEditor] = useState(false);

  // Outline accordion state
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({
    0: true,
    1: true,
  });

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `您好！我是您的學術 AI 研究助理。針對這份《${result.documentTitle}》，您有任何問題或想要深入研析的章節嗎？`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);

  // Export handlers
  const handleExportMarkdown = () => {
    const mdContent = generateMarkdownNote(result, userNotes, fileInfo?.name);
    downloadFile(mdContent, `${result.documentTitle || '文獻歸納筆記'}.md`, 'text/markdown;charset=utf-8');
  };

  const handleExportText = () => {
    const mdContent = generateMarkdownNote(result, userNotes, fileInfo?.name);
    const plainText = mdContent.replace(/[#*`>-]/g, '');
    downloadFile(plainText, `${result.documentTitle || '文獻歸納筆記'}.txt`, 'text/plain;charset=utf-8');
  };

  const handleCopyNote = async () => {
    const mdContent = generateMarkdownNote(result, userNotes, fileInfo?.name);
    const success = await copyToClipboard(mdContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSaveToLibrary = () => {
    saveNote(
      result.documentTitle,
      fileInfo?.name || '文字內容',
      fileInfo?.type || 'text',
      result,
      userNotes,
      [fileInfo?.type || 'AI筆記', '重點歸納']
    );
    setSaved(true);
    onSaveSuccess();
    setTimeout(() => setSaved(false), 3000);
  };

  // Chat handler
  const handleSendMessage = async (customPromptText?: string) => {
    const textToSend = customPromptText || chatInput;
    if (!textToSend.trim() || isChatSending) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    if (!customPromptText) setChatInput('');
    setIsChatSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          documentSummary: result,
          rawTextSnippet: fileInfo?.rawText || '',
          options,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '無法取得 AI 回應');
      }

      const botMsg: ChatMessage = {
        id: 'msg_bot_' + Date.now(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error', err);
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'assistant',
        content: `抱歉，系統遇到問題：${err.message || '請稍後重試'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsChatSending(false);
    }
  };

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export Action Bar */}
      <div className="bg-white border border-[#1A1A1A]/10 rounded-sm p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#1A1A1A]/10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold px-2 py-0.5 border border-[#1A1A1A] uppercase tracking-widest text-[#1A1A1A]">
                SYNTHESIS COMPLETE
              </span>
              <span className="text-xs font-serif italic text-[#1A1A1A]/60">檔名: {fileInfo?.name || '文獻片段'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] serif tracking-tight">
              {result.documentTitle}
            </h1>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveToLibrary}
              disabled={saved}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border border-[#1A1A1A] flex items-center gap-1.5 ${
                saved
                  ? 'bg-emerald-800 text-[#F9F8F6] border-emerald-800'
                  : 'bg-[#1A1A1A] text-[#F9F8F6] hover:bg-[#333]'
              }`}
            >
              {saved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
              <span>{saved ? '已存入典藏' : '存入典藏筆記庫'}</span>
            </button>

            <button
              onClick={handleExportMarkdown}
              className="px-3.5 py-2 bg-[#F9F8F6] hover:bg-[#ECEAE4] border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
              title="匯出為 Markdown (.md) 筆記檔"
            >
              <Download className="w-3.5 h-3.5" />
              <span>導出 .MD</span>
            </button>

            <button
              onClick={handleExportText}
              className="px-3.5 py-2 bg-[#F9F8F6] hover:bg-[#ECEAE4] border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
              title="匯出為純文字 (.txt) 檔案"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>導出 .TXT</span>
            </button>

            <button
              onClick={handleCopyNote}
              className="px-3.5 py-2 bg-[#F9F8F6] hover:bg-[#ECEAE4] border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已複製筆記' : '複製內文'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pt-6 scrollbar-none text-xs font-bold uppercase tracking-widest">
          {[
            { id: 'summary', label: '核心精華摘要', icon: FileText, count: result.keyTakeaways?.length },
            { id: 'outline', label: '結構大綱脈絡', icon: ListOrdered, count: result.structuredOutline?.length },
            { id: 'terms', label: '概念字典', icon: BookOpen, count: result.keyTerms?.length },
            { id: 'flashcards', label: '記憶考點卡', icon: HelpCircle, count: result.flashcards?.length },
            { id: 'mindmap', label: '視覺心智圖', icon: Network, badge: 'MAP' },
            { id: 'chat', label: 'AI 學術對話', icon: MessageSquare, badge: 'QA' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 border transition-all shrink-0 ${
                  isActive
                    ? 'bg-[#1A1A1A] text-[#F9F8F6] border-[#1A1A1A]'
                    : 'bg-[#F9F8F6] text-[#1A1A1A]/70 border-[#1A1A1A]/10 hover:border-[#1A1A1A]/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 text-[9px] font-mono border ${
                      isActive ? 'border-[#F9F8F6]/30 text-[#F9F8F6]' : 'border-[#1A1A1A]/20 text-[#1A1A1A]/60'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="px-1.5 py-0.2 text-[9px] border border-emerald-800 text-emerald-800 font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="bg-white border border-[#1A1A1A]/10 rounded-sm p-8 shadow-sm min-h-[400px]">
        {/* Tab 1: Summary */}
        {activeTab === 'summary' && (
          <div className="space-y-8">
            {/* Executive Summary Box */}
            <div className="p-6 bg-[#F9F8F6] border border-[#1A1A1A] space-y-3">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1A1A1A]" />
                <span>高階執行摘要 (Executive Summary)</span>
              </h3>
              <p className="text-sm text-[#1A1A1A]/90 leading-relaxed whitespace-pre-line font-serif italic text-justify">
                {result.executiveSummary}
              </p>
            </div>

            {/* Key Takeaways */}
            {result.keyTakeaways && result.keyTakeaways.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2 border-b border-[#1A1A1A]/10 pb-2">
                  <CheckSquare className="w-4 h-4 text-[#1A1A1A]" />
                  <span>核心洞察與關鍵重點 (Key Takeaways)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.keyTakeaways.map((item: any, idx: number) => {
                    const isObject = typeof item === 'object' && item !== null;
                    const title = isObject ? item.title : `重點 ${idx + 1}`;
                    const points: string[] = isObject
                      ? Array.isArray(item.points) ? item.points : []
                      : [String(item)];

                    return (
                      <div
                        key={idx}
                        className="p-5 bg-[#F9F8F6] border border-[#1A1A1A]/10 hover:border-[#1A1A1A] transition-all space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex shrink-0 w-6 h-6 bg-[#1A1A1A] text-[#F9F8F6] font-serif italic font-bold text-xs items-center justify-center">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs font-bold text-[#1A1A1A] font-serif italic">{title}</h4>
                        </div>
                        <ul className="space-y-1.5 pl-3">
                          {points.map((pt, pIdx) => (
                            <li key={pIdx} className="text-xs text-[#1A1A1A]/80 leading-relaxed list-disc marker:text-[#1A1A1A]">
                              {pt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Important Quotes */}
            {result.importantQuotes && result.importantQuotes.length > 0 && (
              <div className="p-6 bg-[#ECEAE4] border border-[#1A1A1A]/20 space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
                  <Quote className="w-3.5 h-3.5 text-[#1A1A1A]" />
                  <span>代表性經典引述與金句</span>
                </h3>
                <div className="space-y-3">
                  {result.importantQuotes.map((q, idx) => (
                    <blockquote
                      key={idx}
                      className="text-xs italic text-[#1A1A1A] border-l-2 border-[#1A1A1A] pl-4 py-1 font-serif"
                    >
                      「{q}」
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {/* Actionable Points */}
            {result.actionablePoints && result.actionablePoints.length > 0 && (
              <div className="p-6 bg-[#F9F8F6] border border-[#1A1A1A]/10 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1A1A1A]" />
                  <span>實踐行動與延伸應用 (Action Items)</span>
                </h3>
                <ul className="space-y-2">
                  {result.actionablePoints.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-[#1A1A1A]/80">
                      <span className="text-[#1A1A1A] font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Structured Outline */}
        {activeTab === 'outline' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]/10 mb-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A]">章節拆解與架構脈絡</h3>
              <p className="text-xs font-serif italic text-[#1A1A1A]/60">點擊章節可折疊/展開詳細點位</p>
            </div>

            {result.structuredOutline?.map((section, idx) => {
              const isExpanded = expandedSections[idx];
              return (
                <div
                  key={idx}
                  className="bg-[#F9F8F6] border border-[#1A1A1A]/15 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleSection(idx)}
                    className="w-full p-4 text-left flex items-center justify-between bg-[#F9F8F6] hover:bg-[#ECEAE4] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-0.5 bg-[#1A1A1A] text-[#F9F8F6] font-serif italic text-xs font-bold">
                        SECTION {idx + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-[#1A1A1A] serif">{section.section}</h4>
                        {section.summary && (
                          <p className="text-xs text-[#1A1A1A]/60 line-clamp-1 mt-0.5 font-serif italic">
                            {section.summary}
                          </p>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#1A1A1A]/60" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#1A1A1A]/60" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-5 pt-3 border-t border-[#1A1A1A]/10 space-y-4 bg-white">
                      <div className="space-y-2.5 pl-2">
                        {section.points.map((pt, pIdx) => (
                          <div key={pIdx} className="flex items-start gap-2.5 text-xs text-[#1A1A1A]/80">
                            <span className="text-[#1A1A1A] font-bold mt-0.5">—</span>
                            <span className="leading-relaxed">{pt}</span>
                          </div>
                        ))}
                      </div>

                      {section.subSections && section.subSections.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-[#1A1A1A]/10 pl-2 space-y-3">
                          {section.subSections.map((sub, sIdx) => (
                            <div
                              key={sIdx}
                              className="p-3 bg-[#F9F8F6] border border-[#1A1A1A]/10"
                            >
                              <h5 className="text-xs font-bold text-[#1A1A1A] mb-1 font-serif italic">
                                {sub.title}
                              </h5>
                              <p className="text-xs text-[#1A1A1A]/70 leading-relaxed">{sub.detail}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Key Terms */}
        {activeTab === 'terms' && (
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A] pb-2 border-b border-[#1A1A1A]/10">
              核心專有名詞與概念解析字典 ({result.keyTerms?.length || 0})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.keyTerms?.map((term, idx) => (
                <div
                  key={idx}
                  className="p-5 bg-[#F9F8F6] border border-[#1A1A1A]/10 hover:border-[#1A1A1A] transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#1A1A1A] serif italic">{term.term}</h4>
                    <span className="text-[9px] font-mono border border-[#1A1A1A]/20 px-2 py-0.5 text-[#1A1A1A]/60">
                      TERM #{idx + 1}
                    </span>
                  </div>
                  <p className="text-xs text-[#1A1A1A]/80 leading-relaxed">{term.definition}</p>
                  {term.context && (
                    <p className="text-[11px] text-[#1A1A1A]/70 bg-[#ECEAE4] p-2 border border-[#1A1A1A]/10 font-serif italic">
                      脈絡/範例：{term.context}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Flashcards */}
        {activeTab === 'flashcards' && (
          <FlashcardViewer cards={result.flashcards || []} />
        )}

        {/* Tab 5: Mind Map */}
        {activeTab === 'mindmap' && (
          <MindMapViewer data={result.mindmap} />
        )}

        {/* Tab 6: Chat with Doc */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]/10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1A1A1A]" />
                  <span>AI 文件對話與深度探討</span>
                </h3>
                <p className="text-xs font-serif italic text-[#1A1A1A]/60 mt-0.5">對文獻內容隨時提問、請求研析或翻譯摘要</p>
              </div>

              {/* Quick Questions */}
              {result.suggestedQuestions && result.suggestedQuestions.length > 0 && (
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/60">建議提問:</span>
                  <button
                    onClick={() => handleSendMessage(result.suggestedQuestions[0])}
                    className="px-3 py-1 bg-[#F9F8F6] hover:bg-[#ECEAE4] text-[#1A1A1A] text-xs font-serif italic border border-[#1A1A1A]/20 line-clamp-1 max-w-[220px]"
                  >
                    {result.suggestedQuestions[0]}
                  </button>
                </div>
              )}
            </div>

            {/* Chat Messages Box */}
            <div className="h-[340px] overflow-y-auto space-y-4 p-5 bg-[#F9F8F6] border border-[#1A1A1A]/15">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono text-[#1A1A1A]/50">{msg.timestamp}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]">
                      {msg.role === 'user' ? '研究員' : 'SCRIBE AI'}
                    </span>
                  </div>
                  <div
                    className={`p-4 text-xs max-w-[85%] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#1A1A1A] text-[#F9F8F6]'
                        : 'bg-white border border-[#1A1A1A]/20 text-[#1A1A1A] whitespace-pre-line font-serif'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatSending && (
                <div className="flex items-center gap-2 text-xs text-[#1A1A1A] p-2 font-serif italic">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1A1A1A]" />
                  <span>AI 正在研讀文獻並進行深度思考...</span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="輸入您的問題（例：請幫我將這篇文獻的研究方法總結成 3 個重點...）"
                className="flex-1 px-4 py-3 bg-[#F9F8F6] border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!chatInput.trim() || isChatSending}
                className="p-3 bg-[#1A1A1A] text-[#F9F8F6] hover:bg-[#333] transition-colors disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Personal Notes Supplement Editor */}
      <div className="bg-white border border-[#1A1A1A]/10 rounded-sm p-8 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#1A1A1A]" />
            <span>個人研析加註與心得筆記 (會包含於導出 Markdown 中)</span>
          </h3>
          <button
            onClick={() => setShowNotesEditor(!showNotesEditor)}
            className="text-xs text-[#1A1A1A] font-bold underline uppercase tracking-wider"
          >
            {showNotesEditor ? '隱藏編輯框' : '展開 / 編輯註記'}
          </button>
        </div>

        {showNotesEditor ? (
          <textarea
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
            rows={4}
            placeholder="在此輸入您閱讀這份文獻時的個人註記、延伸疑問或導讀註解..."
            className="w-full p-4 bg-[#F9F8F6] border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs leading-relaxed focus:outline-none focus:border-[#1A1A1A] font-serif italic"
          />
        ) : (
          <p
            onClick={() => setShowNotesEditor(true)}
            className="text-xs text-[#1A1A1A]/60 font-serif italic cursor-pointer hover:text-[#1A1A1A]"
          >
            {userNotes ? userNotes : '點擊在此撰寫您的個人研析心得或補充註記...'}
          </p>
        )}
      </div>
    </div>
  );
};
