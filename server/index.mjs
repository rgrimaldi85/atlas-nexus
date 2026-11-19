import 'dotenv/config';
import express from 'express';
import {google} from 'googleapis';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'4kb'}));
const PORT=Number(process.env.PORT||8080), ACCESS=process.env.ATLAS_ACCESS_CODE, SECRET=process.env.ATLAS_SESSION_SECRET;
const NEXUS=process.env.NEXUS_SHEET_ID,MIND=process.env.MIND_SHEET_ID;
if(!ACCESS||ACCESS.length<16||!SECRET||SECRET.length<32)throw Error('Missing ATLAS_ACCESS_CODE or ATLAS_SESSION_SECRET');
app.set('trust proxy',1);app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});next()});
const attempts=new Map(),cookieName='atlas_session',ttl=7*86400000;
function sign(body){return crypto.createHmac('sha256',SECRET).update(body).digest('base64url')}
function createToken(){const body=Buffer.from(JSON.stringify({exp:Date.now()+ttl,id:crypto.randomBytes(8).toString('hex')})).toString('base64url');return body+'.'+sign(body)}
function readCookie(req){return (req.headers.cookie||'').split(';').map(x=>x.trim().split('=')).find(x=>x[0]===cookieName)?.[1]}
function valid(req){try{const t=readCookie(req);if(!t)return false;const [body,sig]=t.split('.');const a=Buffer.from(sig||''),b=Buffer.from(sign(body||''));return a.length===b.length&&crypto.timingSafeEqual(a,b)&&JSON.parse(Buffer.from(body,'base64url').toString()).exp>Date.now()}catch{return false}}
app.post('/api/session',(req,res)=>{const ip=req.ip||'unknown',now=Date.now(),a=attempts.get(ip)||{n:0,at:now};if(now-a.at>900000){a.n=0;a.at=now}if(a.n>=8)return res.status(429).json({error:'Troppi tentativi'});const value=String(req.body?.passcode||''),p=Buffer.from(value),q=Buffer.from(ACCESS);if(p.length!==q.length||!crypto.timingSafeEqual(p,q)){a.n++;attempts.set(ip,a);return res.status(401).json({error:'Codice non valido'})}attempts.delete(ip);res.cookie(cookieName,createToken(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:ttl}).json({ok:true})});
app.delete('/api/session',(_req,res)=>res.clearCookie(cookieName,{path:'/'}).json({ok:true}));
const months={gen:0,feb:1,mar:2,apr:3,mag:4,giu:5,lug:6,ago:7,set:8,ott:9,nov:10,dic:11};
function iso(raw){const s=String(raw??'').trim().toLowerCase();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;let m=s.match(/^(\d{1,2})[\s./-]+([a-zà]+)[\s./-]+(\d{4})/);if(m&&months[m[2].slice(0,3)]!==undefined)return m[3]+'-'+String(months[m[2].slice(0,3)]+1).padStart(2,'0')+'-'+m[1].padStart(2,'0');m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):''}
function num(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replaceAll(' ','').replace(',','.'));return Number.isFinite(n)?n:null}
function bin(v){return String(v).trim()==='1'?1:String(v).trim()==='0'?0:null}
function get(r,i){return r?.[i]??''}
function days(rows){return rows.slice(4).map(r=>({date:iso(get(r,0)),steps:num(get(r,1)),sleep:num(get(r,2)),hrv:num(get(r,3)),rhr:num(get(r,4)),weight:num(get(r,5)),kcal:num(get(r,6)),protein:num(get(r,7)),workout:bin(get(r,8)),atlasDone:bin(get(r,9)),nicotine:bin(get(r,11)),alcohol:bin(get(r,12)),event:String(get(r,13))})).filter(d=>d.date).sort((a,b)=>a.date.localeCompare(b.date))}
function moods(rows){return rows.slice(1).filter(r=>String(get(r,10)).toUpperCase()==='CONFIRMED').map(r=>({date:iso(get(r,1)),happiness:num(get(r,3)),calm:num(get(r,4)),energy:num(get(r,5)),connection:num(get(r,6)),stress:num(get(r,7)),motivation:num(get(r,8))})).filter(d=>d.date)}
function hyps(rows){return rows.slice(1).filter(r=>/^H-\d+/.test(String(get(r,0)))).map(r=>({id:String(get(r,0)),topic:String(get(r,3)),text:String(get(r,4)),state:String(get(r,10)),confidence:String(get(r,9)),evidence:String(get(r,8)),next:String(get(r,13))}))}
function events(rows){return rows.slice(1).map(r=>({date:iso(get(r,0)),event:String(get(r,1)),category:String(get(r,2)),confidence:String(get(r,3)),note:String(get(r,4))})).filter(d=>d.date&&d.event)}
let creds;try{if(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)creds=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)}catch{throw Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON')}
const auth=new google.auth.GoogleAuth({...(creds?{credentials:creds}:{}),scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']});
const api=google.sheets({version:'v4',auth});
async function read(id,range){const r=await api.spreadsheets.values.get({spreadsheetId:id,range,valueRenderOption:'FORMATTED_VALUE'});return r.data.values||[]}
app.get('/healthz',(_req,res)=>res.json({ok:true,service:'atlas-nexus'}));
app.get('/api/dashboard',async(req,res)=>{if(!valid(req))return res.status(401).json({error:'Autenticazione richiesta'});if(!NEXUS||!MIND)return res.status(503).json({error:'Google Sheets non ancora configurato sul server.'});try{const [daily,mind,hyp,evt]=await Promise.all([read(NEXUS,"'SERIE_365'!A1:N1500"),read(MIND,"'DAILY_EMOTIONS'!A1:L1500"),read(NEXUS,"'IPOTESI_REGISTRO'!A1:P500"),read(NEXUS,"'EVENTI_CHIAVE'!A1:E500")]);const d=days(daily),m=moods(mind),h=hyps(hyp),e=events(evt);res.json({lastRefresh:new Date().toISOString(),sourceDates:{NEXUS:d.at(-1)?.date||'',MIND:m.at(-1)?.date||'',IPOTESI:String(h.length)},days:d,mood:m,hypotheses:h,events:e})}catch(err){console.error('Google Sheets API failed',err?.code||err?.message?.split('\n')[0]);res.status(503).json({error:'Impossibile leggere i fogli privati. Verifica service account e permessi.'})}});
const dir=path.dirname(fileURLToPath(import.meta.url)),publicDir=path.join(dir,'../dist/atlas-nexus/browser');app.use(express.static(publicDir,{index:false}));app.get(/^\/(?!api\/).*/,(_req,res)=>res.sendFile(path.join(publicDir,'index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log('ATLAS NEXUS listening on '+PORT));