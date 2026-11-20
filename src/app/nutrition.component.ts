import { ChangeDetectorRef, Component, Input, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';

interface RecoveryDay { date:string; hrv:number|null; sleep:number|null; rhr?:number|null }
interface FoodDay {
  date:string; kcal:number|null; protein:number|null; carbs:number|null; fat:number|null;
  healthy:number; nonHealthy:number; mealCount:number; healthyUnconfirmed:number;
  alcoholStatus:'confirmed'|'possible'|'unreported'; alcoholGrams:number|null; alcoholIncomplete:boolean;
  alcoholCount:number; spirits:boolean; lossOfControl:boolean; daytimeConfirmed:boolean;
  warning:string; drinks:string[];
}
interface NutritionPayload {
  days:FoodDay[]; sourceDates:Record<string,string>; note:string;
}
interface DayAlert {date:string; severity:'danger'|'warn'|'secondary'; title:string; description:string}
function fmt(date:string):string {return date?date.slice(8,10)+'/'+date.slice(5,7):'—'}
function average(nums:(number|null)[]):number|null {
  const v=nums.filter((x):x is number=>typeof x==='number'&&Number.isFinite(x));
  return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
}
const COLORS={healthy:'#20a58a',unhealthy:'#ef9a68',protein:'#5868e8',carbs:'#44accd',fat:'#f3b64f',alcohol:'#c65a62'};
const chartOpts=(unit:string,stacked=false)=>({
  responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
  plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',boxWidth:8,padding:15,color:'#66748d',font:{size:11}}},
    tooltip:{backgroundColor:'#1a2841',padding:12}},
  scales:{x:{stacked,grid:{display:false},ticks:{maxRotation:0,color:'#8995a9',maxTicksLimit:11}},
    y:{stacked,beginAtZero:true,grid:{color:'#edf0f6'},title:{display:true,text:unit,color:'#8291a7'},ticks:{color:'#8995a9'}}}
});
@Component({
  selector:'app-nutrition',
  standalone:true,
  imports:[CommonModule,ChartModule,CardModule,ButtonModule,TagModule,MessageModule,ProgressBarModule],
  templateUrl:'./nutrition.component.html',
  styleUrls:['./nutrition.component.css']
})
export class NutritionComponent implements OnInit,OnChanges {
  @Input() days:RecoveryDay[]=[];
  @Input() start='';
  @Input() end='';
  private http=inject(HttpClient);
  private cdr=inject(ChangeDetectorRef);
  loading=false;error='';source: NutritionPayload|null=null;
  visible:FoodDay[]=[]; alerts:DayAlert[]=[];
  healthyPct:number|null=null; avgProtein:number|null=null;
  countHealthy=0;countMeals=0;confirmedAlcoholDays=0;possibleAlcoholDays=0;incompleteCount=0;recoveryPairs=0;
  healthyData:any={labels:[],datasets:[]};
  macroData:any={labels:[],datasets:[]};
  alcoholData:any={labels:[],datasets:[]};
  recoveryData:any={labels:[],datasets:[]};
  healthyOptions:any=chartOpts('Pasti',true);
  macroOptions:any=chartOpts('Grammi');
  alcoholOptions:any=chartOpts('Alcol puro stimato (g)');
  recoveryOptions:any={};
  ngOnInit(){void this.reload()}
  ngOnChanges(){if(this.source)this.rebuild()}
  get dateCoverage(){return this.visible.length}
  get lastSourceDate(){return this.source?.sourceDates?.['BEVANDE']||'—'}
  get hasData(){return this.visible.length>0}
  get critical(){return this.alerts.filter(a=>a.severity==='danger')}
  get lastDays(){return this.visible.slice().reverse()}
  async reload(){
    this.loading=true;this.error='';this.cdr.markForCheck();
    try{
      this.source=await firstValueFrom(this.http.get<NutritionPayload>('/api/nutrition',{withCredentials:true}));
      this.rebuild();
    }catch(e:any){
      this.source=null;
      this.error=e?.error?.error||'Dati ATLAS non raggiungibili. Verifica accesso del service account al foglio ATLAS.';
    }finally{this.loading=false;this.cdr.markForCheck()}
  }
  rebuild(){
    if(!this.source)return;
    this.visible=this.source.days.filter(d=>d.date>=this.start&&d.date<=this.end).sort((a,b)=>a.date.localeCompare(b.date));
    const v=this.visible, labels=v.map(x=>fmt(x.date));
    this.countHealthy=v.reduce((s,x)=>s+x.healthy,0);
    this.countMeals=v.reduce((s,x)=>s+x.healthy+x.nonHealthy,0);
    this.healthyPct=this.countMeals?Math.round(100*this.countHealthy/this.countMeals):null;
    this.avgProtein=average(v.map(x=>x.protein));
    this.confirmedAlcoholDays=v.filter(x=>x.alcoholStatus==='confirmed').length;
    this.possibleAlcoholDays=v.filter(x=>x.alcoholStatus==='possible').length;
    this.incompleteCount=v.filter(x=>x.alcoholIncomplete).length;
    this.healthyData={labels,datasets:[
      {label:'Healthy · proposta',data:v.map(x=>x.healthy),backgroundColor:COLORS.healthy,borderRadius:5,maxBarThickness:34,stack:'food'},
      {label:'Non Healthy · proposta',data:v.map(x=>x.nonHealthy),backgroundColor:COLORS.unhealthy,borderRadius:5,maxBarThickness:34,stack:'food'}
    ]};
    this.macroData={labels,datasets:[
      {label:'Proteine',data:v.map(x=>x.protein),backgroundColor:COLORS.protein,borderRadius:5,maxBarThickness:21},
      {label:'Carboidrati',data:v.map(x=>x.carbs),backgroundColor:COLORS.carbs,borderRadius:5,maxBarThickness:21},
      {label:'Grassi',data:v.map(x=>x.fat),backgroundColor:COLORS.fat,borderRadius:5,maxBarThickness:21},
      {type:'line',label:'Target proteine · 150 g',data:v.map(x=>x.protein===null?null:150),borderColor:'#788597',borderDash:[5,5],pointRadius:0,borderWidth:1.8,fill:false,spanGaps:false}
    ]};
    this.alcoholData={labels,datasets:[
      {label:'Quantità nota o stimata (parziale se altre dosi ignote)',data:v.map(x=>x.alcoholGrams),
       backgroundColor:v.map(x=>x.alcoholIncomplete?'#efbb75':COLORS.alcohol),borderRadius:5,maxBarThickness:36}
    ]};
    const recovered=new Map(this.days.map(d=>[d.date,d]));
    const shifted=v.map(d=>{
      const next=new Date(d.date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
      const iso=next.toISOString().slice(0,10), r=recovered.get(iso);
      const hrv=r?.hrv??null;
      const valid=hrv!==null&&Number.isFinite(hrv)&&d.alcoholGrams!==null;
      return {gram:d.alcoholGrams,hrv:valid?hrv:null}
    });
    this.recoveryPairs=shifted.filter(x=>x.hrv!==null).length;
    this.recoveryData={labels,datasets:[
      {type:'bar',label:'Alcol (g stimati)',data:v.map(x=>x.alcoholGrams),backgroundColor:'#e7ac91',borderRadius:4,maxBarThickness:32,yAxisID:'y'},
      {type:'line',label:'HRV giorno successivo (ms)',data:shifted.map(x=>x.hrv),borderColor:'#625fd9',backgroundColor:'#625fd9',pointRadius:3,spanGaps:false,tension:0.26,yAxisID:'y1'}
    ]};
    this.recoveryOptions={responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},
      plugins:{legend:{position:'bottom',labels:{color:'#66748d',usePointStyle:true,boxWidth:9,padding:15}},tooltip:{backgroundColor:'#1a2841'}},
      scales:{x:{grid:{display:false},ticks:{color:'#8995a9',maxTicksLimit:10}},
        y:{type:'linear',position:'left',beginAtZero:true,title:{display:true,text:'g alcol',color:'#8995a9'},grid:{color:'#edf0f6'},ticks:{color:'#8995a9'}},
        y1:{type:'linear',position:'right',title:{display:true,text:'HRV SDNN, ms',color:'#8995a9'},grid:{display:false},ticks:{color:'#8995a9'}}}};
    this.alerts=v.filter(x=>x.alcoholStatus!=='unreported'||x.nonHealthy>0).map(d=>{
      if(d.lossOfControl)return {date:d.date,severity:'danger' as const,title:'Criticità massima riferita',
        description:'Superalcolici e perdita di controllo percepita; quantità incompleta, non è il massimo quantitativo dimostrato.'};
      if(d.alcoholStatus==='confirmed'&&d.alcoholGrams!==null&&d.alcoholGrams>=60)
        return {date:d.date,severity:'danger' as const,title:'Alcol elevato · dose stimata',
          description:'Circa '+Math.round(d.alcoholGrams)+' g di alcol puro; verificare le quantità stimate. '+(d.alcoholIncomplete?'Altre dosi non quantificate.':'')};
      if(d.alcoholStatus==='confirmed'&&d.spirits)
        return {date:d.date,severity:'warn' as const,title:'Superalcolici registrati',
          description:'Alcol presente; verifica orario e quantità per attribuire correttamente l’evento.'};
      if(d.alcoholStatus==='confirmed')
        return {date:d.date,severity:'warn' as const,title:'Alcol confermato',description:'Alcol registrato nella giornata; '+(d.alcoholIncomplete?'almeno una dose non quantificata.':'quantità riportate come stime.')};
      if(d.alcoholStatus==='possible')
        return {date:d.date,severity:'secondary' as const,title:'Consumo da confermare',description:'Presenza della bevanda non equivale a prova del consumo.'};
      return {date:d.date,severity:'secondary' as const,title:'Pasto/i da rivedere',description:'Almeno un pasto Non Healthy; nessun consumo di alcol segnalato.'};
    }).reverse();
    this.cdr.markForCheck();
  }
  formatDay(s:string){return fmt(s)}
  get percentLabel(){return this.healthyPct===null?'—':this.healthyPct+'%'}
  get proteinLabel(){return this.avgProtein===null?'—':Math.round(this.avgProtein)+' g'}
  get proteinCoverage(){return this.visible.filter(x=>x.protein!==null).length}
  get alcoholCoverage(){return this.visible.filter(x=>x.alcoholStatus!=='unreported').length}
  get prominentDate(){return this.visible.find(x=>x.lossOfControl)?.date||''}
}
