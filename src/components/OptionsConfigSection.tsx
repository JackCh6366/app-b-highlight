import React from 'react';
import { Sliders, Sparkles, Layers, CheckSquare, Languages, MessageSquare } from 'lucide-react';
import { SummaryOptions, SummaryMode } from '../types';

interface OptionsConfigSectionProps {
  options: SummaryOptions;
  setOptions: React.Dispatch<React.SetStateAction<SummaryOptions>>;
  onStartSummarize: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export const OptionsConfigSection: React.FC<OptionsConfigSectionProps> = ({
  options,
  setOptions,
  onStartSummarize,
  isLoading,
  disabled,
}) => {
  const modes: { id: SummaryMode; label: string; desc: string; num: string }[] = [
    {
      id: 'comprehensive',
      label: '綜合全方位歸納',
      desc: '深入完整的精華摘要、結構化大綱與完整細節',
      num: '01',
    },
    {
      id: 'concise',
      label: '極簡核心要點',
      desc: '快速抓出 5 分鐘精華，適合快速閱讀',
      num: '02',
    },
    {
      id: 'academic',
      label: '學術論文與研究',
      desc: '著重研究背景、方法論、結論與實驗數據',
      num: '03',
    },
    {
      id: 'exam_prep',
      label: '考試複習與備考',
      desc: '強化重點考點、核心概念、問答練習題',
      num: '04',
    },
    {
      id: 'business',
      label: '商業與決策簡報',
      desc: '執行摘要、SWOT、風險評估與行動建議',
      num: '05',
    },
    {
      id: 'quick_reading',
      label: '高效速讀提煉',
      desc: '文章脈絡摘要與關鍵金句摘錄',
      num: '06',
    },
  ];

  return (
    <div className="bg-white border border-[#1A1A1A]/10 rounded-sm p-8 shadow-sm space-y-8">
      <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A]/10">
        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
            <span className="w-2 h-2 bg-[#1A1A1A] rounded-full inline-block"></span>
            <span>02. 設定歸納模式與範本</span>
          </h2>
          <p className="text-xs font-serif italic text-[#1A1A1A]/60 mt-1">
            依據學術、商業或備考需求，精準打造高質感的筆記架構
          </p>
        </div>
      </div>

      {/* Mode Selector */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-3">
          選擇重點歸納主題範本：
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setOptions((prev) => ({ ...prev, mode: mode.id }))}
              className={`p-4 border text-left transition-all relative ${
                options.mode === mode.id
                  ? 'bg-[#ECEAE4] border-[#1A1A1A] text-[#1A1A1A]'
                  : 'bg-[#F9F8F6] border-[#1A1A1A]/10 text-[#1A1A1A]/80 hover:border-[#1A1A1A]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#1A1A1A]">{mode.label}</span>
                <span className="text-xs font-serif italic text-[#1A1A1A]/40">{mode.num}</span>
              </div>
              <p className="text-[11px] text-[#1A1A1A]/60 line-clamp-2 leading-relaxed">{mode.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Length & Language Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Length */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#1A1A1A]" /> 摘要深度與詳細度：
          </label>
          <div className="grid grid-cols-3 gap-2 bg-[#ECEAE4] p-1 border border-[#1A1A1A]/10">
            {[
              { id: 'short', label: '精簡' },
              { id: 'medium', label: '標準' },
              { id: 'detailed', label: '詳細不漏' },
            ].map((len) => (
              <button
                key={len.id}
                onClick={() =>
                  setOptions((prev) => ({
                    ...prev,
                    length: len.id as any,
                  }))
                }
                className={`py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                  options.length === len.id
                    ? 'bg-[#1A1A1A] text-[#F9F8F6]'
                    : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
                }`}
              >
                {len.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target Language */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-2 flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-[#1A1A1A]" /> 筆記輸出目標語言：
          </label>
          <select
            value={options.language}
            onChange={(e) => setOptions((prev) => ({ ...prev, language: e.target.value }))}
            className="w-full px-4 py-2 bg-[#F9F8F6] border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs font-bold focus:outline-none focus:border-[#1A1A1A]"
          >
            <option value="繁體中文">繁體中文 (Traditional Chinese)</option>
            <option value="English">English</option>
            <option value="日本語">日本語 (Japanese)</option>
            <option value="简体中文">简体中文 (Simplified Chinese)</option>
          </select>
        </div>
      </div>

      {/* Toggles for included modules */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-3 flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-[#1A1A1A]" /> 選擇包含之生成模組：
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2.5 p-3 bg-[#F9F8F6] border border-[#1A1A1A]/10 cursor-pointer hover:border-[#1A1A1A]/40">
            <input
              type="checkbox"
              checked={options.includeTerms}
              onChange={(e) => setOptions((prev) => ({ ...prev, includeTerms: e.target.checked }))}
              className="w-4 h-4 text-[#1A1A1A] focus:ring-0 accent-[#1A1A1A]"
            />
            <span className="text-xs font-bold text-[#1A1A1A]">專有名詞與概念字典</span>
          </label>

          <label className="flex items-center gap-2.5 p-3 bg-[#F9F8F6] border border-[#1A1A1A]/10 cursor-pointer hover:border-[#1A1A1A]/40">
            <input
              type="checkbox"
              checked={options.includeExamCards}
              onChange={(e) => setOptions((prev) => ({ ...prev, includeExamCards: e.target.checked }))}
              className="w-4 h-4 text-[#1A1A1A] focus:ring-0 accent-[#1A1A1A]"
            />
            <span className="text-xs font-bold text-[#1A1A1A]">學習複習卡 (Flashcards)</span>
          </label>

          <label className="flex items-center gap-2.5 p-3 bg-[#F9F8F6] border border-[#1A1A1A]/10 cursor-pointer hover:border-[#1A1A1A]/40">
            <input
              type="checkbox"
              checked={options.includeMindmap}
              onChange={(e) => setOptions((prev) => ({ ...prev, includeMindmap: e.target.checked }))}
              className="w-4 h-4 text-[#1A1A1A] focus:ring-0 accent-[#1A1A1A]"
            />
            <span className="text-xs font-bold text-[#1A1A1A]">樹狀心智圖結構</span>
          </label>
        </div>
      </div>

      {/* Custom Prompt */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-1.5 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-[#1A1A1A]" /> 自訂 AI 指示 (選填)：
        </label>
        <input
          type="text"
          value={options.customPrompt || ''}
          onChange={(e) => setOptions((prev) => ({ ...prev, customPrompt: e.target.value }))}
          placeholder="例如：請特別著重於第三章，並分析缺點與優點比較..."
          className="w-full px-4 py-2.5 bg-[#F9F8F6] border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs font-medium focus:outline-none focus:border-[#1A1A1A]"
        />
      </div>

      {/* Start Button */}
      <div className="pt-2">
        <button
          onClick={onStartSummarize}
          disabled={disabled || isLoading}
          className="w-full py-4 bg-[#1A1A1A] text-[#F9F8F6] font-bold text-xs uppercase tracking-[0.25em] hover:bg-[#333] transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-[#F9F8F6]/30 border-t-[#F9F8F6] rounded-full animate-spin"></div>
              <span>Gemini AI 正在深度閱讀與研析文本中...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>開始 AI 重點歸納與生成筆記</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
