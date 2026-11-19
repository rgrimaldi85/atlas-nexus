import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import {chromium} from 'playwright';

const PORT=4173, CODE='visual-test-not-a-real-passcode';
const app=express();
app.use(express.json());
const days=Array.from({length:32},(_,i)=>{
 const d=new Date(Date.UTC(2026,10,i+1)).toISOString().slice(0,10);
 return {date:d,steps:6500+i*130,sleep:7.1+(i%3)*.3,hrv:35+i%7,rhr:60+i%5,
 weight:81.5+i*.03,kcal:2450,protein:155,workout:i%3===0?1:0,atlasDone:i%3===0?1:0,
 nicotine:0,alcohol:0,event:''};
});
const data={lastRefresh:new Date().toISOString(),days,mood:[
 {date:'2026-11-19',happiness:6,calm:5,energy:7,connection:5,stress:3,motivation:8}
],hypotheses:[{id:'H-TEST',topic:'Test automatico',text:'Dati sintetici di test',state:'TEST',confidence:'Non reale',next:'N/A'}],
 events:[{date:'2026-11-15',event:'Evento sintetico di test',category:'TEST',confidence:'simulato',note:''}],
 sourceDates:{TEST:'2026-11-19'}};
app.get('/api/dashboard',(req,res)=>{
 if(!(req.headers.cookie||'').includes('atlas_test=1'))return res.status(401).json({error:'Login required'});
 res.json(data);
});
app.post('/api/session',(req,res)=>{
 if(req.body?.passcode!==CODE)return res.status(401).json({error:'Invalid'});
 res.cookie('atlas_test','1',{httpOnly:true,sameSite:'lax'}).json({ok:true});
});
app.delete('/api/session',(_req,res)=>res.clearCookie('atlas_test').json({ok:true}));
app.use(express.static('dist/atlas-nexus/browser'));
app.get(/.*/,(req,res)=>res.sendFile('index.html',{root:'dist/atlas-nexus/browser'}));
const server=await new Promise(resolve=>{const s=app.listen(PORT,'127.0.0.1',()=>resolve(s))});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
fs.mkdirSync('test-artifacts',{recursive:true});
const failures=[];
function check(value,message){assert.ok(value,message);console.log('PASS: '+message)}
async function suite(label,viewport){
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'networkidle',timeout:20000});
 await page.locator('.login-card h2').waitFor({timeout:12000});
 const pre=await page.evaluate(()=>{
 const $=s=>document.querySelector(s),css=s=>getComputedStyle($(s));
 return {
 inlineStyles:!!document.querySelector('style[data-atlas-embedded="v3.1"]'),
 sideHidden:css('.desktop-sidebar').display==='none',
 layout:css('.login-layout').display,
 storyGradient:css('.login-story').backgroundImage,
 storyFont:parseFloat(css('.login-story h1').fontSize),
 loginRadius:parseFloat(css('.login-card').borderTopLeftRadius),
 overflow:document.documentElement.scrollWidth-window.innerWidth
 };
 });
 console.log(label+' LOGIN COMPUTED '+JSON.stringify(pre));
 check(pre.inlineStyles,label+' production CSS embedded in HTML');
 check(pre.sideHidden,label+' desktop navigation hidden during login');
 check(pre.layout==='grid',label+' login uses grid layout');
 check(pre.storyGradient.includes('gradient'),label+' designed login gradient visible');
 check(pre.loginRadius>=18,label+' rounded PrimeNG card styling');
 check(pre.overflow<=3,label+' no unintended horizontal overflow at login');
 await page.screenshot({path:'test-artifacts/'+label+'-login.png',fullPage:true});
 await page.locator('#secret input, input#secret').first().fill(CODE);
 const responses=[];page.on('response',response=>{if(response.url().includes('/api/'))responses.push({url:response.url(),status:response.status()})});
 await page.getByRole('button',{name:/Accedi ad ATLAS/}).click();
 try{await page.locator('.hero-kpi').first().waitFor({timeout:12000})}catch(e){
  console.error('LOGIN DIAGNOSTICS',JSON.stringify({responses,errors,body:(await page.locator('body').innerText()).slice(0,1300),cookie:await page.context().cookies('http://127.0.0.1:'+PORT)}));
  await page.screenshot({path:'test-artifacts/'+label+'-login-failure.png',fullPage:true});
  throw e;
 }
 const after=await page.evaluate(()=>{
 const css=s=>getComputedStyle(document.querySelector(s));
 const side=document.querySelector('.desktop-sidebar');
 const mob=document.querySelector('.mobile-trigger');
 return {sideDisplay:css('.desktop-sidebar').display,sidebarBg:css('.desktop-sidebar').backgroundImage,
 mobileTrigger:mob?getComputedStyle(mob).display:'missing',
 cards:document.querySelectorAll('.hero-kpi').length,
 grid:css('.hero-kpi-grid').display,
 overflow:document.documentElement.scrollWidth-window.innerWidth};
 });
 console.log(label+' DASHBOARD COMPUTED '+JSON.stringify(after));
 if(after.overflow>3){
  const offenders=await page.evaluate(()=>[...document.querySelectorAll('body *')].map(el=>{
   const r=el.getBoundingClientRect();return {tag:el.tagName,cls:String(el.className).slice(0,130),right:Math.round(r.right),width:Math.round(r.width),left:Math.round(r.left),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
  }).filter(x=>x.right>window.innerWidth+2||x.left< -2).sort((a,b)=>b.right-a.right).slice(0,24));
  console.error(label+' MOBILE OVERFLOW ELEMENTS '+JSON.stringify(offenders));
  await page.screenshot({path:'test-artifacts/'+label+'-dashboard-overflow.png',fullPage:true});
 }
 check(after.grid==='grid',label+' KPI grid layout applied');
 check(after.cards===4,label+' four KPI cards rendered');
 check(after.overflow<=3,label+' no unintended horizontal overflow on dashboard');
 if(label==='mobile'){
  check(after.sideDisplay==='none',label+' desktop sidebar hidden');
  check(after.mobileTrigger!=='none',label+' mobile navigation trigger visible');
  await page.locator('.mobile-trigger').click();
  await page.locator('.p-drawer').waitFor({timeout:5000});
  check(await page.locator('.p-drawer').isVisible(),label+' PrimeNG drawer opens');
  await page.screenshot({path:'test-artifacts/mobile-menu.png',fullPage:true});
  await page.locator('.p-drawer').getByRole('button',{name:'Health'}).click();
 }else{
  check(after.sideDisplay==='flex',label+' desktop sidebar visible as flex');
  check(after.sidebarBg.includes('gradient'),label+' dark gradient sidebar applied');
  await page.locator('.desktop-sidebar').getByRole('button',{name:'Health'}).click();
 }
 await page.locator('.streak-grid .p-card').first().waitFor({timeout:10000});
 check(await page.locator('.streak-grid .p-card').count()===3,label+' Health cards rendered');
 await page.screenshot({path:'test-artifacts/'+label+'-health.png',fullPage:true});
 check(errors.length===0,label+' no JavaScript page errors: '+JSON.stringify(errors));
 await page.close();
}

