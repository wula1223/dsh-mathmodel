import Schema from '@deepseek-ai/schemastery';
export interface Config {
    /** 工作区根目录；留空则用会话工作目录 */
    workspaceRoot?: string;
    /** Python 解释器 */
    pythonPath: string;
    /** LaTeX 编译器 */
    latexEngine: 'xelatex' | 'tectonic';
    /** 每趟编译超时（毫秒） */
    buildTimeoutMs: number;
    /** mm 求解脚本默认超时（毫秒） */
    runTimeoutMs: number;
}
export declare const Config: Schema<Config>;
