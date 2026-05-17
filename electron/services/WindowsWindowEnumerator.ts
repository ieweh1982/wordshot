/**
 * WindowsWindowEnumerator - Enumerate Windows windows including child windows
 *
 * Uses Windows API via PowerShell to find windows and their child windows.
 * This allows finding floating windows like Douyin's "互动消息区" that are
 * children of the main 直播伴侣 window.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { desktopCapturer } from 'electron';

const execAsync = promisify(exec);

export interface WindowInfo {
  hwnd: string;
  title: string;
  className: string;
  processName: string;
  rect: { x: number; y: number; width: number; height: number };
  isVisible: boolean;
  parentHwnd: string | null;
  level: number;
}

class WindowsWindowEnumerator {
  private static instance: WindowsWindowEnumerator | null = null;

  private constructor() {}

  public static getInstance(): WindowsWindowEnumerator {
    if (!WindowsWindowEnumerator.instance) {
      WindowsWindowEnumerator.instance = new WindowsWindowEnumerator();
    }
    return WindowsWindowEnumerator.instance;
  }

  /**
   * Get all windows using desktopCapturer (Electron's built-in method)
   */
  public async getDesktopCapturerWindows(): Promise<WindowInfo[]> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 150, height: 150 },
      });

      return sources.map((source) => ({
        hwnd: source.id,
        title: source.name,
        className: '',
        processName: source.name,
        rect: { x: 0, y: 0, width: 0, height: 0 },
        isVisible: true,
        parentHwnd: null,
        level: 0,
      }));
    } catch (error) {
      console.error('[WindowsWindowEnumerator] desktopCapturer error:', error);
      return [];
    }
  }

  /**
   * Get all windows with their child windows using PowerShell + Windows API
   * Writes script to temp file to avoid escaping issues
   */
  public async getAllWindows(): Promise<WindowInfo[]> {
    try {
      // Write PowerShell script to temp file to avoid escaping issues
      const scriptPath = path.join(os.tmpdir(), `ws_enum_${Date.now()}.ps1`);

      const script = `
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WindowEnumerator {
  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  public static List<IntPtr> GetChildWindows(IntPtr parent) {
    List<IntPtr> result = new List<IntPtr>();
    IntPtr child = GetWindow(parent, 5);
    while (child != IntPtr.Zero) {
      result.Add(child);
      child = GetWindow(child, 2);
    }
    return result;
  }
}
"@

$windows = @()
$visited = @{}

function Get-WindowInfo {
  param([IntPtr]$hwnd, [int]$level, [IntPtr]$parentHwnd)

  if ($visited.ContainsKey($hwnd.ToString())) { return }
  $visited[$hwnd.ToString()] = $true

  $titleBuilder = New-Object System.Text.StringBuilder 256
  $classBuilder = New-Object System.Text.StringBuilder 256
  [WindowEnumerator]::GetWindowText($hwnd, $titleBuilder, 256) | Out-Null
  [WindowEnumerator]::GetClassName($hwnd, $classBuilder, 256) | Out-Null

  $title = $titleBuilder.ToString()
  $className = $classBuilder.ToString()

  if ([string]::IsNullOrEmpty($title) -and $level -gt 0) { return }

  $rect = New-Object WindowEnumerator+RECT
  [WindowEnumerator]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top

  $processId = 0
  [WindowEnumerator]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null

  $isVisible = [WindowEnumerator]::IsWindowVisible($hwnd)

  $processName = ""
  if ($processId -gt 0) {
    try {
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if ($process) { $processName = $process.ProcessName }
    } catch {}
  }

  $script:windows += @{
    hwnd = $hwnd.ToString()
    title = $title
    className = $className
    processName = $processName
    rect = @{
      x = $rect.Left
      y = $rect.Top
      width = $width
      height = $height
    }
    isVisible = $isVisible
    parentHwnd = if ($parentHwnd -eq [IntPtr]::Zero) { $null } else { $parentHwnd.ToString() }
    level = $level
  }

  $children = [WindowEnumerator]::GetChildWindows($hwnd)
  foreach ($child in $children) {
    Get-WindowInfo -hwnd $child -level ($level + 1) -parentHwnd $hwnd
  }
}

[WindowEnumerator]::EnumWindows({
  param([IntPtr]$hwnd, [IntPtr]$lParam)
  Get-WindowInfo -hwnd $hwnd -level 0 -parentHwnd ([IntPtr]::Zero)
  return $true
}, [IntPtr]::Zero) | Out-Null

$windows | ConvertTo-Json -Depth 10
`;

      // Write with BOM for PowerShell compatibility
      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      const scriptBuffer = Buffer.concat([bom, Buffer.from(script, 'utf8')]);
      fs.writeFileSync(scriptPath, scriptBuffer);

      try {
        // Set UTF-8 encoding before running the script
        const { stdout } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & '${scriptPath}'"`,
          {
            maxBuffer: 10 * 1024 * 1024,
            encoding: 'utf8',
          }
        );

        console.log('[WindowsWindowEnumerator] PowerShell stdout length:', stdout?.length);
        console.log('[WindowsWindowEnumerator] PowerShell stdout preview:', stdout?.slice(0, 200));

        if (!stdout || stdout.trim() === '' || stdout.trim() === 'null') {
          console.log('[WindowsWindowEnumerator] Empty stdout');
          return [];
        }

        const result = JSON.parse(stdout.trim());
        const windows: WindowInfo[] = Array.isArray(result) ? result : [result];

        return windows.map((w) => ({
          hwnd: w.hwnd,
          title: w.title || '',
          className: w.className || '',
          processName: w.processName || '',
          rect: w.rect || { x: 0, y: 0, width: 0, height: 0 },
          isVisible: w.isVisible ?? true,
          parentHwnd: w.parentHwnd || null,
          level: w.level || 0,
        }));
      } finally {
        // Cleanup temp file
        try {
          fs.unlinkSync(scriptPath);
        } catch {}
      }
    } catch (error) {
      console.error('[WindowsWindowEnumerator] Error getting all windows:', error);
      return [];
    }
  }

  /**
   * Find windows that belong to a specific process name
   */
  public async findWindowsByProcess(processName: string): Promise<WindowInfo[]> {
    const allWindows = await this.getAllWindows();
    const filtered = allWindows.filter((w) =>
      w.processName.toLowerCase().includes(processName.toLowerCase())
    );
    return filtered;
  }

  /**
   * Find child windows of a specific window
   */
  public async findChildWindows(parentHwnd: string): Promise<WindowInfo[]> {
    const allWindows = await this.getAllWindows();
    return allWindows.filter((w) => w.parentHwnd === parentHwnd);
  }

  /**
   * Find windows by title pattern (supports partial match)
   */
  public async findWindowsByTitle(titlePattern: string): Promise<WindowInfo[]> {
    const allWindows = await this.getAllWindows();
    const pattern = titlePattern.toLowerCase();
    return allWindows.filter((w) =>
      w.title.toLowerCase().includes(pattern)
    );
  }

  /**
   * Find the 互动消息区 window specifically
   */
  public async findHudongWindow(): Promise<WindowInfo | null> {
    const allWindows = await this.getAllWindows();
    console.log('[findHudongWindow] Total windows:', allWindows.length);

    // Log all visible child windows to help debug
    const visibleChildWindows = allWindows.filter(w => w.isVisible && w.level > 0);
    console.log('[findHudongWindow] Visible child windows:', visibleChildWindows.length);
    visibleChildWindows.forEach((w, i) => {
      console.log(`  [${i}] title="${w.title}" process="${w.processName}" hwnd=${w.hwnd} level=${w.level}`);
    });

    // First try exact match for "互动消息区"
    let found = allWindows.find(
      (w) => w.title === '互动消息区' && w.isVisible && w.level > 0
    );
    if (found) {
      console.log('[findHudongWindow] Found exact match:', found.title);
      return found;
    }

    // Try contains match
    found = allWindows.find(
      (w) => w.title.includes('互动消息区') && w.isVisible
    );
    if (found) {
      console.log('[findHudongWindow] Found contains match:', found.title);
      return found;
    }

    // Try without Chinese - look for any child window of 直播伴侣 process that has a title
    const douyinWindows = allWindows.filter(w =>
      w.processName.includes('直播伴侣') && w.level > 0 && w.isVisible && w.title.length > 0
    );
    console.log('[findHudongWindow] Douyin child windows with title:', douyinWindows.length);
    if (douyinWindows.length > 0) {
      // Return the first one with a meaningful title
      const withTitle = douyinWindows.find(w => w.title.length > 2);
      if (withTitle) {
        console.log('[findHudongWindow] Returning first douyin child with title:', withTitle.title);
        return withTitle;
      }
    }

    // Return first visible child window with a non-empty title
    const firstWithTitle = visibleChildWindows.find(w => w.title.length > 2);
    if (firstWithTitle) {
      console.log('[findHudongWindow] Returning first visible child with title:', firstWithTitle.title);
      return firstWithTitle;
    }

    console.log('[findHudongWindow] No suitable window found');
    return null;
  }

  /**
   * Find the main 直播伴侣 window and all its child windows
   */
  public async findDouyinLiveWindows(): Promise<{
    mainWindow: WindowInfo | null;
    childWindows: WindowInfo[];
  }> {
    const allWindows = await this.getAllWindows();

    const mainWindow = allWindows.find(
      (w) =>
        w.title.toLowerCase().includes('直播伴侣') &&
        w.level === 0 &&
        w.isVisible
    );

    if (!mainWindow) {
      return { mainWindow: null, childWindows: [] };
    }

    const childWindows = allWindows.filter(
      (w) => w.parentHwnd === mainWindow.hwnd || w.hwnd === mainWindow.hwnd
    );

    const allDescendants = this.findAllDescendants(mainWindow.hwnd, allWindows);

    return {
      mainWindow,
      childWindows: [...childWindows, ...allDescendants],
    };
  }

  /**
   * Recursively find all descendant windows
   */
  private findAllDescendants(parentHwnd: string, allWindows: WindowInfo[]): WindowInfo[] {
    const children = allWindows.filter((w) => w.parentHwnd === parentHwnd);
    const result: WindowInfo[] = [...children];

    for (const child of children) {
      const descendants = this.findAllDescendants(child.hwnd, allWindows);
      result.push(...descendants);
    }

    return result;
  }

  /**
   * Get detailed window info for a specific HWND
   */
  public async getWindowDetails(hwnd: string): Promise<WindowInfo | null> {
    const allWindows = await this.getAllWindows();
    return allWindows.find((w) => w.hwnd === hwnd) || null;
  }

  /**
   * Take a screenshot of a specific window by HWND
   */
  public async captureWindow(hwnd: string): Promise<Buffer | null> {
    try {
      const scriptPath = path.join(os.tmpdir(), `ws_cap_${Date.now()}.ps1`);

      const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public class ScreenCapture {
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern IntPtr GetDC(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

  [DllImport("gdi32.dll")]
  public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

  [DllImport("gdi32.dll")]
  public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

  [DllImport("gdi32.dll")]
  public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

  [DllImport("gdi32.dll")]
  public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int wDest, int hDest, IntPtr hdcSrc, int xSrc, int ySrc, int rop);

  [DllImport("gdi32.dll")]
  public static extern bool DeleteDC(IntPtr hdc);

  [DllImport("gdi32.dll")]
  public static extern bool DeleteObject(IntPtr hObject);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  public static Image CaptureWindow(IntPtr hwnd) {
    RECT rect;
    GetWindowRect(hwnd, out rect);
    int width = rect.Right - rect.Left;
    int height = rect.Bottom - rect.Top;

    IntPtr hdcScreen = GetDC(IntPtr.Zero);
    IntPtr hdcMem = CreateCompatibleDC(hdcScreen);
    IntPtr hBitmap = CreateCompatibleBitmap(hdcScreen, width, height);
    IntPtr hOld = SelectObject(hdcMem, hBitmap);

    BitBlt(hdcMem, 0, 0, width, height, hdcScreen, rect.Left, rect.Top, 0x00CC0020);

    SelectObject(hdcMem, hOld);
    Image img = new Bitmap(hBitmap);

    DeleteObject(hBitmap);
    DeleteDC(hdcMem);
    ReleaseDC(IntPtr.Zero, hdcScreen);

    return img;
  }
}
"@

$hwnd = [IntPtr]::new(${hwnd})
$img = [ScreenCapture]::CaptureWindow($hwnd)
$ms = New-Object System.IO.MemoryStream
$img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
[Convert]::ToBase64String($ms.ToArray())
`;

      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      const scriptBuffer = Buffer.concat([bom, Buffer.from(script, 'utf8')]);
      fs.writeFileSync(scriptPath, scriptBuffer);

      try {
        const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
          maxBuffer: 50 * 1024 * 1024,
        });

        if (!stdout || stdout.trim() === '') {
          return null;
        }

        return Buffer.from(stdout.trim(), 'base64');
      } finally {
        try {
          fs.unlinkSync(scriptPath);
        } catch {}
      }
    } catch (error) {
      console.error('[WindowsWindowEnumerator] Error capturing window:', error);
      return null;
    }
  }

  /**
   * Take a screenshot of a specific region on screen
   */
  public async captureRegion(region: { x: number; y: number; width: number; height: number }): Promise<Buffer | null> {
    try {
      console.log('[captureRegion] Starting capture, region:', JSON.stringify(region));

      const scriptPath = path.join(os.tmpdir(), `ws_reg_${Date.now()}.ps1`);
      const outputPath = path.join(os.tmpdir(), `ws_cap_${Date.now()}.png`);

      const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.IO;
using System.Drawing;

public class ScreenCapture {
    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int wDest, int hDest, IntPtr hdcSrc, int xSrc, int ySrc, int rop);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll")]
    public static extern int GetDIBits(IntPtr hdc, IntPtr hbmp, uint uStartScan, uint cScanLines, byte[] lpvBits, ref BITMAPINFO lpbi, uint uUsage);

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFOHEADER {
        public uint biSize;
        public int biWidth;
        public int biHeight;
        public ushort biPlanes;
        public ushort biBitCount;
        public uint biCompression;
        public uint biSizeImage;
        public int biXPelsPerMeter;
        public int biYPelsPerMeter;
        public uint biClrUsed;
        public uint biClrImportant;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFO {
        public BITMAPINFOHEADER bmiHeader;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 1)]
        public uint[] bmiColors;
    }

    public static void Capture(int x, int y, int width, int height, string filePath) {
        IntPtr hdcScreen = GetDC(IntPtr.Zero);
        IntPtr hdcMem = CreateCompatibleDC(hdcScreen);
        IntPtr hBitmap = CreateCompatibleBitmap(hdcScreen, width, height);
        IntPtr hOld = SelectObject(hdcMem, hBitmap);

        BitBlt(hdcMem, 0, 0, width, height, hdcScreen, x, y, 0x00CC0020);

        SelectObject(hdcMem, hOld);

        var bmi = new BITMAPINFO();
        bmi.bmiHeader.biSize = 40;
        bmi.bmiHeader.biWidth = width;
        bmi.bmiHeader.biHeight = -height;
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = 0;

        var pixels = new byte[width * height * 4];
        GetDIBits(hdcMem, hBitmap, 0, (uint)height, pixels, ref bmi, 0);

        using (var fs = new FileStream(filePath, FileMode.Create)) {
            var bw = new BinaryWriter(fs);
            bw.Write((ushort)0x4D42);
            bw.Write(54 + pixels.Length);
            bw.Write(0);
            bw.Write(54);
            bw.Write(40);
            bw.Write(width);
            bw.Write(-height);
            bw.Write((short)1);
            bw.Write((short)32);
            bw.Write(0);
            bw.Write(pixels.Length);
            bw.Write(0);
            bw.Write(0);
            bw.Write(0);
            bw.Write(0);
            bw.Write(pixels);
        }

        DeleteObject(hBitmap);
        DeleteDC(hdcMem);
        ReleaseDC(IntPtr.Zero, hdcScreen);
    }
}
"@

$x = ${region.x}
$y = ${region.y}
$w = ${region.width}
$h = ${region.height}
$outPath = "${outputPath.replace(/\\/g, '\\\\')}"
[ScreenCapture]::Capture($x, $y, $w, $h, $outPath)
Write-Output "OK"
`;

      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      const scriptBuffer = Buffer.concat([bom, Buffer.from(script, 'utf8')]);
      fs.writeFileSync(scriptPath, scriptBuffer, { encoding: 'utf8' });

      try {
        console.log('[captureRegion] Executing PowerShell script');

        const { stdout, stderr } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
          {
            maxBuffer: 10 * 1024 * 1024,
            encoding: 'utf8',
          }
        );

        console.log('[captureRegion] PowerShell stdout:', stdout);
        console.log('[captureRegion] PowerShell stderr:', stderr?.slice(0, 200));

        if (!stdout.includes('OK')) {
          console.log('[captureRegion] Script did not complete successfully');
          return null;
        }

        // Read the PNG file
        if (!fs.existsSync(outputPath)) {
          console.log('[captureRegion] Output file not found:', outputPath);
          return null;
        }

        const buffer = fs.readFileSync(outputPath);
        console.log('[captureRegion] Captured buffer size:', buffer.length);

        // Cleanup
        try {
          fs.unlinkSync(outputPath);
        } catch {}

        return buffer;
      } finally {
        try {
          fs.unlinkSync(scriptPath);
        } catch {}
      }
    } catch (error) {
      console.error('[WindowsWindowEnumerator] Error capturing region:', error);
      return null;
    }
  }

  /**
   * Perform OCR using Windows.Media.Ocr via PowerShell
   * Fallback when tesseract.js doesn't work in Electron
   */
  public async performOCROnRegion(region: { x: number; y: number; width: number; height: number }): Promise<{ text: string; confidence: number } | null> {
    try {
      console.log('[WindowsOCR] Starting OCR on region');

      const screenshotPath = path.join(os.tmpdir(), `ocr_screenshot_${Date.now()}.png`);
      const scriptPath = path.join(os.tmpdir(), `ocr_capture_${Date.now()}.ps1`);

      const captureScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public class CaptureHelper {
    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int wDest, int hDest, IntPtr hdcSrc, int xSrc, int ySrc, int rop);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll")]
    public static extern int GetDIBits(IntPtr hdc, IntPtr hbmp, uint uStartScan, uint cScanLines, byte[] lpvBits, ref BITMAPINFO lpbi, uint uUsage);

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFOHEADER {
        public uint biSize;
        public int biWidth;
        public int biHeight;
        public ushort biPlanes;
        public ushort biBitCount;
        public uint biCompression;
        public uint biSizeImage;
        public int biXPelsPerMeter;
        public int biYPelsPerMeter;
        public uint biClrUsed;
        public uint biClrImportant;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFO {
        public BITMAPINFOHEADER bmiHeader;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 1)]
        public uint[] bmiColors;
    }

    public static void Capture(int x, int y, int width, int height, string filePath) {
        IntPtr hdcScreen = GetDC(IntPtr.Zero);
        IntPtr hdcMem = CreateCompatibleDC(hdcScreen);
        IntPtr hBitmap = CreateCompatibleBitmap(hdcScreen, width, height);
        IntPtr hOld = SelectObject(hdcMem, hBitmap);

        BitBlt(hdcMem, 0, 0, width, height, hdcScreen, x, y, 0x00CC0020);

        SelectObject(hdcMem, hOld);

        var bmi = new BITMAPINFO();
        bmi.bmiHeader.biSize = 40;
        bmi.bmiHeader.biWidth = width;
        bmi.bmiHeader.biHeight = -height;
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = 0;

        var pixels = new byte[width * height * 4];
        GetDIBits(hdcMem, hBitmap, 0, (uint)height, pixels, ref bmi, 0);

        using (var fs = new FileStream(filePath, FileMode.Create)) {
            var bw = new BinaryWriter(fs);
            bw.Write((ushort)0x4D42);
            bw.Write(54 + pixels.Length);
            bw.Write(0);
            bw.Write(54);
            bw.Write(40);
            bw.Write(width);
            bw.Write(-height);
            bw.Write((short)1);
            bw.Write((short)32);
            bw.Write(0);
            bw.Write(pixels.Length);
            bw.Write(0);
            bw.Write(0);
            bw.Write(0);
            bw.Write(0);
            bw.Write(pixels);
        }

        DeleteObject(hBitmap);
        DeleteDC(hdcMem);
        ReleaseDC(IntPtr.Zero, hdcScreen);
    }
}
"@

[CaptureHelper]::Capture(${region.x}, ${region.y}, ${region.width}, ${region.height}, "${screenshotPath.replace(/\\/g, '\\\\')}")
Write-Output "CAPTURED:${screenshotPath}"
`;

      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      const scriptBuffer = Buffer.concat([bom, Buffer.from(captureScript, 'utf8')]);
      fs.writeFileSync(scriptPath, scriptBuffer, { encoding: 'utf8' });

      try {
        const { stdout } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
          { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' }
        );

        if (!stdout.includes('CAPTURED:')) {
          console.log('[WindowsOCR] Capture failed');
          return null;
        }

        console.log('[WindowsOCR] Screenshot captured');
        return { text: 'OCR functionality temporarily unavailable', confidence: 0 };
      } finally {
        try { fs.unlinkSync(scriptPath); } catch {}
        try { fs.unlinkSync(screenshotPath); } catch {}
      }
    } catch (error) {
      console.error('[WindowsOCR] Error:', error);
      return null;
    }
  }
}

export default WindowsWindowEnumerator;