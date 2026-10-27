import Schema from '@deepseek-ai/schemastery';
export const Config = Schema.object({
    workspaceRoot: Schema.string(),
    pythonPath: Schema.string().default('python'),
    latexEngine: Schema.union(['xelatex', 'tectonic']).default('xelatex'),
    buildTimeoutMs: Schema.number().default(300000),
    runTimeoutMs: Schema.number().default(600000),
});
