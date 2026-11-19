import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChartModule } from 'primeng/chart';

interface Day {date:string;steps:number|null;sleep:number|null;hrv:number|null;rhr:number|null;weight:number|null;kcal:number|null;protein:number|null;workout:number|null;atlasDone:number|null;nicotine:number|null;alcohol:number|null;event:string}
interface Mood {date:string;happiness:number|null;calm:number|null;energy:number|null;connection:number|null;stress:number|null;motivation:number|null}
interface Hypothesis {id:string;topic:string;text:string;state:string;confidence:string;evidence:string;next:string}
interface Event {date:string;event:string;category:string;confidence:string;note:string}
interface Bundle {lastRefresh:string;sourceDates:Record<string,string>;days:Day[];mood:Mood[];hypotheses:Hypothesis[];events:Event[]}
type Period='day'|'week'|'month'|'year'|'custom';
interface Metric {key:string;name:string;unit:string;color:string;type:'daily'|'mood'}
const METRICS:Metric[]=[
{key:'hrv',name:'HRV SDNN',unit:'ms',color:'#4bd6ca',type:'daily'},
{key:'sleep',name:'Sonno',unit:'ore',color:'#9ea8ff',type:'daily'},
{key:'rhr',name:'FC a riposo',unit:'bpm',color:'#f99d7f',type:'daily'},
{key:'steps',name:'Passi',unit:'passi',color:'#63b9ff',type:'daily'},
{key:'weight',name:'Peso',unit:'kg',color:'#ffd27c',type:'daily'},
{key:'kcal',name:'Calorie registrate',unit:'kcal',color:'#db9bfa',type:'daily'},
{key:'protein',name:'Proteine',unit:'g',color:'#89daac',type:'daily'},
{key:'happiness',name:'Felicità',unit:'/10',color:'#ffc58e',type:'mood'},
{key:'calm',name:'Tranquillità',unit:'/10',color:'#b5a8ff',type:'mood'},
{key:'energy',name:'Energia',unit:'/10',color:'#7de2c5',type:'mood'},
{key:'connection',name:'Connessione sociale',unit:'/10',color:'#fd97ba',type:'mood'},
{key:'stress',name:'Stress',unit:'/10',color:'#ff8784',type:'mood'},
{key:'motivation',name:'Motivazione',unit:'/10',color:'#85aeff',type:'mood'}
];
function dateAdd(s:string,n:number):string {const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function mean(a:(number|null)[]):number|null {const b=a.filter((x):x is number=>x!==null&&Number.isFinite(x));return b.length?b.reduce((p,q)=>p+q,0)/b.length:null}
function pearson(a:(number|null)[],b:(number|null)[]){const p=a.map((v,i)=>[v,b[i]]).filter((v):v is number[]=>v[0]!==null&&v[1]!==null);if(p.length<5)return {n:p.length,r:null};const x=mean(p.map(t=>t[0]))!,y=mean(p.map(t=>t[1]))!;const xx=p.reduce((s,t)=>s+(t[0]-x)**2,0),yy=p.reduce((s,t)=>s+(t[1]-y)**2,0),xy=p.reduce((s,t)=>s+(t[0]-x)*(t[1]-y),0);return {n:p.length,r:xx*yy?xy/Math.sqrt(xx*yy):null}}
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,ChartModule],templateUrl:'./app.component.html'})
export class AppComponent implements OnInit {
 private http=inject(HttpClient);data:Bundle|null=null;loading=false;error='';locked=true;passcode='';tab='overview';period:Period='month';mode='native';baselineWindow=30;
 anchor=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Zurich'});from=dateAdd(this.anchor,-29);to=this.anchor;
 readonly metrics=METRICS; readonly tabs=[{id:'overview',name:'Overview',icon:'◈'},{id:'body',name:'Corpo & Recovery',icon:'♡'},{id:'mind',name:'Mind',icon:'✧'},{id:'habits',name:'Abitudini',icon:'▦'},{id:'hypotheses',name:'Ipotesi',icon:'◉'}];
 selected=['hrv','sleep','rhr'];eventsEnabled=true;selectedEvents=['alcohol','workout','nicotine'];saved:string[]=[];presetName='';sourceUpdated='';
 lineData:any={labels:[],datasets:[]};lineOptions:any={};eventData:any={labels:[],datasets:[]};eventOptions:any={};
 kpis:{name:string;average:number|null;unit:string;color:string;n:number}[]=[];validDays=0;insight='';eventList:Event[]=[];
 get periodLabel(){return ({day:'Giorno',week:'Settimana',month:'Mese',year:'Anno',custom:'Personalizzato'})[this.period]}
 ngOnInit(){try{this.saved=Object.keys(JSON.parse(localStorage.getItem('atlas-nexus-presets')||'{}'))}catch{};void this.reload()}
 async reload(){this.loading=true;this.error='';try{this.data=await firstValueFrom(this.http.get<Bundle>('/api/dashboard',{withCredentials:true}));this.locked=false;this.sourceUpdated=new Date().toLocaleString('it-CH');if(this.data.days.length)this.anchor=this.data.days[this.data.days.length-1].date;this.build()}catch(e:any){this.locked=e.status===401;this.error=this.locked?'Inserisci il codice di accesso per visualizzare la dashboard.':(e?.error?.error||'Non è stato possibile leggere Google Sheets.')}finally{this.loading=false}}
 async login(){this.error='';try{await firstValueFrom(this.http.post('/api/session',{passcode:this.passcode},{withCredentials:true}));this.passcode='';await this.reload()}catch{this.error='Codice di accesso non valido o servizio non disponibile.'}}
 async logout(){await firstValueFrom(this.http.delete('/api/session',{withCredentials:true}));this.data=null;this.locked=true}
 dateBounds(){let start=this.from,end=this.to;if(this.period==='day')start=end=this.anchor;if(this.period==='week'){const d=new Date(this.anchor+'T12:00:00Z').getUTCDay();start=dateAdd(this.anchor,-d);end=dateAdd(start,6)}if(this.period==='month'){start=this.anchor.slice(0,7)+'-01';end=new Date(Date.UTC(Number(this.anchor.slice(0,4)),Number(this.anchor.slice(5,7)),0)).toISOString().slice(0,10)}if(this.period==='year'){start=this.anchor.slice(0,4)+'-01-01';end=this.anchor.slice(0,4)+'-12-31'}return [start,end]}
 shift(n:number){const steps=this.period==='day'?1:this.period==='week'?7:this.period==='month'?30:this.period==='year'?365:7;this.anchor=dateAdd(this.anchor,steps*n);this.build()}
 value(date:string,m:Metric):number|null{const source=m.type==='daily'?this.data?.days:this.data?.mood;const v=(source?.find((a:any)=>a.date===date) as any)?.[m.key];return typeof v==='number'&&Number.isFinite(v)?v:null}
 datesBetween(a:string,b:string){const dates:string[]=[];for(let d=a;d<=b&&dates.length<1500;d=dateAdd(d,1))dates.push(d);return dates}
 build(){if(!this.data)return;const [start,end]=this.dateBounds();const dates=this.datesBetween(start,end);this.validDays=dates.length;
 const active=METRICS.filter(m=>this.selected.includes(m.key));
 this.kpis=(this.tab==='mind'?METRICS.filter(m=>m.type==='mood'):this.tab==='body'?METRICS.filter(m=>m.type==='daily'):METRICS).map(m=>{const vals=dates.map(d=>this.value(d,m));return {...m,average:mean(vals),n:vals.filter(v=>v!==null).length}});
 const datasets:any[]=active.map((m,i)=>{const base=mean(this.datesBetween(dateAdd(start,-this.baselineWindow),dateAdd(start,-1)).map(d=>this.value(d,m)));return {label:m.name+(this.mode==='index'?' · base100':''),data:dates.map(d=>{const v=this.value(d,m);return v===null?null:this.mode==='index'?(base&&base!==0?100*v/base:null):v}),borderColor:m.color,backgroundColor:m.color,yAxisID:this.mode==='index'?'y':'y'+i,spanGaps:false,tension:.24,pointRadius:dates.length>60?0:2,borderWidth:2}});this.lineData={labels:dates,datasets};
 const scales:any={x:{ticks:{color:'#a5b8ca',maxTicksLimit:9},grid:{color:'#1e3547'}}};if(this.mode==='index')scales.y={ticks:{color:'#9fb1c2'},grid:{color:'#1e3547'},title:{display:true,text:'Indice base 100'}};else active.forEach((m,i)=>scales['y'+i]={type:'linear',display:i<2,position:i%2?'right':'left',grid:{color:i?'transparent':'#1e3547'},ticks:{color:m.color},title:{display:i<2,text:m.unit,color:m.color}});this.lineOptions={responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},plugins:{legend:{labels:{color:'#d6e4f2'}}},scales};
 const dailyByDate=new Map(this.data.days.map(d=>[d.date,d]));const counts=dates.map(d=>{const v=dailyByDate.get(d);return v?[v.alcohol===1?1:0,v.workout===1?1:0,v.nicotine===1?1:0]:[0,0,0]});this.eventData={labels:dates,datasets:[{label:'Alcol confermato',backgroundColor:'#ed896b',data:counts.map(x=>x[0]),hidden:!this.selectedEvents.includes('alcohol')},{label:'Allenamento wearable',backgroundColor:'#44c5ba',data:counts.map(x=>x[1]),hidden:!this.selectedEvents.includes('workout')},{label:'Nicotina',backgroundColor:'#9ca6ff',data:counts.map(x=>x[2]),hidden:!this.selectedEvents.includes('nicotine')}]};this.eventOptions={responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true,ticks:{color:'#a5b8ca',maxTicksLimit:9},grid:{display:false}},y:{stacked:true,min:0,ticks:{color:'#a5b8ca',stepSize:1},grid:{color:'#1e3547'}}},plugins:{legend:{labels:{color:'#c9dcea'}}}};
 this.eventList=this.data.events.filter(e=>e.date>=start&&e.date<=end).slice(-10);
 const pair=active.slice(0,2);if(pair.length===2){const r=pearson(dates.map(d=>this.value(d,pair[0])),dates.map(d=>this.value(d,pair[1])));this.insight=r.r===null?'Dati sovrapposti insufficienti per una correlazione esplorativa (n='+r.n+').':pair[0].name+' × '+pair[1].name+': r='+r.r.toFixed(2)+' su '+r.n+' coppie; relazione descrittiva, non causale.'}else this.insight='Seleziona due indicatori per un confronto esplorativo.';
 }
 savePreset(){const name=this.presetName.trim();if(!name)return;const all=JSON.parse(localStorage.getItem('atlas-nexus-presets')||'{}');all[name]={selected:[...this.selected],selectedEvents:[...this.selectedEvents],mode:this.mode,baselineWindow:this.baselineWindow,period:this.period,eventsEnabled:this.eventsEnabled};localStorage.setItem('atlas-nexus-presets',JSON.stringify(all));this.saved=Object.keys(all);this.presetName=''}
 loadPreset(name:string){try{const p=JSON.parse(localStorage.getItem('atlas-nexus-presets')||'{}')[name];Object.assign(this,p);this.build()}catch{}}
 download(){if(!this.data)return;const [a,b]=this.dateBounds();const values=this.datesBetween(a,b).map(d=>[d,...this.selected.map(k=>{const m=METRICS.find(x=>x.key===k)!;return this.value(d,m)??''})]);const csv=[['date',...this.selected],...values].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const aEl=document.createElement('a');aEl.href=url;aEl.download='ATLAS_NEXUS_'+a+'.csv';aEl.click();URL.revokeObjectURL(url)}
}
