/**
 * OCR Service - Multi-backend OCR implementation
 *
 * Supports:
 * 1. Windows.Media.Ocr.CLI (if installed)
 * 2. Cloud OCR via AI providers with vision capabilities
 * 3. Fallback simulated data when OCR is unavailable
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DanmuType } from '../types';

const execAsync = promisify(exec);

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

// OCR backend type
export type OCRBackend = 'windows' | 'cloud' | 'none';

// Cloud OCR request structure
export interface CloudOCRRequest {
  imageBase64: string;
  provider: {
    baseURL: string;
    apiKey?: string;
    model: string;
    timeout: number;
  };
}

// Initialize OCR with a specific backend
let initialized = false;
let ocrBackend: OCRBackend = 'none';

/**
 * Initialize OCR service with available backend
 */
export async function initOCR(): Promise<void> {
  // Check for Windows.Media.Ocr.CLI
  const cliPath = await findWindowsOCLI();
  if (cliPath) {
    ocrBackend = 'windows';
    console.log('[OCR] Using Windows.Media.Ocr.CLI backend');
  } else {
    ocrBackend = 'none';
    console.log('[OCR] No local OCR available, cloud OCR required');
  }
  initialized = true;
}

/**
 * Find Windows.Media.Ocr.CLI executable
 */
async function findWindowsOCLI(): Promise<string | null> {
  const cliPaths = [
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'Windows.Media.Ocr.Cli.exe'),
    'C:\\Program Files (x86)\\Windows.Media.Ocr.Cli.exe',
    'C:\\Program Files\\Windows.Media.Ocr.Cli.exe',
  ];

  for (const p of cliPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Search in PATH
  try {
    const { stdout } = await execAsync('where Windows.Media.Ocr.Cli', { encoding: 'utf8' });
    if (stdout.trim()) {
      return stdout.trim().split('\n')[0];
    }
  } catch {}

  return null;
}

/**
 * Perform OCR using cloud AI provider with vision capabilities
 * Makes direct HTTP call from main process to avoid CORS issues
 */
