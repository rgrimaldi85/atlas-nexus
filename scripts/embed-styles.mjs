import fs from 'node:fs';
import path from 'node:path';

const out=path.resolve('dist/atlas-nexus/browser');
const indexPath=path.join(out,'index.html');
const cssPath=path.join(out,'styles.css');
const html=fs.readFileSync(indexPath,'utf8');
const css=fs.readFileSync(cssPath,'utf8');

const mustInclude=[
 ['app flex layout','.atlas-app'],
 ['desktop navigation','.desktop-sidebar'],
 ['login hiding','.is-locked'],
 ['mobile breakpoints','@media'],
 ['PrimeNG cards','.p-card'],
 ['login grid','.login-layout']
];
for(const [name,pattern] of mustInclude){
 if(!css.includes(pattern))throw new Error('ATLAS CSS FAIL: '+name+' ('+pattern+') missing');
}
if(css.length<12000)throw Error('ATLAS CSS FAIL: stylesheet unexpectedly small ('+css.length+' bytes)');
if(!html.includes('</head>')||!html.includes('<app-root'))throw Error('ATLAS HTML FAIL: missing head or Angular entrypoint');
const marker='data-atlas-embedded="v3.1"';
if(html.includes(marker))throw Error('ATLAS HTML FAIL: CSS is already embedded');
const inline='<style '+marker+'>'+css.replace(/<\/style/gi,'<\\/style')+'</style>';
// Inline the entire Angular-produced global CSS: no network request required for
// layout, iPhone media queries, PrimeIcons, or PrimeNG overrides.
// The original stylesheet link is retained only as a harmless fallback.
const output=html.replace('</head>',inline+'</head>');
fs.writeFileSync(indexPath,output,'utf8');
const reread=fs.readFileSync(indexPath,'utf8');
if(!reread.includes(marker)||!reread.includes('.desktop-sidebar')||!reread.includes('@media')){
 throw Error('ATLAS CSS FAIL: written index missing validated rules');
}
console.log('ATLAS STYLE EMBEDDING PASS: '+css.length+' stylesheet bytes inlined, '+output.length+' index bytes, 6 layout checks passed');
