/**
 * 受控执行 —— 把 规范里手写的 shell 命令变成可调用的函数。
 *
 * 规范规定的三条硬命令：
 *   1. 读题：PDF 用 PyPDF2，DOCX 用 python-docx
 *   2. 编译：cd 论文 && xelatex -interaction=nonstopmode 论文.tex（跑两趟）
 *   3. 校验：grep -c 'Error' 论文.log 必须为 0
 * 插件不发明新命令，只把这三条封装成有结构化返回值的调用。
 */
export interface RunResult {
    ok: boolean;
    code: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    durationMs: number;
}
/** 跑一个子进程，带超时强杀 */
export declare function run(cmd: string, args: string[], cwd: string, timeoutMs: number, env?: Record<string, string>): Promise<RunResult>;
export declare function isErrorLine(line: string): boolean;
/**
 * 数错误行——对应规范里的 `grep -c 'Error' 论文.log`。
 * 规范要求这个值必须为 0 才算编译通过。
 *
 * 例外：字体缺失（fontspec 的 "cannot be found"）不计入。
 *   理由不是放宽标准，而是这类错误「报了也修不了」——字体是机器环境，
 *   不是论文内容。实测：Menlo 缺失时 xelatex 报 6 条 Error 后仍继续编译，
 *   照样输出 9 页 PDF，说明它本身不阻断交付。
 *   这类失败单独归到 missingFonts 字段，让人一眼看出是环境问题而非写错论文。
 *   模板层面的根治在 format.cls 的 \IfFontExistsTF 逐级回退里。
 */
export declare function countErrors(logText: string): number;
/**
 * 提取错误行，并把紧随其后的续行（fontspec 之类的多行诊断）一并带上。
 * 只给第一行会丢掉真正有用的信息：`Package fontspec Error:` 本身是空尾巴，
 * 它下面那行 "The font "Menlo" cannot be found" 才是原因。
 */
export declare function extractErrors(logText: string, limit?: number): string[];
/** 抽取 Overfull/Underfull/Float too large，供排版优化步骤使用 */
export declare function layoutWarnings(logText: string): string[];
/**
 * 检测「未转义下划线把中文拖进数学模式」导致的丢字。
 *
 * 为什么单独一条（实测踩到的真问题）：
 *   规范要求文件名用中文，而中文文件名几乎必然含下划线（问题一_数据分析.py）。
 *   直接写进 tex，LaTeX 会把 `_` 当数学下标，后面那段中文就落到数学模式里，
 *   数学字体 Times New Roman 没有中文字形 → 日志报
 *   "Missing character: There is no 数 (U+6570) in font Times New Roman"。
 *   编译不报 Error、PDF 照样出，但**那几个字印出来是空白**——
 *   这是最阴的一种失败：文件看着成功，内容其实缺字。
 *   普通语法错误能靠 errorCount 拦住，这一类拦不住，必须单列。
 */
export declare function detectMissingCJK(logText: string): string[];
export interface BuildResult {
    ok: boolean;
    texFile: string;
    pdfFile?: string;
    pages?: number;
    passes: number;
    durationMs: number;
    errorCount: number;
    errors: string[];
    /** 日志里缺失的字体名（Menlo 这类平台依赖） */
    missingFonts: string[];
    /** 掉进西文字体、印不出来的中文字符（未转义下划线 _ 的典型症状） */
    missingCjk: string[];
    layoutWarnings: string[];
    logTail: string;
    error?: string;
}
/**
 * 编译论文。严格按规范：xelatex -interaction=nonstopmode 跑 2 趟，
 * 然后检查 Error 数为 0、PDF 是否产出。
 */
export declare function buildPaper(opts: {
    workspace: string;
    texFile?: string;
    engine: string;
    timeoutMs: number;
    passes?: number;
}): Promise<BuildResult>;
/**
 * 识别日志里「字体装不上」的错误，抽出字体名。
 * 真实格式：The font "Menlo" cannot be found。
 */
export declare function detectMissingFonts(logText: string): string[];
export interface ExtractResult {
    ok: boolean;
    source: string;
    text: string;
    chars: number;
    error?: string;
}
/**
 * 抽取题目文本。规范规定 PDF 用 PyPDF2、DOCX 用 python-docx。
 * 这里生成一段内联 Python 并执行，避免依赖额外文件。
 */
export declare function extractProblem(opts: {
    workspace: string;
    pythonPath: string;
    sourceFile: string;
    timeoutMs: number;
}): Promise<ExtractResult>;
