export type FileType = 'pdf' | 'docx' | 'text';

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

export interface KeyTerm {
  term: string;
  definition: string;
  context?: string;
}

export interface Flashcard {
  question: string;
  answer: string;
  tag?: string;
}

export interface OutlineSection {
  section: string;
  summary: string;
  points: string[];
  subSections?: {
    title: string;
    detail: string;
  }[];
}

export interface DocumentSummaryResult {
  documentTitle: string;
  executiveSummary: string;
  keyTakeaways: string[];
  structuredOutline: OutlineSection[];
  keyTerms: KeyTerm[];
  flashcards: Flashcard[];
  mindmap: MindMapNode;
  actionablePoints: string[];
  importantQuotes: string[];
  suggestedQuestions: string[];
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: FileType;
  uploadDate: string;
  wordCount: number;
  rawText?: string;
  base64Data?: string; // For PDF base64
  mimeType?: string;
}

export type SummaryMode = 'comprehensive' | 'concise' | 'academic' | 'exam_prep' | 'business' | 'quick_reading';

export interface SummaryOptions {
  mode: SummaryMode;
  length: 'short' | 'medium' | 'detailed';
  language: string; // '繁體中文', 'English', etc.
  customPrompt?: string;
  includeExamCards: boolean;
  includeTerms: boolean;
  includeMindmap: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SavedNote {
  id: string;
  title: string;
  fileName: string;
  fileType: FileType;
  summaryResult: DocumentSummaryResult;
  createdAt: string;
  userNotes?: string;
  tags: string[];
  rawTextPreview?: string;
}
