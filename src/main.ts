import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { AppComponent } from './app/app.component';
const AtlasPreset=definePreset(Aura,{
 semantic:{
  primary:{
   50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',
   500:'#7966ef',600:'#6958df',700:'#5b4dca',800:'#473ab7',900:'#32258c',950:'#221c57'
  }
 }
});
bootstrapApplication(AppComponent,{
 providers:[provideHttpClient(),provideAnimationsAsync(),providePrimeNG({theme:{preset:AtlasPreset,options:{darkModeSelector:false}}})]
}).catch(console.error);
