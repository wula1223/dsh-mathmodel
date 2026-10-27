import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.js';
/**
 * mr_init：建工作区。
 * 对应规范「新题使用」第 1-3 步：复制模板 → 题目放 题目/ → 数据放 数据/。
 */
export declare function registerInitTool(ctx: Context, config: Config): void;
/**
 * mr_status：看工作区现状，对应 CLAUDE.md Step 0 的「打印数据总览」。
 */
export declare function registerStatusTool(ctx: Context, config: Config): void;
/**
 * mr_problem：抽题目原文。对应 CLAUDE.md Step 0「读 题目/（PDF用PyPDF2，DOCX用python-docx）」。
 */
export declare function registerProblemTool(ctx: Context, config: Config): void;
/**
 * mr_run：跑一个求解脚本。对应 CLAUDE.md Step 2「每问一个 py 文件」。
 */
export declare function registerRunTool(ctx: Context, config: Config): void;
/**
 * mr_build：编译论文。对应 CLAUDE.md Step 4：
 * xelatex -interaction=nonstopmode 论文.tex，跑两趟，grep -c Error 必须为 0。
 */
export declare function registerBuildTool(ctx: Context, config: Config): void;
/**
 * mr_method：取内置的方法规范原文。
 * 这是「原样封装」的体现——规范不经过任何改写。
 */
export declare function registerMethodTool(ctx: Context): void;
/**
 * mr_template：查看/读取论文模板。对应「复制 模板/ 到工作目录」。
 */
export declare function registerTemplateTool(ctx: Context): void;
