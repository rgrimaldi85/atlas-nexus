import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { CardModule } from 'primeng/card';
import { DrawerModule } from 'primeng/drawer';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { PasswordModule } from 'primeng/password';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageModule } from 'primeng/message';
import { AvatarModule } from 'primeng/avatar';

interface Day {date:string;steps:number|null;sleep:number|null;hrv:number|null;rhr:number|null;weight:number|null;kcal:number|null;protein:number|null;workout:number|null;atlasDone:number|null;nicotine:number|null;alcohol:number|null;event:string}
interface Mood {date:string;happiness:number|null;calm:number|null;energy:number|null;connection:number|null;stress:number|null;motivation:number|null}
interface Hypothesis {id:string;topic:string;text:string;state:string;confidence:string;evidence:string;next:string}
interface Event {date:string;event:string;category:string;confidence:string;note:string}
interface Bundle {lastRefresh:string;sourceDates:Record<string,string>;days:Day[];mood:Mood[];hypotheses:Hypothesis[];events:Event[]}
type Period='day'|'week'|'month'|'year'|'custom';
interface Metric {key:string;name:string;unit:string;color:string;type:'daily'|'mood'}
const METRICS:Metric[]=[
{key:'hrv',name:'HRV SDNN',unit:'ms',color:'#11aa9a',type:'daily'},
{key:'sleep',name:'Sonno',unit:'ore',color:'#6669cf',type:'daily'},
{key:'rhr',name:'FC a riposo',unit:'bpm',color:'#e88868',type:'daily'},
{key:'steps',name:'Passi',unit:'passi',color:'#3686d2',type:'daily'},
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
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,ChartModule,ButtonModule,SelectModule,MultiSelectModule,TagModule,InputTextModule,ProgressBarModule,CardModule,DrawerModule,CheckboxModule,DividerModule,TooltipModule,PasswordModule,SelectButtonModule,MessageModule,AvatarModule],templateUrl:'./app.component.html'})
export class AppComponent implements OnInit {
 private http=inject(HttpClient);data:Bundle|null=null;loading=false;error='';locked=true;passcode='';tab='overview';period:Period='month';mode='native';baselineWindow=30;
 anchor=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Zurich'});from=dateAdd(this.anchor,-29);to=this.anchor;
 sideCollapsed=false; mobileMenu=false;
readonly metrics=METRICS; readonly tabs=[
 {id:'overview',name:'Overview',icon:'pi pi-th-large'},
 {id:'health',name:'Health',icon:'pi pi-heart'},
 {id:'body',name:'Corpo & Recovery',icon:'pi pi-chart-line'},
 {id:'mind',name:'Mind',icon:'pi pi-sun'},
 {id:'habits',name:'Abitudini',icon:'pi pi-calendar'},
 {id:'hypotheses',name:'Ipotesi',icon:'pi pi-lightbulb'}
];
readonly periodOptions=[{label:'Giorno',value:'day'},{label:'Settimana',value:'week'},{label:'Mese',value:'month'},{label:'Anno',value:'year'},{label:'Personalizzato',value:'custom'}];
readonly metricOptions=METRICS.map(m=>({label:m.name+' · '+m.unit,value:m.key}));
readonly modeOptions=[{label:'Valori originali',value:'native'},{label:'Indice base 100',value:'index'}];
readonly baselineOptions=[{label:'30 giorni',value:30},{label:'45 giorni',value:45},{label:'90 giorni',value:90}];
setTab(id:string){this.tab=id;this.mobileMenu=false;
 if(id==='mind')this.selected=['stress','calm'];
 else if(id==='body')this.selected=['weight','protein'];
 else if(id==='health')this.selected=['hrv','sleep'];
 else if(id==='habits')this.selected=['sleep','steps'];
 else if(id==='overview')this.selected=['hrv','sleep'];
 this.build();
}
toggleSidebar(){this.sideCollapsed=!this.sideCollapsed;try{localStorage.setItem('atlas-sidebar-collapsed',this.sideCollapsed?'1':'0')}catch{}}
get daysSorted(){return (this.data?.days||[]).filter(x=>x.date).slice().sort((a,b)=>a.date.localeCompare(b.date))}
get cutoffDate(){return this.daysSorted.at(-1)?.date||''}
get cutoffLabel(){return this.formatDay(this.cutoffDate)}
get recentDaily(){const end=this.cutoffDate;return end?this.daysSorted.filter(d=>d.date>=dateAdd(end,-13)&&d.date<=end).reverse():[]}
get smokeStreak():number|null{return this.streak('nicotine')}
get alcoholFreeStreak():number|null{return this.streak('alcohol')}
streak(field:'nicotine'|'alcohol'):number|null{
 const d=this.daysSorted;if(!d.length||d.at(-1)?.[field]===null)return null;
 if(d.at(-1)?.[field]!==0)return 0;
 let n=0,expected=d.at(-1)!.date;
 for(let i=d.length-1;i>=0;i--){if(d[i].date!==expected||d[i][field]!==0)break;n++;expected=dateAdd(expected,-1)}
 return n;
}
get last30(){const end=this.cutoffDate;return end?this.daysSorted.filter(d=>d.date>=dateAdd(end,-29)&&d.date<=end):[]}
get noNicotineDays(){return this.last30.filter(d=>d.nicotine===0).length}
get nicotineRecordedDays(){return this.last30.filter(d=>d.nicotine!==null).length}
get alcoholFreeDays(){return this.last30.filter(d=>d.alcohol===0).length}
get alcoholRecordedDays(){return this.last30.filter(d=>d.alcohol!==null).length}
get confirmedWorkouts(){return this.last30.filter(d=>d.atlasDone===1).length}
get workoutsWeek(){const end=this.cutoffDate;return this.daysSorted.filter(d=>d.date>=dateAdd(end,-6)&&d.date<=end&&d.atlasDone===1).length}
get wearableWeek(){const end=this.cutoffDate;return this.daysSorted.filter(d=>d.date>=dateAdd(end,-6)&&d.date<=end&&d.workout===1).length}
get smokeSince(){const n=this.smokeStreak;return n&&this.cutoffDate?this.formatDay(dateAdd(this.cutoffDate,1-n)):'—'}
avg(key:string):number|null{const m=METRICS.find(x=>x.key===key);if(!m)return null;const [start,end]=this.dateBounds();return mean(this.datesBetween(start,end).map(d=>this.value(d,m)))}
metricN(key:string):number{const m=METRICS.find(x=>x.key===key);if(!m)return 0;const [start,end]=this.dateBounds();return this.datesBetween(start,end).filter(d=>this.value(d,m)!==null).length}
get workoutsPeriod(){const [start,end]=this.dateBounds();return this.daysSorted.filter(d=>d.date>=start&&d.date<=end&&d.atlasDone===1).length}
dayShort(d:string){if(!d)return '';const weekday=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][new Date(d+'T12:00:00Z').getUTCDay()];return weekday+' '+d.slice(8,10)+'/'+d.slice(5,7)}
get moodRecent(){return this.data?.mood.slice(-5).reverse()||[]}
get currentSection(){return this.tabs.find(t=>t.id===this.tab)?.name||'Overview'}
get dataThrough(){return this.data?.days.at(-1)?.date||''}
coverage(n:number){return this.validDays?Math.round(n*100/this.validDays):0}
metricIcon(name:string){const s=name.toLowerCase();return s.includes('sonno')?'pi pi-moon':s.includes('hrv')?'pi pi-heart':s.includes('passi')?'pi pi-directions':s.includes('fc')?'pi pi-wave-pulse':s.includes('peso')?'pi pi-chart-bar':s.includes('stress')?'pi pi-cloud':'pi pi-chart-line'}
formatDay(s:string){if(!s)return '—';const p=s.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:s}
get selectionDescription(){return this.mode==='native'&&this.selected.length>2?'Più di due indicatori: visualizzazione automaticamente normalizzata per evitare assi incompatibili.':'Le serie rispettano i valori mancanti e le date delle osservazioni.'}

 selected=['hrv','sleep'];eventsEnabled=true;selectedEvents=['alcohol','workout','nicotine'];saved:string[]=[];presetName='';sourceUpdated='';
 lineData:any={labels:[],datasets:[]};lineOptions:any={};eventData:any={labels:[],datasets:[]};eventOptions:any={};
 kpis:{name:string;average:number|null;unit:string;color:string;n:number}[]=[];validDays=0;insight='';eventList:Event[]=[];
 get periodLabel(){return ({day:'Giorno',week:'Settimana',month:'Mese',year:'Anno',custom:'Personalizzato'})[this.period]}
 ngOnInit(){try{this.saved=Object.keys(JSON.parse(localStorage.getItem('atlas-nexus-presets')||'{}'));this.sideCollapsed=localStorage.getItem('atlas-sidebar-collapsed')==='1'}catch{};void this.reload()}
 async reload(){this.loading=true;this.error='';try{this.data=await firstValueFrom(this.http.get<Bundle>('/api/dashboard',{withCredentials:true}));this.locked=false;this.sourceUpdated=new Date().toLocaleString('it-CH');if(this.data.days.length)this.anchor=this.data.days[this.data.days.length-1].date;this.build()}catch(e:any){this.locked=e.status===401;this.error=this.locked?'Inserisci il codice di accesso per visualizzare la dashboard.':(e?.error?.error||'Non è stato possibile leggere Google Sheets.')}finally{this.loading=false}}
 async login(){this.error='';try{await firstValueFrom(this.http.post('/api/session',{passcode:this.passcode},{withCredentials:true}));this.passcode='';await this.reload()}catch{this.error='Codice di accesso non valido o servizio non disponibile.'}}
 async logout(){await firstValueFrom(this.http.delete('/api/session',{withCredentials:true}));this.data=null;this.locked=true}
 dateBounds(){let start=this.from,end=this.to;if(this.period==='day')start=end=this.anchor;if(this.period==='week'){const d=new Date(this.anchor+'T12:00:00Z').getUTCDay();start=dateAdd(this.anchor,-d);end=dateAdd(start,6)}if(this.period==='month'){start=this.anchor.slice(0,7)+'-01';end=new Date(Date.UTC(Number(this.anchor.slice(0,4)),Number(this.anchor.slice(5,7)),0)).toISOString().slice(0,10)}if(this.period==='year'){start=this.anchor.slice(0,4)+'-01-01';end=this.anchor.slice(0,4)+'-12-31'}return [start,end]}
 shift(n:number){const steps=this.period==='day'?1:this.period==='week'?7:this.period==='month'?30:this.period==='year'?365:7;this.anchor=dateAdd(this.anchor,steps*n);this.build()}
 value(date:string,m:Metric):number|null{const source=m.type==='daily'?this.data?.days:this.data?.mood;const v=(source?.find((a:any)=>a.date===date) as any)?.[m.key];return typeof v==='number'&&Number.isFinite(v)&&!(m.key==='sleep'&&(date==='2026-11-09'||date==='2026-05-08'))?v:null}
 datesBetween(a:string,b:string){const dates:string[]=[];for(let d=a;d<=b&&dates.length<1500;d=dateAdd(d,1))dates.push(d);return dates}
 build(){if(!this.data)return;const [start,end]=this.dateBounds();const dates=this.datesBetween(start,end);this.validDays=dates.length;
 const active=METRICS.filter(m=>this.selected.includes(m.key));
 this.kpis=(this.tab==='mind'?METRICS.filter(m=>m.type==='mood'):this.tab==='body'?METRICS.filter(m=>m.type==='daily'):this.tab==='health'?METRICS.filter(m=>['HRV SDNN','Sonno','FC a riposo','Passi'].includes(m.name)):METRICS).map(m=>{const vals=dates.map(d=>this.value(d,m));return {...m,average:mean(vals),n:vals.filter(v=>v!==null).length}});

 const effectiveMode=(this.mode==='native'&&active.length>2)?'index':this.mode;
 const baselines=active.map(m=>mean(this.datesBetween(dateAdd(start,-this.baselineWindow),dateAdd(start,-1)).map(d=>this.value(d,m))));
 this.lineData={labels:dates,datasets:active.map((m,i)=>({
  label:m.name+(effectiveMode==='index'?' · base 100':''),
  data:dates.map(d=>{const v=this.value(d,m);return v===null?null:effectiveMode==='index'?(baselines[i]!==null&&baselines[i]!==0?100*v/baselines[i]!:null):v}),
  borderColor:m.color,backgroundColor:m.color,yAxisID:effectiveMode==='index'?'y':i===1?'y1':'y',
  spanGaps:false,tension:.28,borderWidth:2.5,pointRadius:dates.length>50?0:2.5,pointHoverRadius:5,
  pointBackgroundColor:'#fff',pointBorderWidth:2,pointBorderColor:m.color
 }))};
 const tick=(v:any,i:number)=>dates[i]?dates[i].slice(8,10)+'/'+dates[i].slice(5,7):'';
 const y=(label:string,side:string,grid:boolean)=>({type:'linear',position:side,grid:{color:grid?'#edf1f6':'transparent'},border:{display:false},ticks:{color:'#8996a8',maxTicksLimit:6},title:{display:!!label,text:label,color:'#8996a8',font:{size:11}}});
 const scales:any={x:{grid:{display:false},border:{display:false},ticks:{color:'#91a0af',maxTicksLimit:9,maxRotation:0,callback:tick}}};
 scales.y=y(effectiveMode==='index'?'Indice (baseline = 100)':active[0]?.unit||'','left',true);
 if(effectiveMode==='native'&&active.length>1)scales.y1=y(active[1]?.unit||'','right',false);
 this.lineOptions={responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},plugins:{
  legend:{position:'bottom',labels:{color:'#556779',usePointStyle:true,pointStyle:'circle',padding:19,boxWidth:8,font:{size:11}}},
  tooltip:{backgroundColor:'#15263e',titleColor:'#fff',bodyColor:'#dbe6ef',padding:12,cornerRadius:9}
 },scales,layout:{padding:{top:8,right:5}}};
 const dByDate=new Map(this.data.days.map(d=>[d.date,d]));
 const eventCounts=dates.map(d=>{const v=dByDate.get(d);return [
  v?.alcohol===1?1:v?.alcohol===0?0:null,
  v?.workout===1?1:v?.workout===0?0:null,
  v?.nicotine===1?1:v?.nicotine===0?0:null
 ]});
 this.eventData={labels:dates,datasets:[
  {label:'Alcol confermato',backgroundColor:'#f09070',borderRadius:4,data:eventCounts.map(x=>x[0]),hidden:!this.selectedEvents.includes('alcohol')},
  {label:'Attività wearable',backgroundColor:'#32baa9',borderRadius:4,data:eventCounts.map(x=>x[1]),hidden:!this.selectedEvents.includes('workout')},
  {label:'Nicotina',backgroundColor:'#8581e2',borderRadius:4,data:eventCounts.map(x=>x[2]),hidden:!this.selectedEvents.includes('nicotine')}
 ]};
 this.eventOptions={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#15263e'}},scales:{
  x:{stacked:true,grid:{display:false},border:{display:false},ticks:{color:'#98a6b6',maxTicksLimit:9,maxRotation:0,callback:tick}},
  y:{stacked:true,min:0,max:3,grid:{color:'#edf1f6'},border:{display:false},ticks:{stepSize:1,color:'#98a6b6'}}
 }};
 this.eventList=this.data.events.filter(e=>e.date>=start&&e.date<=end).slice(-10);
 const pair=active.slice(0,2);if(pair.length===2){const r=pearson(dates.map(d=>this.value(d,pair[0])),dates.map(d=>this.value(d,pair[1])));this.insight=r.r===null?'Dati sovrapposti insufficienti per una correlazione esplorativa (n='+r.n+').':pair[0].name+' × '+pair[1].name+': r='+r.r.toFixed(2)+' su '+r.n+' coppie; relazione descrittiva, non causale.'}else this.insight='Seleziona due indicatori per un confronto esplorativo.';
 }
 toggleEvent(k:string){this.selectedEvents=this.selectedEvents.includes(k)?this.selectedEvents.filter(x=>x!==k):[...this.selectedEvents,k];this.build()}
 savePreset(){const name=this.presetName.trim();if(!name)return;const all=JSON.parse(localStorage.getItem('atlas-nexus-presets')||'{}');all[name]={selected:[...this.selected],selectedEvents:[...this.selectedEvents],mode:this.mode,baselineWindow:this.baselineWindow,period:this.period,eventsEnabled:this.eventsEnabled};localStorage.setItem('atlas-nexus-presets',JSON.stringify(all));this.saved=Object.keys(all);this.presetName=''}
 loadPreset(name:string){try{const p=JSON.parse(localStorage.getItem('atlas-nexus-presets')||'{}')[name];Object.assign(this,p);this.build()}catch{}}
 download(){if(!this.data)return;const [a,b]=this.dateBounds();const values=this.datesBetween(a,b).map(d=>[d,...this.selected.map(k=>{const m=METRICS.find(x=>x.key===k)!;return this.value(d,m)??''})]);const csv=[['date',...this.selected],...values].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const aEl=document.createElement('a');aEl.href=url;aEl.download='ATLAS_NEXUS_'+a+'.csv';aEl.click();URL.revokeObjectURL(url)}
}
