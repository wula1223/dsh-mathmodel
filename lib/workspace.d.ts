/**
 * 工作区 —— 目录结构遵循内置规范的「项目结构」一节。
 *
 * 为什么目录名用中文：
 *   规范要求「代码、图、CSV、tex 文件一律中文命名」，目录也是中文。
 *   改成英文会破坏与模板的兼容（模板里 \input{5.1.问题1的建立求解.tex} 是中文名），
 *   所以插件不做任何本地化改造，原样保留。
 *
 * 目录：
 *   题目/     赛题文件（PDF/DOCX）
 *   数据/     附件数据（xlsx/docx/csv）
 *   求解/     AI 自动生成：求解计划.md、问题一/…、问题N/
 *   论文/     AI 自动生成：论文.tex + 17 个章节 tex + format.cls + fonts
 */
import type { Config } from './config.js';
export declare const DIRS: {
    readonly problem: "题目";
    readonly data: "数据";
    readonly solve: "求解";
    readonly paper: "论文";
};
export declare const PLAN_FILE = "\u6C42\u89E3/\u6C42\u89E3\u8BA1\u5212.md";
export declare const MAIN_TEX = "\u8BBA\u6587/\u8BBA\u6587.tex";
/** 定位本包内随附的模板目录（lib/ 与 templates/ 同级） */
export declare function templateDir(): string;
/** 定位本包内随附的方法文档 */
export declare function methodDocPath(): string;
/** 解析工作区根：优先 config.workspaceRoot，其次传入的 base，最后当前目录 */
export declare function resolveWorkspace(config: Config, base?: string): string;
/** 递归复制目录 */
export declare function copyDir(src: string, dst: string): Promise<number>;
/** 判断路径是否存在 */
export declare function exists(p: string): Promise<boolean>;
/** 列出目录下的文件（不存在则空数组） */
export declare function listFiles(dir: string): Promise<string[]>;
/** 列出子目录名（不存在则空数组） */
export declare function listDirs(dir: string): Promise<string[]>;
export interface InitResult {
    workspace: string;
    created: string[];
    skipped: string[];
    templateFiles: number;
}
/**
 * 建 数学建模工作区：题目/、数据/、求解/、论文/（含完整模板）。
 * 幂等：已存在的目录不覆盖；论文模板文件已存在则跳过，不冲掉用户内容。
 */
export declare function initWorkspace(config: Config, opts?: {
    dir?: string;
    force?: boolean;
}): Promise<InitResult>;
export interface WorkspaceStatus {
    workspace: string;
    problems: string[];
    dataFiles: string[];
    hasPlan: boolean;
    questionDirs: string[];
    paperFiles: string[];
    hasPdf: boolean;
    mainTexExists: boolean;
}
/** 扫工作区现状 */
export declare function inspectWorkspace(ws: string): Promise<WorkspaceStatus>;
