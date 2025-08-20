/**
 * Simple OpenAI embeddings service
 */

import fetch from 'node-fetch';

/**
 * Generate embeddings using OpenAI
 */
export async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY required');
  if (!texts.length) throw new Error('No texts provided');
  
  // Debug: Log text lengths to identify large chunks
  console.log(`Embedding ${texts.length} texts with lengths:`, texts.map(t => t.length));
  
  // Safety: Truncate any text that's too long (6000 chars = ~1500 tokens, safe margin)
  const safTexts = texts.map(text => text.length > 6000 ? text.substring(0, 6000) + '...' : text);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: safTexts,
      model: 'text-embedding-3-large'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json() as { data: { embedding: number[] }[] };
  return data.data.map(item => item.embedding);
}