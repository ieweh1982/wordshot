/**
 * OCR Service - Tesseract.js based local OCR for danmu capture
 * Provides text recognition from screenshots when DOM injection is not available
 */

import Tesseract from 'tesseract.js';
import { Danmu, DanmuType } from '../types';

export interface OCRResult {
  text: string;
  confidence: number;
}

export interface CapturedDanmuRaw {
  username: string;
  content: string;
  type: string;
  raw: string;
}

let worker: Tesseract.Worker | null = null;

/**
 * Initialize Tesseract worker with Chinese language support
 */
export async function initOCR(): Promise<void> {
  if (worker) return;

  worker = await Tesseract.createWorker('eng+chi_sim', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  console.log('[OCR] Worker initialized with Chinese support');
}

/**
 * Perform OCR on an image buffer
 */
export async function recognizeText(
  imageBuffer: Buffer | Uint8Array | string
): Promise<OCRResult> {
  if (!worker) {
    await initOCR();
  }

  const result = await worker!.recognize(imageBuffer as unknown as import('tesseract.js').ImageLike);
  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
}

/**
 * Perform OCR on a screenshot region
 */
export async function recognizeRegion(
  imageBuffer: Buffer | Uint8Array,
  region: { x: number; y: number; width: number; height: number }
): Promise<OCRResult> {
  const result = await recognizeText(imageBuffer);
  return result;
}

/**
 * Terminate OCR worker
 */
export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    console.log('[OCR] Worker terminated');
  }
}

/**
 * Parse raw OCR text to extract danmu elements
 * This is a heuristic parser that looks for common danmu patterns
 */
export function parseOCRDanmu(rawText: string): CapturedDanmuRaw[] {
  const results: CapturedDanmuRaw[] = [];
  const lines = rawText.split('\n').filter((line) => line.trim().length > 0);

  // Common patterns for danmu:
  // 1. "用户名: 内容" or "用户名：内容"
  // 2. "[类型] 用户名: 内容"
  const patterns = [
    // Pattern: 用户名: 内容
    /^[:：](.{2,20})[:：](.{1,200})$/,
    // Pattern: [类型] 用户名: 内容
    /^\[(.{1,20})\]\s*(.{2,20})[:：](.{1,200})$/,
    // Pattern: 用户名：内容
    /^(.{2,20})[:：](.{1,200})$/,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, username, content] = match;
        results.push({
          username: username.trim(),
          content: content.trim(),
          type: 'normal',
          raw: line,
        });
        break;
      }
    }
  }

  return results;
}

/**
 * Classify danmu type from content
 */
export function classifyDanmuType(content: string, username: string): DanmuType {
  const text = content.toLowerCase();
  const user = username.toLowerCase();

  // Big gift patterns
  if (
    text.includes('火箭') ||
    text.includes('飞船') ||
    text.includes('超级火箭') ||
    /\d{3,}[元¥]/.test(text) // 3+ digit currency
  ) {
    return 'big_gift';
  }

  // Gift patterns
  if (
    text.includes('礼物') ||
    text.includes('打赏') ||
    text.includes('送') ||
    text.includes('赞')
  ) {
    return 'gift';
  }

  // Follower patterns
  if (
    text.includes('关注') ||
    text.includes('follow') ||
    text.includes('粉丝')
  ) {
    return 'follower';
  }

  // Question patterns
  if (
    text.includes('?') ||
    text.includes('？') ||
    text.includes('怎么') ||
    text.includes('如何') ||
    text.includes('为什么')
  ) {
    return 'question';
  }

  // Hater/negative patterns
  if (
    text.includes('滚') ||
    text.includes('垃圾') ||
    text.includes('恶心') ||
    text.includes('差评')
  ) {
    return 'hater';
  }

  // Provocative patterns
  if (
    text.includes('不服') ||
    text.includes('来啊') ||
    text.includes('挑战')
  ) {
    return 'provocative';
  }

  // VIP patterns
  if (
    text.includes('贵宾') ||
    text.includes('VIP') ||
    text.includes('老爷')
  ) {
    return 'vip';
  }

  // Praise patterns
  if (
    text.includes('好看') ||
    text.includes('漂亮') ||
    text.includes('棒') ||
    text.includes('赞') ||
    text.includes('厉害')
  ) {
    return 'praise';
  }

  // PK patterns
  if (
    text.includes('PK') ||
    text.includes('pk') ||
    text.includes('挑战')
  ) {
    return 'pk';
  }

  return 'normal';
}

/**
 * Check if OCR result is likely valid danmu text
 */
export function isValidDanmuText(text: string): boolean {
  // Filter out very short or very long texts
  if (text.length < 2 || text.length > 500) return false;

  // Filter out texts that are mostly numbers/symbols
  const letterCount = text.replace(/[^a-zA-Z一-龥]/g, '').length;
  if (letterCount < 2) return false;

  return true;
}