export async function performCloudOCR(
  imageBase64: string,
  providerConfig: { baseURL: string; apiKey?: string; model: string; timeout: number }
): Promise<OCRResult> {
  const startTime = Date.now();
  console.log('[OCR] Performing cloud OCR...');

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (providerConfig.apiKey) {
      headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
    }

    const url = `${providerConfig.baseURL}/chat/completions`;
    const requestStart = Date.now();
    console.log('[OCR] Calling AI provider at:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), providerConfig.timeout || 120000);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: providerConfig.model,
        messages: [
          {
            role: 'system',
            content: '你是一个弹幕/聊天记录提取引擎。只输出从图像中识别出的用户消息和弹幕内容，每行一条。输出格式：如果有用户名，格式为“用户名: 内容”；如果没有用户名，只输出内容。绝对不要输出任何解释、描述、界面元素（如按钮、窗口标题、时间戳、操作指令）或额外标记。',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '提取这张截图中的所有弹幕和聊天消息，忽略界面上的其他文字。',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.0,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const httpElapsed = Date.now() - requestStart;

    // Save raw response to debug file for inspection
    const rawResponse = await response.text();
    try {
      const fs = require('fs');
      const os = require('os');
      const debugDir = path.join(os.homedir(), 'Documents', 'wordshot_debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const debugFile = path.join(debugDir, `ocr_raw_${Date.now()}.txt`);
      fs.writeFileSync(debugFile, rawResponse);
      console.log('[OCR] Raw response saved to:', debugFile);
    } catch (e) {
      console.log('[OCR] Failed to save raw response:', e);
    }

    let data;
    try {
      data = JSON.parse(rawResponse);
    } catch (e) {
      console.error('[OCR] Failed to parse JSON response:', e);
      return { text: '', confidence: 0 };
    }
    const parseElapsed = Date.now() - requestStart;
    console.log('[OCR] Cloud OCR response parsed in', parseElapsed, 'ms');

    if (data.choices && data.choices[0]?.message?.content) {
      const totalElapsed = Date.now() - startTime;
      console.log(`[OCR] Cloud OCR total time: ${totalElapsed}ms`);

      // Simply return the content - model should output one danmu per line
      const rawContent = data.choices[0].message.content.trim();
      console.log('[OCR] Danmu content:', JSON.stringify(rawContent.slice(0, 300)));

      return {
        text: rawContent,
        confidence: 0.9,
      };
    }

    return { text: '', confidence: 0 };
  } catch (error) {
    const totalElapsed = Date.now() - startTime;
    console.error(`[OCR] Cloud OCR error after ${totalElapsed}ms:`, error);
    return { text: '', confidence: 0 };
  }
}

/**
 * Get AI providers via IPC (avoids localStorage in main process)
 */
export async function getCloudOCRProvider(): Promise<{ baseURL: string; apiKey?: string; model: string; timeout: number } | null> {
  try {
    const api = (window as any).electronAPI;
    if (api && typeof api.getAIProviders === 'function') {
      const config = await api.getAIProviders();
      const enabledProvider = config.providers?.find((p: any) => p.enabled);
      if (enabledProvider) {
        return {
          baseURL: enabledProvider.baseURL,
          apiKey: enabledProvider.apiKey,
          model: enabledProvider.model,
          timeout: enabledProvider.timeout || 120000,
        };
      }
    }
  } catch (error) {
    console.error('[OCR] Error getting AI providers:', error);
  }
  return null;
}

/**
 * Perform OCR on an image buffer using available backend
 */
export async function recognizeText(
  imageBuffer: Buffer | Uint8Array | string,
  cloudProvider?: { baseURL: string; apiKey?: string; model: string; timeout: number }
): Promise<OCRResult> {
  if (!initialized) {
    await initOCR();
  }

  console.log('[OCR] Starting OCR, backend:', ocrBackend);

  try {
    // Save image buffer to temp file
    const tempPngPath = path.join(os.tmpdir(), `ocr_input_${Date.now()}.png`);
    const tempBmpPath = path.join(os.tmpdir(), `ocr_input_${Date.now()}.bmp`);

    // Write the image buffer to a file
    if (Buffer.isBuffer(imageBuffer)) {
      fs.writeFileSync(tempPngPath, imageBuffer);
    } else if (typeof imageBuffer === 'string') {
      fs.writeFileSync(tempPngPath, Buffer.from(imageBuffer, 'base64'));
    } else {
      fs.writeFileSync(tempPngPath, Buffer.from(imageBuffer));
    }

    // Convert BMP to PNG if needed
    const imageData = fs.readFileSync(tempPngPath);
    if (imageData[0] === 0x42 && imageData[1] === 0x4D) {
      // It's BMP - convert to PNG
      fs.writeFileSync(tempBmpPath, imageData);
      try {
        const { execSync } = require('child_process');
        const convertScript = path.join(os.tmpdir(), `convert_${Date.now()}.ps1`);
        const scriptContent = `
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('${tempBmpPath.replace(/\\/g, '\\\\')}')
$bmp.Save('${tempPngPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
`;
        fs.writeFileSync(convertScript, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(scriptContent, 'utf8')]));
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${convertScript}"`, { encoding: 'utf8', timeout: 15000 });
        try { fs.unlinkSync(convertScript); } catch {}
        try { fs.unlinkSync(tempBmpPath); } catch {}
      } catch (e) {
        console.log('[OCR] BMP to PNG conversion failed:', e);
      }
    }

    console.log('[OCR] Image saved to:', tempPngPath);

    // Try Windows OCR CLI if available
    if (ocrBackend === 'windows') {
      const cliPath = await findWindowsOCLI();
      if (cliPath && fs.existsSync(cliPath)) {
        console.log('[OCR] Using Windows OCR CLI at:', cliPath);

        const { stdout, stderr } = await execAsync(
          `"${cliPath}" -l zh-Hans-CN "${tempPngPath}"`,
          { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' }
        );

        console.log('[OCR] CLI stdout:', stdout?.slice(0, 500));
        console.log('[OCR] CLI stderr:', stderr?.slice(0, 200));

        if (stdout && stdout.trim()) {
          fs.unlinkSync(tempPngPath);
          return {
            text: stdout.trim(),
            confidence: 0.85,
          };
        }
      }
    }

    // Try cloud OCR if provider is configured
    if (cloudProvider) {
      // Re-read after potential BMP to PNG conversion
      const imageDataAfter = fs.readFileSync(tempPngPath);
      const base64Image = imageDataAfter.toString('base64');

      // Verify it's a valid PNG
      const isPng = imageDataAfter[0] === 0x89 && imageDataAfter[1] === 0x50 && imageDataAfter[2] === 0x4E && imageDataAfter[3] === 0x47;
      console.log('[OCR] Image format check - PNG:', isPng, 'size:', imageDataAfter.length);

      const result = await performCloudOCR(base64Image, cloudProvider);
      if (result.text) {
        fs.unlinkSync(tempPngPath);
        return result;
      }
    }

    fs.unlinkSync(tempPngPath);
    return { text: '', confidence: 0 };
  } catch (error) {
    console.error('[OCR] OCR error:', error);
    return { text: '', confidence: 0 };
  }
}

/**
 * Terminate OCR service
 */
export async function terminateOCR(): Promise<void> {
  initialized = false;
  ocrBackend = 'none';
  console.log('[OCR] OCR service terminated');
}

/**
 * Parse raw OCR text to extract danmu elements
 */
export function parseOCRDanmu(rawText: string): CapturedDanmuRaw[] {
  const results: CapturedDanmuRaw[] = [];

  console.log('[OCR] parseOCRDanmu called with:', JSON.stringify(rawText.slice(0, 200)));

  // Model outputs one danmu per line, format is "username: content" or just "content"
  const lines = rawText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2) continue;

    // Find first colon to split username and content
    const colonIndex = trimmed.indexOf(':');

    if (colonIndex > 0 && colonIndex < trimmed.length - 1) {
      // Only split if it's a proper username:content format
      // Check that username is reasonable (mostly letters/numbers, no special chars except underscore/space)
      const usernamePart = trimmed.substring(0, colonIndex);
      const contentPart = trimmed.substring(colonIndex + 1).trim();

      // If username looks like part of content (e.g., "关注了你" or has no letters), skip
      const looksLikeUsername = /^[a-zA-Z一-龥][a-zA-Z0-9一-龥_\s]*$/.test(usernamePart);

      if (looksLikeUsername && contentPart.length > 0) {
        results.push({
          username: usernamePart.trim(),
          content: contentPart.trim(),
          type: 'normal',
          raw: trimmed,
        });
      }
    } else {
      // No colon - treat as standalone content
      results.push({
        username: '',
        content: trimmed,
        type: 'normal',
        raw: trimmed,
      });
    }
  }

  console.log('[OCR] parseOCRDanmu results:', results.length, 'items');
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
    /\d{3,}[元¥]/.test(text)
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
  if (text.length < 2 || text.length > 500) return false;
  const letterCount = text.replace(/[^a-zA-Z一-龥]/g, '').length;
  if (letterCount < 2) return false;
  return true;
}