import type { Context } from '@deepseek-ai/cordis';
/**
 * 把内置的论文规范文档注册为随包 skill。
 *
 * 关键决策：内容不改。
 *   这份 30KB 是完整的数学建模方法层——摘要字数分配、longtable 列宽公式、
 *   9 框流程图模板、各题型建模步骤划分，都在里面。
 *
 * 为什么用 resourceBase 指向文件而不是把全文塞进 content：
 *   skill 目录常驻的只有 name + description（决定路由），全文按需读取。
 *   30KB 常驻会挤占上下文，而绝大多数请求并不需要全文。
 */
export declare const SKILL_NAME = "mathmodel";
export declare const SKILL_DESCRIPTION = "\u6570\u5B66\u5EFA\u6A21\u7ADE\u8D5B\u5168\u6D41\u7A0B\uFF1A\u8BFB\u9898\u2192\u6C42\u89E3\u8BA1\u5212\u2192\u9010\u9898\u6C42\u89E3\u2192\u5199\u8BBA\u6587\u2192\u7F16\u8BD1 PDF\u3002\u542B\u8BBA\u6587\u89C4\u8303\uFF08\u6458\u8981\u2264900\u5B571\u9875\u3001longtable\u5217\u5BBD\u516C\u5F0F\u3001\u6D41\u7A0B\u56FE\u56FA\u5B9A\u6A21\u677F\u3001\u5404\u9898\u578B\u5EFA\u6A21\u6B65\u9AA4\uFF09\u4E0E Python \u7ED8\u56FE\u89C4\u8303\u3002Use when the user gives a contest problem (\u9898\u76EE/\u6570\u636E files) and asks to solve it, or when writing/revising a \u6570\u5B66\u5EFA\u6A21 paper, or when deciding \u6458\u8981\u5B57\u6570\u5206\u914D / \u8868\u683C\u5217\u5BBD / \u56FE\u8868\u89C4\u8303 / \u7AE0\u8282\u7ED3\u6784.";
/** 读取方法文档全文 */
export declare function readMethodDoc(): Promise<string>;
/**
 * 通过宿主官方 skill seam（ctx.skills）注册。
 * 组合里没有 skills 服务时静默降级——工具侧不受影响。
 */
export declare function registerSkills(ctx: Context): () => void;
/** 模板目录下的文件清单（供 mr_template 检查完整性） */
export declare function listTemplates(): Promise<string[]>;
/** 读取模板文件内容（相对 templates/ 的路径） */
export declare function readTemplate(rel: string): Promise<string>;
