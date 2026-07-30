import React, { useState } from 'react';
import { HelpCircle, ChevronLeft, ChevronRight, CheckCircle, RotateCw } from 'lucide-react';
import { Flashcard } from '../types';

interface FlashcardViewerProps {
  cards: Flashcard[];
}

export const FlashcardViewer: React.FC<FlashcardViewerProps> = ({ cards }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());

  if (!cards || cards.length === 0) return null;

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const toggleMarkMastered = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(completedSet);
    if (newSet.has(currentIndex)) {
      newSet.delete(currentIndex);
    } else {
      newSet.add(currentIndex);
    }
    setCompletedSet(newSet);
  };

  return (
    <div className="bg-[#F9F8F6] border border-[#1A1A1A]/15 rounded-sm p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]/10">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#1A1A1A]" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A]">
            考點複習閃卡 ({currentIndex + 1} / {cards.length})
          </h3>
        </div>

        <div className="flex items-center gap-2 text-xs font-serif italic text-[#1A1A1A]/70">
          <span>已精通: {completedSet.size} 個</span>
          <div className="w-20 bg-white h-2 overflow-hidden border border-[#1A1A1A]/20">
            <div
              className="bg-[#1A1A1A] h-full transition-all"
              style={{ width: `${(completedSet.size / cards.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Flashcard Container with Flip Effect */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="min-h-[220px] p-8 bg-white border border-[#1A1A1A] shadow-sm flex flex-col justify-between cursor-pointer group hover:bg-[#F9F8F6] transition-all relative overflow-hidden"
      >
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold px-2 py-0.5 border border-[#1A1A1A] text-[#1A1A1A] uppercase tracking-wider">
            {isFlipped ? 'ANSWER' : 'QUESTION'} {currentCard.tag ? `• ${currentCard.tag}` : ''}
          </span>

          <button
            onClick={toggleMarkMastered}
            className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all border ${
              completedSet.has(currentIndex)
                ? 'bg-[#1A1A1A] text-[#F9F8F6] border-[#1A1A1A]'
                : 'bg-transparent text-[#1A1A1A]/60 border-transparent hover:border-[#1A1A1A]/20'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{completedSet.has(currentIndex) ? '已標記精通' : '標記精通'}</span>
          </button>
        </div>

        <div className="my-auto py-4 text-center">
          {isFlipped ? (
            <p className="text-base font-serif italic text-[#1A1A1A] leading-relaxed animate-fadeIn">
              {currentCard.answer}
            </p>
          ) : (
            <p className="text-lg font-bold text-[#1A1A1A] serif leading-relaxed">
              {currentCard.question}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-widest text-[#1A1A1A]/50 group-hover:text-[#1A1A1A] transition-colors">
          <RotateCw className="w-3 h-3" />
          <span>點擊卡片翻面檢視{isFlipped ? '問題' : '答案'}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handlePrev}
          className="px-4 py-2 border border-[#1A1A1A]/20 bg-white hover:bg-[#1A1A1A] hover:text-[#F9F8F6] text-[#1A1A1A] transition-all flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>PREV</span>
        </button>

        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="px-5 py-2 bg-[#1A1A1A] text-[#F9F8F6] hover:bg-[#333] text-xs font-bold uppercase tracking-wider transition-all"
        >
          FLIP CARD
        </button>

        <button
          onClick={handleNext}
          className="px-4 py-2 border border-[#1A1A1A]/20 bg-white hover:bg-[#1A1A1A] hover:text-[#F9F8F6] text-[#1A1A1A] transition-all flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
        >
          <span>NEXT</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
