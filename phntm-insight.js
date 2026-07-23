// <phntm-insight> — THE SIGNAL: rotating 3D correlation cloud.
// Gathers each trading day (performance) and joins it with that day's
// sleep timing, sleep duration and food intake, then surfaces what moves
// your edge. Reads localStorage (phntm-my-trades-v1, phntm-days-v1) and
// falls back to a plausible demo cloud so it always reads clearly.
(function(){
  const DIMS = {
    timing:   { label:'Sleep timing',   axis:'BEDTIME',  key:'bed' },
    duration: { label:'Sleep duration', axis:'SLEEP',    key:'sleep' },
    food:     { label:'Food intake',    axis:'CALORIES', key:'kcal' },
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function buildData(){
    let trades=[], days={};
    try{ trades=JSON.parse(localStorage.getItem('phntm-my-trades-v1')||'[]')||[]; }catch(e){}
    try{ days=JSON.parse(localStorage.getItem('phntm-days-v1')||'{}')||{}; }catch(e){}
    const byDay={};
    for(const t of trades){ const d=new Date(t.ts); const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      (byDay[k]=byDay[k]||[]).push(t); }
    const pts=[];
    for(const k in byDay){ const rec=days[k]; if(!rec) continue;
      const g=byDay[k]; if(!g.length) continue;
      const perf=g.reduce((a,t)=>a+(t.r||0),0)/g.length;
      if(rec.bedMin==null && rec.sleepMin==null) continue;
      pts.push({ perf, bed:rec.bedMin, sleep:rec.sleepMin, kcal:rec.kcal||null, trades:g.length, real:true });
    }
    if(pts.length>=8) return {pts,real:true};
    // demo cloud — encodes the real-world pattern the tool is meant to reveal
    let seed=91; const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
    const demo=[];
    for(let i=0;i<46;i++){
      const bed=1290+rnd()*360;                 // 21:30–03:30 in min past noon-ish (see effBed)
      const sleep=300+rnd()*240;                // 5h–9h
      const kcal=1650+rnd()*1600;               // 1650–3250
      const early = bed<1500 ? 1 : 0;           // asleep before ~01:00
      const rested = sleep>=420 ? 1 : 0;        // 7h+
      const lean = kcal<=2600 ? 1 : 0;
      let perf = -0.9 + early*1.15 + rested*0.85 + lean*0.55 + (rnd()-0.5)*0.9;
      demo.push({ perf:+perf.toFixed(2), bed, sleep, kcal, trades:1+Math.floor(rnd()*4), real:false });
    }
    return {pts:demo,real:false};
  }

  // effective bedtime in hours where after-midnight rolls past 24 (so 00:30 -> 24.5)
  const effBed=(bedMin)=>{ let h=(bedMin==null?1440:bedMin)/60; if(h<12) h+=24; return h; };
  const fmtBed=(bedMin)=>{ if(bedMin==null) return '—'; let m=((bedMin%1440)+1440)%1440; let h=Math.floor(m/60), mm=m%60; const ap=h<12?'AM':'PM'; let hh=h%12; if(hh===0)hh=12; return hh+':'+String(mm).padStart(2,'0')+' '+ap; };

  function insightFor(dim,pts){
    const val=(p)=> dim==='timing'?effBed(p.bed) : dim==='duration'?(p.sleep||0)/60 : (p.kcal||0);
    const has=pts.filter(p=> dim==='food'? p.kcal!=null : (dim==='timing'? p.bed!=null : p.sleep!=null));
    if(has.length<4) return {head:'Gathering signal…',sub:'Log a few more nights and meals to reveal the pattern.',good:0,bad:0,delta:0};
    let split, lowLabel, highLabel;
    if(dim==='timing'){ split=25; lowLabel='before 1:00 AM'; highLabel='after 1:00 AM'; }
    else if(dim==='duration'){ split=7; lowLabel='under 7h'; highLabel='7h or more'; }
    else { split=2600; lowLabel='under 2,600 kcal'; highLabel='over 2,600 kcal'; }
    const A=has.filter(p=> val(p) < split), B=has.filter(p=> val(p) >= split);
    const avg=(a)=> a.length? a.reduce((s,p)=>s+p.perf,0)/a.length : 0;
    const wr=(a)=> a.length? Math.round(100*a.filter(p=>p.perf>0).length/a.length):0;
    // "good" group = the one that performs better
    let goodG,badG,goodName,badName;
    if(dim==='timing'){ goodG=A; badG=B; goodName='before 1:00 AM'; badName='after 1:00 AM'; }
    else if(dim==='duration'){ goodG=B; badG=A; goodName='7h+ of sleep'; badName='under 7h'; }
    else { goodG=A; badG=B; goodName='under 2,600 kcal'; badName='over 2,600 kcal'; }
    const gAvg=avg(goodG), bAvg=avg(badG), gWr=wr(goodG), bWr=wr(badG);
    const delta=gWr-bWr;
    const head = dim==='timing'
      ? 'Asleep '+goodName+', you average '+(gAvg>=0?'+':'')+gAvg.toFixed(2)+'R'
      : dim==='duration'
        ? 'On '+goodName+', you average '+(gAvg>=0?'+':'')+gAvg.toFixed(2)+'R'
        : 'Eating '+goodName+', you average '+(gAvg>=0?'+':'')+gAvg.toFixed(2)+'R';
    const sub = 'That\u2019s '+gWr+'% win days vs '+bWr+'% when '+badName+' — a '+(delta>=0?'+':'')+delta+' pt swing.';
    return {head,sub,good:gWr,bad:bWr,delta,gAvg,bAvg,goodName,badName};
  }

  class PhntmInsight extends HTMLElement{
    connectedCallback(){ if(this._i){ if(this._ro)this._ro.observe(this); this._idleSince=null; return; } this._i=1; this.style.display='block'; this.style.width='100%'; this.style.height='100%'; this._build(); }
    _build(){
      const wrap=document.createElement('div');
      wrap.style.cssText='position:relative;width:100%;height:100%';
      const cv=document.createElement('canvas'); cv.style.cssText='width:100%;height:100%;display:block;cursor:grab';
      wrap.appendChild(cv);
      // dimension chips
      const chipRow=document.createElement('div');
      chipRow.style.cssText='position:absolute;top:16px;left:18px;display:flex;gap:8px;z-index:2';
      this._dim='timing';
      const chips={};
      Object.keys(DIMS).forEach((d)=>{ const b=document.createElement('button'); b.textContent=DIMS[d].label;
        b.style.cssText='font-family:JetBrains Mono,monospace;font-size:11px;letter-spacing:.02em;padding:7px 13px;border-radius:99px;cursor:pointer;transition:background .3s,color .3s,border-color .3s;background:none;color:#8a8a8a;border:1px solid rgba(255,255,255,.16)';
        b.onclick=()=>{ this._dim=d; this._retint(); this._paintChips(); };
        chipRow.appendChild(b); chips[d]=b; });
      this._chips=chips; this._paintChips=()=>{ Object.keys(chips).forEach((d)=>{ const on=d===this._dim;
        chips[d].style.background=on?'#fff':'none'; chips[d].style.color=on?'#000':'#8a8a8a'; chips[d].style.borderColor=on?'#fff':'rgba(255,255,255,.16)'; chips[d].style.fontWeight=on?'500':'400'; }); };
      wrap.appendChild(chipRow);
      // insight readout
      const read=document.createElement('div');
      read.style.cssText='position:absolute;left:18px;bottom:18px;right:18px;z-index:2;pointer-events:none';
      this._read=read; wrap.appendChild(read);
      this.appendChild(wrap);

      const built=buildData(); this._pts=built.pts; this._real=built.real;
      const ctx=cv.getContext('2d'); const DPR=Math.min(devicePixelRatio,2);
      let W=0,H=0; const fit=()=>{W=this.clientWidth||700;H=this.clientHeight||460;cv.width=W*DPR;cv.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0)};
      this._ro=new ResizeObserver(fit); this._ro.observe(this); fit();

      // normalize point coords to [-1,1] on the three axes
      const norm=(arr,f)=>{ const vals=arr.map(f).filter(v=>v!=null&&isFinite(v)); const lo=Math.min(...vals), hi=Math.max(...vals); const sp=hi-lo||1; return (v)=> v==null||!isFinite(v)? 0 : (( (v-lo)/sp )*2-1); };
      const nBed=norm(this._pts,p=>effBed(p.bed));
      const nSleep=norm(this._pts,p=>p.sleep);
      const nPerf=norm(this._pts,p=>p.perf);
      this._pts.forEach(p=>{ p.X=nBed(effBed(p.bed)); p.Z=(p.sleep!=null?nSleep(p.sleep):0); p.Y=nPerf(p.perf); });

      // drag to rotate
      let drag=false,lx=0; let ay=0.6, vy=0.0025, tilt=0.5;
      cv.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;cv.style.cursor='grabbing';cv.setPointerCapture(e.pointerId);});
      cv.addEventListener('pointerup',e=>{drag=false;cv.style.cursor='grab';});
      cv.addEventListener('pointermove',e=>{ if(drag){ ay+=(e.clientX-lx)*0.008; lx=e.clientX; vy=0; } });

      this._retint=()=>{ const dim=this._dim; const k=DIMS[dim].key;
        const arr=this._pts.map(p=> dim==='food'?(p.kcal): dim==='timing'?effBed(p.bed):(p.sleep));
        const good=(p)=> dim==='timing'? (effBed(p.bed)<25): dim==='duration'? ((p.sleep||0)>=420) : ((p.kcal||0)<=2600);
        this._pts.forEach(p=>{ p.good=good(p); });
        const ins=insightFor(dim,this._pts);
        this._read.innerHTML='';
        const tag=document.createElement('div');
        tag.style.cssText='font-family:JetBrains Mono,monospace;font-size:10.5px;letter-spacing:.28em;color:#7a7a7a;margin-bottom:9px';
        tag.textContent=(this._real?'YOUR DATA':'PATTERN PREVIEW')+' · '+DIMS[dim].axis+' × PERFORMANCE';
        const head=document.createElement('div');
        head.style.cssText='font-family:Space Grotesk,Archivo,sans-serif;font-size:23px;font-weight:500;letter-spacing:-.01em;color:#fff;line-height:1.15;text-wrap:pretty;max-width:640px';
        head.textContent=ins.head;
        const sub=document.createElement('div');
        sub.style.cssText='margin-top:9px;font-size:13.5px;color:#9a9a9a;line-height:1.5;text-wrap:pretty;max-width:600px';
        sub.textContent=ins.sub;
        this._read.appendChild(tag); this._read.appendChild(head); this._read.appendChild(sub);
      };
      this._paintChips(); this._retint();

      const t0=performance.now();
      const loop=()=>{
        if(!this.isConnected){ this._idleSince=this._idleSince??performance.now(); if(performance.now()-this._idleSince>5000)return; }
        else this._idleSince=null;
        this._raf=requestAnimationFrame(loop);
        const t=(performance.now()-t0)/1000;
        if(!drag) ay+=vy; 
        const cx=W*0.5, cy=H*0.5+18, fov=3.2, spread=Math.min(W,H)*0.30, spY=Math.min(W,H)*0.30;
        ctx.clearRect(0,0,W,H);
        const ca=Math.cos(ay), sa=Math.sin(ay), ct=Math.cos(tilt), st=Math.sin(tilt);
        const proj=(x,y,z)=>{ let rx=x*ca - z*sa, rz=x*sa + z*ca; // rotate about Y
          let ry=y*ct - rz*st, rrz=y*st + rz*ct;               // tilt about X
          const sc=fov/(fov-rrz*1.1); return {x:cx+rx*spread*sc, y:cy - ry*spY*sc, s:sc, depth:rrz}; };
        // ground grid (y=-1.05 plane)
        const G=4; ctx.lineWidth=1;
        for(let i=-G;i<=G;i++){ const u=i/G;
          const a1=proj(u,-1.05,-1),a2=proj(u,-1.05,1); const b1=proj(-1,-1.05,u),b2=proj(1,-1.05,u);
          ctx.strokeStyle='rgba(255,255,255,'+(0.05)+')';
          ctx.beginPath();ctx.moveTo(a1.x,a1.y);ctx.lineTo(a2.x,a2.y);ctx.stroke();
          ctx.beginPath();ctx.moveTo(b1.x,b1.y);ctx.lineTo(b2.x,b2.y);ctx.stroke(); }
        // zero-performance plane (perf=midline) subtle
        const midY = 0; // normalized ~ where perf==avg; draw the y=0 (worst) already ground. Draw break-even band:
        // axis labels
        const axLabel=(x,y,z,txt)=>{ const p=proj(x,y,z); ctx.fillStyle='rgba(255,255,255,.4)'; ctx.font="10px JetBrains Mono,monospace"; ctx.textAlign='center'; ctx.fillText(txt,p.x,p.y); };
        // sort points back-to-front
        const drawn=this._pts.map(p=>({p,pr:proj(p.X,p.Y,p.Z)})).sort((a,b)=>a.pr.depth-b.pr.depth);
        for(const d of drawn){ const p=d.p, pr=d.pr;
          // drop line to ground
          const gp=proj(p.X,-1.05,p.Z);
          ctx.strokeStyle='rgba(255,255,255,'+(0.10)+')'; ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo(pr.x,pr.y);ctx.lineTo(gp.x,gp.y);ctx.stroke();
          // foot
          ctx.fillStyle='rgba(255,255,255,.12)'; ctx.beginPath(); ctx.ellipse(gp.x,gp.y,3.5*pr.s,1.4*pr.s,0,0,7);ctx.fill();
          // point — bright if "good" on active dim, dim otherwise
          const r=(p.good?4.6:3.4)*pr.s*clamp(pr.s,0.7,1.5);
          const bright=p.good?0.95:0.34;
          if(p.good){ ctx.shadowColor='rgba(255,255,255,.7)'; ctx.shadowBlur=10*pr.s; }
          ctx.fillStyle='rgba(255,255,255,'+bright+')';
          ctx.beginPath();ctx.arc(pr.x,pr.y,Math.max(1.2,r),0,7);ctx.fill();
          ctx.shadowBlur=0;
          if(p.good){ ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=1; ctx.beginPath();ctx.arc(pr.x,pr.y,Math.max(1.2,r)+2,0,7);ctx.stroke(); }
        }
        // axes labels
        const dim=this._dim;
        axLabel(0,-1.28,1.15, DIMS.timing.axis+' \u2192');
        axLabel(1.28,0,0,'');
        // vertical PERFORMANCE label on left
        ctx.save(); const pv=proj(-1.15,0.2,-1); ctx.translate(pv.x,pv.y); ctx.rotate(-Math.PI/2);
        ctx.fillStyle='rgba(255,255,255,.38)'; ctx.font="10px JetBrains Mono,monospace"; ctx.textAlign='center'; ctx.fillText('PERFORMANCE \u2191',0,0); ctx.restore();
        axLabel(0.2,-1.28,-1.15, DIMS.duration.axis+' (depth)');
      };
      this._loop=loop; loop();
    }
  }
  if(!customElements.get('phntm-insight')) customElements.define('phntm-insight',PhntmInsight);
})();
