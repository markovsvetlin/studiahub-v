/**
 * Simple text chunking service
 */

export interface Chunk {
  text: string;
}

interface PageContent {
  pageNumber: number;
  text: string;
}

/**
 * Split text into chunks with guaranteed complete coverage (no page tracking)
 */
export function simpleSemanticChunk(pages: PageContent[]): Chunk[] {
  if (!pages.length) return [];
  
  const chunks: Chunk[] = [];
  const targetChars = 1600; // ~400 tokens at 4 chars/token
  
  // Concatenate ALL text from all pages for complete coverage
  let allText = '';
  for (const page of pages) {
    const pageText = page.text.trim();
    if (pageText) {
      allText += (allText ? '\n' : '') + pageText;
    }
  }
  
  if (!allText) return [];
  
  // Split the complete text sequentially with no gaps
  let position = 0;
  
  while (position < allText.length) {
    let chunkEnd = Math.min(position + targetChars, allText.length);
    
    // Try to break at word boundaries for better semantic chunks
    if (chunkEnd < allText.length) {
      const lastSpace = allText.lastIndexOf(' ', chunkEnd);
      const lastNewline = allText.lastIndexOf('\n', chunkEnd);
      const bestBreak = Math.max(lastSpace, lastNewline);
      
      // Only break at word boundary if it doesn't make chunk too small
      if (bestBreak > position + targetChars * 0.7) {
        chunkEnd = bestBreak;
      }
    }
    
    const chunkText = allText.substring(position, chunkEnd).trim();
    if (!chunkText) break;
    
    chunks.push({ text: chunkText });
    
    position = chunkEnd;
    // Skip whitespace to avoid gaps
    while (position < allText.length && /\s/.test(allText[position])) {
      position++;
    }
  }
  
  return chunks;
}