import { SavedNote, DocumentSummaryResult, FileType } from '../types';

const STORAGE_KEY = 'docmind_saved_notes_v1';

export function getSavedNotes(): SavedNote[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load saved notes from localStorage', err);
    return [];
  }
}

export function saveNote(
  title: string,
  fileName: string,
  fileType: FileType,
  summaryResult: DocumentSummaryResult,
  userNotes?: string,
  tags: string[] = []
): SavedNote {
  const notes = getSavedNotes();
  const newNote: SavedNote = {
    id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    title: title || summaryResult.documentTitle || '未命名筆記',
    fileName,
    fileType,
    summaryResult,
    createdAt: new Date().toISOString(),
    userNotes: userNotes || '',
    tags: tags.length > 0 ? tags : [fileType, 'AI筆記'],
  };

  const updatedNotes = [newNote, ...notes];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes));
  return newNote;
}

export function updateNote(id: string, userNotes: string, tags?: string[]): SavedNote | null {
  const notes = getSavedNotes();
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) return null;

  notes[index].userNotes = userNotes;
  if (tags) {
    notes[index].tags = tags;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  return notes[index];
}

export function deleteNote(id: string): boolean {
  const notes = getSavedNotes();
  const filtered = notes.filter((n) => n.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

export function exportAllNotesAsJSON(): string {
  const notes = getSavedNotes();
  return JSON.stringify(notes, null, 2);
}
