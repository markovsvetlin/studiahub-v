import type { PageContent } from '../../services/files/textExtraction'

/**
 * Count words in text using simple but accurate method
 * Splits on whitespace and filters empty strings
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0
  }
  
  // Split on whitespace, filter empty strings, count remaining
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

/**
 * Count total words across multiple pages
 */
export function countWordsInPages(pages: PageContent[]): number {
  return pages.reduce((total, page) => total + countWords(page.text), 0)
}

/**
 * Estimate words from character count (backup method)
 * Average word length in English is ~4.7 characters + 1 space
 */
export function estimateWordsFromChars(charCount: number): number {
  return Math.round(charCount / 5.7)
}