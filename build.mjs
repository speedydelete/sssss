
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import * as esbuild from 'esbuild';
import minify from '@minify-html/node';


function path(value) {
    return join(import.meta.dirname, value);
}


execSync(`${process.argv[0]} ${path('node_modules/bin/tsc')} -b`);

let html = await fs.readFile('src/website.html');
await fs.writeFile(path('website/index.html'), minify.minify(Buffer.from(html, 'utf-8'), {
    keep_html_and_head_opening_tags: true,
    minify_css: true,
    minify_js: true,
}));

await esbuild.build({
    entryPoints: [path('src/website.ts')],
    bundle: true,
    outfile: path('website/index.js'),
    format: 'esm',
    sourcemap: true,
    target: ['chrome85', 'edge85', 'safari14.1', 'firefox77', 'opera71'],
    external: ['node:path'],
    treeShaking: true,
    minify: true,
    plugins: [
        {
            name: 'lifeweb-alias',
            setup(build) {
                build.onResolve({filter: /\/lifeweb\/lib\/index\.js$/}, () => ({path: '../lifeweb.js', external: true}));
            }
        }
    ]
});