async function liveLogin(label,viewport){
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 await page.goto('https://atlas-nexus.onrender.com/',{waitUntil:'domcontentloaded',timeout:100000});
 await page.locator('.login-card h2').waitFor({timeout:35000});
 const values=await page.evaluate(()=>{
  const style=s=>getComputedStyle(document.querySelector(s));
  return {
   inline:!!document.querySelector('style[data-atlas-embedded="v3.1"]'),
   sidebar:style('.desktop-sidebar').display,
   grid:style('.login-layout').display,
   gradient:style('.login-story').backgroundImage,
   italic:style('.login-story h1 em').fontStyle,
   cardRadius:parseFloat(style('.login-card').borderTopLeftRadius),
   overflow:document.documentElement.scrollWidth-window.innerWidth
  };
 });
 console.log('RENDER LIVE '+label+' CSS COMPUTED '+JSON.stringify(values));
 check(values.inline,'LIVE '+label+' embedded styles present');
 check(values.sidebar==='none','LIVE '+label+' sidebar hidden during login');
 check(values.grid==='grid','LIVE '+label+' login grid');
 check(values.gradient.includes('gradient'),'LIVE '+label+' design gradient applied');
 check(values.italic==='normal','LIVE '+label+' custom heading style applied');
 check(values.cardRadius>=18,'LIVE '+label+' PrimeNG card radius');
 check(values.overflow<=3,'LIVE '+label+' no horizontal overflow');
 await page.screenshot({path:'test-artifacts/live-'+label+'-login.png',fullPage:true});
 await page.close();
}
try{
 await liveLogin('mobile',{width:390,height:844});
 await liveLogin('desktop',{width:1440,height:900});
 await suite('mobile',{width:390,height:844});
 await suite('desktop',{width:1440,height:900});
 console.log('ATLAS BROWSER VISUAL SMOKE PASS: mobile and desktop computed layout and screenshots');
}catch(e){console.error('VISUAL SMOKE FAILED',e);process.exitCode=1}
finally{await browser.close();await new Promise(r=>server.close(r))}
