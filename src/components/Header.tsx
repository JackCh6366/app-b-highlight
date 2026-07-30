import React from 'react';
import { BookmarkCheck, BookOpen, FileText } from 'lucide-react';

interface HeaderProps {
  activeTab: 'summarize' | 'saved_notes' | 'samples';
  setActiveTab: (tab: 'summarize' | 'saved_notes' | 'samples') => void;
  savedNotesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  savedNotesCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#F9F8F6] border-b border-[#1A1A1A]/10 text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setActiveTab('summarize')}
        >
          <span className="w-8 h-8 bg-[#1A1A1A] rounded-full flex items-center justify-center text-[#F9F8F6] text-sm font-serif font-bold">
            S
          </span>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tighter serif flex items-center gap-2">
              SCRIBE & SCHOLAR
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-semibold hidden sm:block">
              Editorial Document Synthesis & Academic Reader
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-6 sm:gap-8 text-xs font-semibold uppercase tracking-widest">
          <button
            onClick={() => setActiveTab('summarize')}
            className={`pb-1 transition-all ${
              activeTab === 'summarize'
                ? 'border-b-2 border-[#1A1A1A] text-[#1A1A1A]'
                : 'opacity-40 hover:opacity-100 text-[#1A1A1A]'
            }`}
          >
            工作區 Workspace
          </button>

          <button
            onClick={() => setActiveTab('saved_notes')}
            className={`pb-1 transition-all flex items-center gap-1.5 ${
              activeTab === 'saved_notes'
                ? 'border-b-2 border-[#1A1A1A] text-[#1A1A1A]'
                : 'opacity-40 hover:opacity-100 text-[#1A1A1A]'
            }`}
          >
            <span>筆記庫 Archive</span>
            {savedNotesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#1A1A1A] text-[#F9F8F6] font-mono">
                {savedNotesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('samples')}
            className={`pb-1 transition-all ${
              activeTab === 'samples'
                ? 'border-b-2 border-[#1A1A1A] text-[#1A1A1A]'
                : 'opacity-40 hover:opacity-100 text-[#1A1A1A]'
            }`}
          >
            示範典藏 Library
          </button>
        </nav>
      </div>
    </header>
  );
};
