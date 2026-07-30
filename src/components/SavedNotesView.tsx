import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Search,
  Trash2,
  Download,
  Calendar,
  Tag,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { SavedNote } from '../types';
import { getSavedNotes, deleteNote } from '../utils/storageUtils';
import { generateMarkdownNote, downloadFile } from '../utils/exportUtils';

interface SavedNotesViewProps {
  onOpenNoteDetail: (note: SavedNote) => void;
  onNotesUpdated: () => void;
}

export const SavedNotesView: React.FC<SavedNotesViewProps> = ({
  onOpenNoteDetail,
  onNotesUpdated,
}) => {
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  useEffect(() => {
    setNotes(getSavedNotes());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('確定要刪除這份保存的典藏筆記嗎？')) {
      deleteNote(id);
      setNotes(getSavedNotes());
      onNotesUpdated();
    }
  };

  const handleExportSingleNote = (note: SavedNote, e: React.MouseEvent) => {
    e.stopPropagation();
    const mdContent = generateMarkdownNote(
      note.summaryResult,
      note.userNotes,
      note.fileName
    );
    downloadFile(mdContent, `${note.title || '筆記'}.md`, 'text/markdown;charset=utf-8');
  };

  // Collect unique tags
  const allTags = Array.from(
    new Set(notes.flatMap((n) => n.tags || []))
  );

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.summaryResult.executiveSummary.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTag = selectedTag === 'all' || (note.tags && note.tags.includes(selectedTag));

    return matchesSearch && matchesTag;
  });

  return (
    <div className="bg-white border border-[#1A1A1A]/10 rounded-sm p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1A1A1A]/10">
        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-[#1A1A1A]" />
            <span>典藏文獻庫與研究記錄 ({notes.length})</span>
          </h2>
          <p className="text-xs font-serif italic text-[#1A1A1A]/60 mt-1">
            隨時查閱、導出或複習過往整理之學術文獻與筆記
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-[#1A1A1A]/50 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋文獻標題或關鍵字..."
            className="w-full pl-9 pr-4 py-2 bg-[#F9F8F6] border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
          />
        </div>
      </div>

      {/* Filter Tags */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[#1A1A1A]/60 flex items-center gap-1 shrink-0 font-mono text-[10px] uppercase">
            <Tag className="w-3 h-3" /> FILTER BY TAG:
          </span>
          <button
            onClick={() => setSelectedTag('all')}
            className={`px-3 py-1 text-xs font-bold uppercase transition-all border ${
              selectedTag === 'all'
                ? 'bg-[#1A1A1A] text-[#F9F8F6] border-[#1A1A1A]'
                : 'bg-[#F9F8F6] text-[#1A1A1A]/70 border-[#1A1A1A]/10 hover:border-[#1A1A1A]/30'
            }`}
          >
            ALL ({notes.length})
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1 text-xs font-bold uppercase transition-all border ${
                selectedTag === tag
                  ? 'bg-[#1A1A1A] text-[#F9F8F6] border-[#1A1A1A]'
                  : 'bg-[#F9F8F6] text-[#1A1A1A]/70 border-[#1A1A1A]/10 hover:border-[#1A1A1A]/30'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Saved Notes List Grid */}
      {filteredNotes.length === 0 ? (
        <div className="text-center py-16 bg-[#F9F8F6] border border-[#1A1A1A]/10">
          <BookOpen className="w-10 h-10 text-[#1A1A1A]/40 mx-auto mb-3" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">無相符文獻筆記</h3>
          <p className="text-xs font-serif italic text-[#1A1A1A]/60 mt-1">
            上傳文件並完成整理後，點擊「存入典藏筆記庫」即可隨時在此回顧。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => onOpenNoteDetail(note)}
              className="p-6 bg-white border border-[#1A1A1A]/10 hover:border-[#1A1A1A] transition-all cursor-pointer group flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[9px] font-bold px-2 py-0.5 border border-[#1A1A1A] text-[#1A1A1A] uppercase tracking-wider">
                    {note.fileType}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-[#1A1A1A]/60">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(note.createdAt).toLocaleDateString('zh-TW')}</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-[#1A1A1A] serif group-hover:underline line-clamp-1">
                  {note.title}
                </h3>
                <p className="text-[11px] font-serif italic text-[#1A1A1A]/60 line-clamp-1 mt-0.5">
                  檔名：{note.fileName}
                </p>

                <p className="text-xs text-[#1A1A1A]/80 line-clamp-3 mt-3 leading-relaxed font-serif bg-[#F9F8F6] p-3 border border-[#1A1A1A]/10 italic">
                  {note.summaryResult.executiveSummary}
                </p>
              </div>

              <div className="pt-3 border-t border-[#1A1A1A]/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleExportSingleNote(note, e)}
                    className="p-1.5 text-[#1A1A1A]/60 hover:text-[#1A1A1A] hover:bg-[#F9F8F6] transition-colors"
                    title="匯出為 .MD 筆記"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(note.id, e)}
                    className="p-1.5 text-[#1A1A1A]/60 hover:text-rose-700 hover:bg-[#F9F8F6] transition-colors"
                    title="刪除筆記"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                  <span>閱讀內文</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
