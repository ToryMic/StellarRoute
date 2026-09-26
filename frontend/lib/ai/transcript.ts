export interface TranscriptMessage {
  id: string;
  intentId: string;
  content: string;
  timestamp: number;
}

const TRANSCRIPT_STORAGE_KEY = 'stellar_route_ai_transcript';

export function saveTranscript(messages: TranscriptMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save transcript to localStorage:', error);
  }
}

export function loadTranscript(): TranscriptMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(TRANSCRIPT_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as TranscriptMessage[];
  } catch (error) {
    console.error('Failed to load transcript from localStorage:', error);
    return [];
  }
}

export function clearTranscript(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TRANSCRIPT_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear transcript from localStorage:', error);
  }
}
