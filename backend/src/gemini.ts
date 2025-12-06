import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

export function initGemini(apiKey: string) {
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });
}

export function getGeminiModel(): GenerativeModel {
  if (!model) {
    throw new Error('Gemini not initialized. Call initGemini() first.');
  }
  return model;
}

export type TradeItems = { itemId: string; amount: number }[];

export type PookieResponse = 
  | { type: 'idle'; seconds: number; thought: string }
  | { type: 'say'; message: string; thought: string }
  | { type: 'move-to-facility'; facilityId: string; thought: string }
  | { type: 'move-to-pookie'; pookieName: string; thought: string }
  | { type: 'offer-trade'; targetPookieName: string; itemsOffered: TradeItems; itemsRequested: TradeItems; thought: string }
  | { type: 'accept-offer'; offerId: string; thought: string }
  | { type: 'reject-offer'; offerId: string; thought: string };

export async function askPookie(prompt: string, facilityIds: string[], pookieNames: string[]): Promise<PookieResponse> {
  const model = getGeminiModel();
  
  const fullPrompt = prompt;
  
  try {
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text().trim();
    
    // Try to extract JSON from the response
    let jsonStr = text;
    
    // Handle markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    const parsed = JSON.parse(jsonStr) as PookieResponse;
    
    // Validate the response
    if (parsed.type === 'idle' && typeof parsed.seconds === 'number') {
      return { type: 'idle', seconds: Math.min(20, Math.max(1, parsed.seconds)), thought: parsed.thought ?? '' };
    }
    if (parsed.type === 'say' && typeof parsed.message === 'string') {
      return { type: 'say', message: parsed.message.slice(0, 200), thought: parsed.thought ?? '' };
    }
    if (parsed.type === 'move-to-facility' && facilityIds.includes(parsed.facilityId)) {
      return { ...parsed, thought: parsed.thought ?? '' };
    }
    if (parsed.type === 'move-to-pookie' && pookieNames.includes(parsed.pookieName)) {
      return { ...parsed, thought: parsed.thought ?? '' };
    }
    if (parsed.type === 'offer-trade' && pookieNames.includes(parsed.targetPookieName) && Array.isArray(parsed.itemsOffered) && Array.isArray(parsed.itemsRequested)) {
      return { ...parsed, thought: parsed.thought ?? '' };
    }
    if (parsed.type === 'accept-offer' && typeof parsed.offerId === 'string') {
      return { ...parsed, thought: parsed.thought ?? '' };
    }
    if (parsed.type === 'reject-offer' && typeof parsed.offerId === 'string') {
      return { ...parsed, thought: parsed.thought ?? '' };
    }
    
    // Invalid response, default to idle
    console.warn('Invalid Gemini response, defaulting to idle:', text);
    return { type: 'idle', seconds: 3, thought: 'I need to think about what to do next' };
  } catch (error) {
    console.error('Gemini API error:', error);
    return { type: 'idle', seconds: 3, thought: 'I need to think about what to do next' };
  }
}

