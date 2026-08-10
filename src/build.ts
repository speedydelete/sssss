
import {isAbsolute, join} from 'node:path';
import * as fs from 'node:fs';
import {execSync} from 'node:child_process';

import * as esbuild from 'esbuild';
import minifyLibrary from '@minify-html/node';
let minifyHTML = minifyLibrary.minify;


let devMode = process.argv.includes('dev');

const BASE_PATH = join(import.meta.dirname, '..');

function path(value: string): string {
    return isAbsolute(value) ? value : join(BASE_PATH, value);
}

function exists(file: string): boolean {
    return fs.existsSync(path(file));
}

async function read(file: string): Promise<string> {
    return (await fs.promises.readFile(path(file))).toString('utf-8');
}

async function write(file: string, data: Parameters<(typeof fs)['promises']['writeFile']>[1]): Promise<void> {
    await fs.promises.writeFile(path(file), data);
}

async function mkdir(file: string): Promise<void> {
    await fs.promises.mkdir(path(file));
}



const ESBUILD_OPTIONS: esbuild.BuildOptions = {
    bundle: true,
    format: 'esm',
    target: ['chrome85', 'edge85', 'safari14.1', 'firefox77', 'opera71'],
    sourcemap: devMode ? 'inline' : false,
    keepNames: devMode,
    external: ['node:path'],
    treeShaking: true,
    minifyIdentifiers: !devMode,
    minifyWhitespace: true,
    minifySyntax: true,
    plugins: [
        {
            name: 'lifeweb-alias',
            setup(build) {
                build.onResolve({filter: /\/lifeweb\/lib\/index\.js$/}, () => ({path: '../lifeweb.js', external: true}));
            }
        }
    ],
};

const MINIFY_HTML_OPTIONS: Parameters<typeof minifyHTML>[1] = {
    keep_html_and_head_opening_tags: true,
    minify_css: true,
    minify_js: true,
};

execSync(`${process.argv[0]} ${path('node_modules/.bin/tsc')} -b`);

if (!exists('website')) {
    await mkdir('website');
}

await write('website/index.html', minifyHTML(Buffer.from(await read('src/website.html'), 'utf-8'), MINIFY_HTML_OPTIONS));

await esbuild.build({
    ...ESBUILD_OPTIONS,
    entryPoints: [path('src/website.ts')],
    outfile: path('website/index.js'),
});
