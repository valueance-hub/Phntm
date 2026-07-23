// <bg-fx mode="mist|rain|ridge|grid|sweep|dust|candles|starfall|vortex"> — monochrome background overlays
(function(){
class BgFx extends HTMLElement{
  connectedCallback(){
    if(this._i){ if(this._ro)this._ro.observe(this); if(this._loop){cancelAnimationFrame(this._raf);this._loop();} return; }
    this._i=1; this.style.display='block'; this.style.width='100%'; this.style.height='100%'; this._start();
  }
  disconnectedCallback(){ setTimeout(()=>{ if(!this.isConnected){ cancelAnimationFrame(this._raf); if(this._ro)this._ro.disconnect(); } },0); }
  _start(){
    const cv=document.createElement('canvas');
    cv.style.cssText='width:100%;height:100%;display:block';
    this.appendChild(cv);
    const ctx=cv.getContext('2d');
    const DPR=Math.min(devicePixelRatio,2);
    let W=0,H=0;
    const fit=()=>{W=this.clientWidth||600;H=this.clientHeight||360;cv.width=W*DPR;cv.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0)};
    this._ro=new ResizeObserver(fit); this._ro.observe(this); fit();
    let seed=91; const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
    const A=parseFloat(this.getAttribute('intensity')||'1');
    // pre-seeded fields
    const blobs=Array.from({length:5},()=>({x:rnd(),y:rnd(),r:.35+rnd()*.4,vx:(rnd()-.5)*.012,vy:(rnd()-.5)*.008,ph:rnd()*7}));
    const cols=Array.from({length:26},()=>({x:rnd(),sp:.03+rnd()*.08,off:rnd(),digs:Array.from({length:14},()=>Math.floor(rnd()*10))}));
    const dots=Array.from({length:120},()=>({x:rnd(),y:rnd(),z:.3+rnd()*.7,ph:rnd()*7}));
    const cands=Array.from({length:36},()=>({h:.15+rnd()*.5,w:rnd()<.5,ph:rnd()*7}));
    const flow=Array.from({length:380},()=>({x:rnd(),y:rnd(),l:rnd()}));
    const metas=Array.from({length:6},()=>({x:rnd(),y:rnd(),r:.16+rnd()*.22,vx:(rnd()-.5)*.03,vy:(rnd()-.5)*.02}));
    const threads=Array.from({length:14},()=>({y:rnd(),am:.03+rnd()*.09,sp:.12+rnd()*.3,ph:rnd()*7,a:.05+rnd()*.09}));
    const glows=Array.from({length:4},()=>({x:rnd()*7,y:rnd()*7,vx:.05+rnd()*.05,vy:.04+rnd()*.04,r:.45+rnd()*.4,b:.05+rnd()*.05}));
    const auroraBands=Array.from({length:5},()=>({x:rnd(),w:.1+rnd()*.16,sp:(rnd()-.5)*.015,ph:rnd()*7,br:.035+rnd()*.05}));
    let grains=null;
    const lerp3=(a,b,tt)=>[a[0]+(b[0]-a[0])*tt,a[1]+(b[1]-a[1])*tt,a[2]+(b[2]-a[2])*tt];
    const WR=(()=>{
      const edges=[], lights=[];
      const E=(a,b,al)=>edges.push([a,b,al==null?.5:al]);
      const X0=-3.4,X1=3.4,Y0=-1.5,Y1=1.7,Z0=-1.0,Z1=-9.2;
      for(let i=0;i<=10;i++){const x=X0+(X1-X0)*i/10;E([x,Y0,Z0],[x,Y0,Z1],.10);}
      for(let i=0;i<=12;i++){const z=Z0+(Z1-Z0)*i/12;E([X0,Y0,z],[X1,Y0,z],.10);}
      for(let i=0;i<=8;i++){const x=X0+(X1-X0)*i/8;E([x,Y1,Z0],[x,Y1,Z1],.05);}
      for(let i=0;i<=10;i++){const z=Z0+(Z1-Z0)*i/10;E([X0,Y1,z],[X1,Y1,z],.05);}
      for(let i=0;i<=10;i++){const x=X0+(X1-X0)*i/10;E([x,Y0,Z1],[x,Y1,Z1],.08);}
      for(let i=0;i<=6;i++){const y=Y0+(Y1-Y0)*i/6;E([X0,y,Z1],[X1,y,Z1],.08);}
      for(let i=0;i<=8;i++){const z=Z0+(Z1-Z0)*i/8;E([X0,Y0,z],[X0,Y1,z],.05);E([X1,Y0,z],[X1,Y1,z],.05);}
      const rect=(c,al)=>{for(let i=0;i<4;i++)E(c[i],c[(i+1)%4],al);};
      const panelR=(x,cy,cz,w,hh)=>{const c=[[x,cy-hh,cz-w],[x,cy-hh,cz+w],[x,cy+hh,cz+w],[x,cy+hh,cz-w]];rect(c,.5);for(let k=1;k<5;k++){const tt=k/5;E(lerp3(c[0],c[3],tt),lerp3(c[1],c[2],tt),.14);}};
      const panelZ=(cx,cy,z,w,hh)=>{const c=[[cx-w,cy-hh,z],[cx+w,cy-hh,z],[cx+w,cy+hh,z],[cx-w,cy+hh,z]];rect(c,.45);for(let k=1;k<5;k++){const tt=k/5;E(lerp3(c[0],c[3],tt),lerp3(c[1],c[2],tt),.12);}};
      panelR(X1-.02,.55,-3.4,1.2,.8); panelR(X1-.02,-.1,-6,.9,.6); panelR(X0+.02,.5,-4.5,1.0,.7);
      panelZ(-1.4,.5,Z1+.05,1.1,.7); panelZ(1.2,.3,Z1+.05,1.3,.9); panelZ(-.2,-.4,Z1+.05,.7,.4);
      const box=(cx,cy,cz,w,hh,d,al)=>{const c=[[cx-w,cy-hh,cz-d],[cx+w,cy-hh,cz-d],[cx+w,cy-hh,cz+d],[cx-w,cy-hh,cz+d],[cx-w,cy+hh,cz-d],[cx+w,cy+hh,cz-d],[cx+w,cy+hh,cz+d],[cx-w,cy+hh,cz+d]];for(let i=0;i<4;i++){E(c[i],c[(i+1)%4],al);E(c[i+4],c[((i+1)%4)+4],al);E(c[i],c[i+4],al);}};
      box(-.3,-1.0,-4.4,1.5,.5,1.0,.4); box(1.6,-1.1,-3.0,.4,.4,.4,.3);
      for(let i=0;i<44;i++){const ax=X0+rnd()*(X1-X0),az=Z0+(Z1-Z0)*rnd();E([ax,Y0,az],[ax+(rnd()-.5)*2.2,Y1,az+(rnd()-.5)*2.2],.03+rnd()*.05);}
      for(let i=0;i<6;i++){lights.push([X0+(X1-X0)*rnd(),Y1-.05,Z0+(Z1-Z0)*(.08+rnd()*.55),.4+rnd()*.6]);}
      return {edges,lights};
    })();
    const LOG=['09:41:12 NQ SHORT 2 @ 20,184.25 → +1.8R','09:12:40 GC LONG 1 @ 2,391.10 → +2.2R','08:58:31 ES LONG 3 @ 5,612.50 → −0.6R','RULE CHECK — SIZE WITHIN 1.0%','A+ SETUP · SWEEP + FVG','14:22:08 NQ LONG 2 @ 20,201.75 → +0.9R','JOURNAL NOTE — PATIENCE PAID','03:40:55 BTC LONG 0.5 @ 64,210 → +3.1R','GHOST FLAG — REVENGE RISK','11:05:19 CL SHORT 1 @ 81.44 → −0.7R','DISCIPLINE 93% — 2 BREAKS','PAYOUT REQUEST — $4,000 SENT'];
    const tape=Array.from({length:34},(_,i)=>({s:LOG[Math.floor(rnd()*LOG.length)],x:.06+rnd()*.88,sp:.02+rnd()*.05,ph:rnd(),hot:rnd()<.18}));
    const ohlc=(()=>{let v=.5;return Array.from({length:48},()=>{const o=v,c=v+(rnd()-.42)*.09;v=Math.max(.12,Math.min(.88,c));return{o,c,h:Math.max(o,c)+rnd()*.03,l:Math.min(o,c)-rnd()*.03}})})();
    let off=null,offx=null,ex=0,eprev=null;
    const mkOff=()=>{off=document.createElement('canvas');off.width=W*DPR;off.height=H*DPR;offx=off.getContext('2d');offx.setTransform(DPR,0,0,DPR,0,0)};
    let mx=.5,myy=.45,hasM=false;
    this._mm=(e)=>{const b=this.getBoundingClientRect();if(e.clientX>=b.left&&e.clientX<=b.right&&e.clientY>=b.top&&e.clientY<=b.bottom){mx=(e.clientX-b.left)/b.width;myy=(e.clientY-b.top)/b.height;hasM=true}};
    window.addEventListener('mousemove',this._mm);
    const t0=performance.now();
    const mode=()=>this.getAttribute('mode')||'mist';
    const loop=()=>{ this._raf=requestAnimationFrame(loop);
      const t=(performance.now()-t0)/1000;
      ctx.clearRect(0,0,W,H);
      const m=mode();
      if(m==='mist'){
        for(const b of blobs){
          const x=((b.x+t*b.vx)%1+1)%1*W, y=((b.y+t*b.vy)%1+1)%1*H;
          const r=b.r*Math.min(W,H)*(1+.12*Math.sin(t*.4+b.ph));
          const g=ctx.createRadialGradient(x,y,0,x,y,r);
          g.addColorStop(0,`rgba(255,255,255,${.045*A})`); g.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); }
      } else if(m==='rain'){
        ctx.font="11px 'JetBrains Mono',monospace"; ctx.textAlign='center';
        for(const c of cols){ const x=c.x*W;
          for(let i=0;i<c.digs.length;i++){
            const y=(((c.off+t*c.sp)+i/c.digs.length)%1)*H;
            const a=(1-i/c.digs.length)*.13*A;
            ctx.fillStyle=`rgba(255,255,255,${a})`;
            ctx.fillText(c.digs[(i+Math.floor(t*2))%c.digs.length],x,y); } }
      } else if(m==='ridge'){
        for(let l=0;l<7;l++){ ctx.beginPath();
          for(let x=0;x<=W;x+=8){ const u=x/W;
            const y=H*(.18+l*.11)+Math.sin(u*4.5+t*.35+l*1.4)*14+Math.sin(u*9-t*.22+l)*7;
            x?ctx.lineTo(x,y):ctx.moveTo(x,y); }
          ctx.strokeStyle=`rgba(255,255,255,${(.05+l*.012)*A})`; ctx.lineWidth=1; ctx.stroke(); }
      } else if(m==='grid'){
        ctx.strokeStyle=`rgba(255,255,255,${.05*A})`; ctx.lineWidth=1;
        const s=54, ox=(t*6)%s;
        for(let x=-ox;x<W;x+=s){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
        for(let y=-ox;y<H;y+=s){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
        const sx=((t*.07)%1.4-.2)*W;
        const g=ctx.createLinearGradient(sx-140,0,sx+140,0);
        g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,`rgba(255,255,255,${.06*A})`);g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g; ctx.fillRect(sx-140,0,280,H);
      } else if(m==='sweep'){
        const cx=W*.5, cy=H*1.15, ang=-Math.PI*.78+Math.sin(t*.18)*Math.PI*.28;
        for(let i=0;i<3;i++){ const a2=ang+i*.05;
          const x2=cx+Math.cos(a2)*W*1.6, y2=cy+Math.sin(a2)*W*1.6;
          const g=ctx.createLinearGradient(cx,cy,x2,y2);
          g.addColorStop(0,`rgba(255,255,255,${.10*A/(i+1)})`); g.addColorStop(1,'rgba(255,255,255,0)');
          ctx.strokeStyle=g; ctx.lineWidth=90-i*24;
          ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x2,y2); ctx.stroke(); }
      } else if(m==='dust'){
        for(const d of dots){
          const x=((d.x+t*.008*d.z)%1)*W, y=((d.y-t*.004*d.z)%1+1)%1*H;
          const a=(.04+.1*d.z)*(.6+.4*Math.sin(t*1.1+d.ph))*A;
          ctx.fillStyle=`rgba(255,255,255,${a})`;
          ctx.fillRect(x,y,d.z*1.8,d.z*1.8); }
      } else if(m==='flowfield'){
        for(const p of flow){
          const u=p.x,v=p.y;
          const a=Math.sin(u*5.3+t*.25)*1.7+Math.cos(v*4.1-t*.2)*1.7;
          p.x=(p.x+Math.cos(a)*.0009+1)%1; p.y=(p.y+Math.sin(a)*.0016+1)%1;
          p.l+=.004; if(p.l>1){p.l=0;p.x=rnd();p.y=rnd();}
          const fade=Math.sin(p.l*Math.PI);
          ctx.fillStyle=`rgba(255,255,255,${.14*fade*A})`;
          ctx.fillRect(p.x*W,p.y*H,1.3,1.3); }
      } else if(m==='metaball'){
        ctx.save(); ctx.filter='blur(26px)';
        for(const b of metas){
          const x=(Math.sin(t*b.vx*9+b.x*7)*.5+.5)*W, y=(Math.sin(t*b.vy*9+b.y*7)*.5+.5)*H;
          const r=b.r*Math.min(W,H);
          const g=ctx.createRadialGradient(x,y,0,x,y,r);
          g.addColorStop(0,`rgba(255,255,255,${.13*A})`); g.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); }
        ctx.restore();
      } else if(m==='grain'){
        for(const g0 of glows){
          const x=(Math.sin(t*g0.vx+g0.x)*.5+.5)*W, y=(Math.sin(t*g0.vy+g0.y)*.5+.5)*H*.85;
          const r=g0.r*Math.max(W,H);
          const g=ctx.createRadialGradient(x,y,0,x,y,r);
          g.addColorStop(0,`rgba(255,255,255,${g0.b*A})`); g.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); }
        const vg=ctx.createLinearGradient(0,0,0,H);
        vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(.55,'rgba(0,0,0,0)'); vg.addColorStop(1,`rgba(0,0,0,${.38*A})`);
        ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
        if(!grains){ grains=[]; for(let i=0;i<3;i++){ const c=document.createElement('canvas'); c.width=c.height=256; const gx=c.getContext('2d'); const id=gx.createImageData(256,256); for(let p=0;p<id.data.length;p+=4){ const v=(Math.random()*255)|0; id.data[p]=id.data[p+1]=id.data[p+2]=v; id.data[p+3]=255; } gx.putImageData(id,0,0); grains.push(c); } }
        const gt=grains[this.hasAttribute('static-grain')?0:Math.floor(t*10)%3];
        ctx.globalAlpha=.055*A;
        for(let y=0;y<H;y+=256) for(let x=0;x<W;x+=256) ctx.drawImage(gt,x,y);
        ctx.globalAlpha=1;
      } else if(m==='aurora'){
        for(const bd of auroraBands){
          const x=(((bd.x+t*bd.sp)%1)+1)%1*W, w=bd.w*W;
          const a=bd.br*(.45+.55*Math.sin(t*.22+bd.ph))*A;
          const g=ctx.createLinearGradient(x-w,0,x+w,0);
          g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(.5,`rgba(255,255,255,${a})`); g.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle=g; ctx.fillRect(x-w,0,w*2,H); }
        const vg=ctx.createRadialGradient(W*.5,H*.42,Math.min(W,H)*.15,W*.5,H*.5,Math.max(W,H)*.72);
        vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,`rgba(0,0,0,${.4*A})`);
        ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
      } else if(m==='halftone'){
        const s=26;
        for(let y=s/2;y<H;y+=s) for(let x=s/2;x<W;x+=s){
          const w=Math.sin(x/W*6+t*.5)+Math.cos(y/H*5-t*.35)+Math.sin((x+y)/(W+H)*8+t*.3);
          const r=Math.max(0,(w+1.4)/3.4)*4.4;
          if(r<.3)continue;
          ctx.fillStyle=`rgba(255,255,255,${.10*A})`;
          ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); }
      } else if(m==='orbit'){
        const cx=W*.78, cy=H*.4;
        for(let i=0;i<9;i++){ const r=40+i*44;
          const a0=t*(.05+i*.013)*(i%2?1:-1), arc=1.1+(i%3)*.9;
          ctx.strokeStyle=`rgba(255,255,255,${(.12-i*.01)*A})`; ctx.lineWidth=i%3?1:2;
          ctx.beginPath(); ctx.arc(cx,cy,r,a0,a0+arc); ctx.stroke();
          ctx.fillStyle=`rgba(255,255,255,${.35*A})`;
          ctx.beginPath(); ctx.arc(cx+Math.cos(a0)*r,cy+Math.sin(a0)*r,1.6,0,7); ctx.fill(); }
      } else if(m==='terrain'){
        const rows=14, horizon=H*.32;
        for(let i=1;i<=rows;i++){ const p=i/rows, y0=horizon+p*p*(H-horizon);
          ctx.beginPath();
          for(let x=0;x<=W;x+=10){ const u=x/W-.5;
            const zz=(1-p)*3+((t*.5)%1)*0;
            const hgt=(Math.sin(u*7+i*.9+t*.4)+Math.sin(u*13-i*.6-t*.3))*10*p;
            const px2=W/2+u*W*(.25+p*.75);
            x?ctx.lineTo(px2,y0-hgt):ctx.moveTo(px2,y0-hgt); }
          ctx.strokeStyle=`rgba(255,255,255,${(.03+p*.09)*A})`; ctx.lineWidth=1; ctx.stroke(); }
      } else if(m==='typo'){
        ctx.textAlign='center'; ctx.textBaseline='middle';
        for(let i=4;i>=0;i--){
          const sc=1+i*.16, dx=Math.sin(t*.2+i)*14*i, dy=Math.cos(t*.16+i)*8*i;
          ctx.font=`200 ${Math.min(W,H)*.34*sc}px 'Archivo',sans-serif`;
          if(i===0){ ctx.fillStyle=`rgba(255,255,255,${.045*A})`; ctx.fillText('PHNTM',W/2+dx,H/2+dy); }
          else { ctx.strokeStyle=`rgba(255,255,255,${(.05-i*.008)*A}`+')'; ctx.lineWidth=1; ctx.strokeText('PHNTM',W/2+dx,H/2+dy); } }
      } else if(m==='threads'){
        for(const th of threads){ ctx.beginPath();
          for(let x=0;x<=W;x+=6){ const u=x/W;
            const env=Math.sin(u*Math.PI);
            const y=th.y*H+Math.sin(u*3.2+t*th.sp+th.ph)*th.am*H*env+Math.sin(u*8-t*th.sp*.7+th.ph)*th.am*H*.3*env;
            x?ctx.lineTo(x,y):ctx.moveTo(x,y); }
          ctx.strokeStyle=`rgba(255,255,255,${th.a*A})`; ctx.lineWidth=1; ctx.stroke(); }
      } else if(m==='tape'){
        ctx.font="10.5px 'JetBrains Mono',monospace"; ctx.textAlign='left';
        for(const r of tape){
          const p=((r.ph-t*r.sp)%1+1)%1;
          const a=Math.sin(p*Math.PI)*(r.hot?.22:.09)*A;
          ctx.fillStyle=`rgba(255,255,255,${a})`;
          ctx.fillText(r.s,r.x*W-90,p*H); }
      } else if(m==='replay'){
        const CYC=16,p=(t%CYC)/CYC, fade=p>.88?Math.max(0,1-(p-.88)/.1):1;
        const nc=Math.min(48,p/.88*48), cw=W/56, x0=cw*4;
        ctx.globalAlpha=fade;
        ctx.strokeStyle=`rgba(255,255,255,${.08*A})`;
        for(const gy of [.25,.5,.75]){ctx.beginPath();ctx.moveTo(x0,H*gy);ctx.lineTo(W-cw*2,H*gy);ctx.stroke();}
        ctx.fillStyle=`rgba(255,255,255,${.25*A})`; ctx.font="10px 'JetBrains Mono',monospace"; ctx.textAlign='left';
        ctx.fillText('GHOST OF LAST SESSION — REPLAYING',x0,H*.13);
        for(let i=0;i<nc;i++){ const c=ohlc[i], k=Math.min(1,nc-i);
          const x=x0+i*cw, bw=cw*.55;
          const Yv=(v)=>H*(.2+(1-v)*.6);
          const up=c.c>=c.o;
          ctx.strokeStyle=`rgba(255,255,255,${.3*A})`; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(x+bw/2,Yv(c.h)); ctx.lineTo(x+bw/2,Yv(c.l)); ctx.stroke();
          const by=Yv(Math.max(c.o,c.c)), bh=Math.max(2,Math.abs(Yv(c.o)-Yv(c.c)))*k;
          if(up){ctx.strokeRect(x+.5,by+.5,bw-1,bh-1)}else{ctx.fillStyle=`rgba(255,255,255,${.28*A})`;ctx.fillRect(x,by,bw,bh)}
          if((i===12||i===34)&&nc-i<3){ const ring=(nc-i)/3;
            ctx.strokeStyle=`rgba(255,255,255,${(1-ring)*.6*A})`;
            ctx.beginPath(); ctx.arc(x+bw/2,Yv(c.c),6+ring*22,0,7); ctx.stroke(); } }
        if(nc>0&&nc<48){ const c=ohlc[Math.floor(nc)], x=x0+Math.floor(nc)*cw+cw*.28;
          ctx.fillStyle=`rgba(255,255,255,${.8*A})`;
          ctx.beginPath(); ctx.arc(x,H*(.2+(1-c.c)*.6),2.4,0,7); ctx.fill(); }
        ctx.globalAlpha=1;
      } else if(m==='pulse'){
        if(!off||off.width!==W*DPR)mkOff();
        offx.globalCompositeOperation='destination-out';
        offx.fillStyle='rgba(0,0,0,.02)'; offx.fillRect(0,0,W,H);
        offx.globalCompositeOperation='source-over';
        const spd=W*.14, nx=(ex+spd/60)%W;
        const beat=(x)=>{ const u=(x/W*3)%1;
          if(u<.42)return Math.sin(u/.42*Math.PI)*.02;
          if(u<.47)return -(u-.42)/.05*.05;
          if(u<.53)return -.05+((u-.47)/.06)*.34;
          if(u<.6)return .29-((u-.53)/.07)*.37;
          if(u<.68)return -.08+((u-.6)/.08)*.08;
          return Math.sin((u-.68)/.32*Math.PI)*.03; };
        const Yb=(x)=>H*.58-beat(x)*H;
        if(nx>ex){ offx.strokeStyle=`rgba(255,255,255,${.5*A})`; offx.lineWidth=1.4;
          offx.beginPath(); offx.moveTo(ex,Yb(ex)); offx.lineTo(nx,Yb(nx)); offx.stroke(); }
        ex=nx; eprev=null;
        offx.globalCompositeOperation='destination-out';
        offx.fillRect(nx+2,0,50,H);
        offx.globalCompositeOperation='source-over';
        ctx.drawImage(off,0,0,W,H);
        ctx.fillStyle=`rgba(255,255,255,${.85*A})`;
        ctx.beginPath(); ctx.arc(nx,Yb(nx),2.2,0,7); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${.2*A})`; ctx.font="10px 'JetBrains Mono',monospace"; ctx.textAlign='left';
        ctx.fillText('MARKET PULSE — 72 BPM',24,H-20);
      } else if(m==='xray'){
        if(!off||off.width!==W*DPR)mkOff();
        offx.clearRect(0,0,W,H);
        offx.strokeStyle='rgba(255,255,255,.16)'; offx.lineWidth=1;
        for(let x=0;x<W;x+=46){offx.beginPath();offx.moveTo(x,0);offx.lineTo(x,H);offx.stroke();}
        for(let y=0;y<H;y+=46){offx.beginPath();offx.moveTo(0,y);offx.lineTo(W,y);offx.stroke();}
        offx.strokeStyle='rgba(255,255,255,.7)'; offx.lineWidth=1.5; offx.beginPath();
        for(let x=0;x<=W;x+=12){ const u=x/W;
          const y=H*.72-u*H*.4+Math.sin(u*9)*16+Math.sin(u*23)*7;
          x?offx.lineTo(x,y):offx.moveTo(x,y); }
        offx.stroke();
        offx.font="10px 'JetBrains Mono',monospace"; offx.fillStyle='rgba(255,255,255,.6)';
        offx.fillText('ENTRY 20,184.25',W*.22,H*.66); offx.fillText('EXIT +1.8R',W*.62,H*.4);
        offx.fillText('STOP — NEVER MOVED',W*.4,H*.82);
        for(const [ux,uy] of [[.22,.7],[.62,.44],[.84,.28]]){
          offx.strokeStyle='rgba(255,255,255,.8)';
          offx.beginPath(); offx.arc(W*ux,H*uy,5,0,7); offx.stroke(); }
        const lx=hasM?mx*W:W*(.5+.32*Math.sin(t*.3)), ly=hasM?myy*H:H*(.5+.28*Math.cos(t*.23));
        const R=Math.min(W,H)*.34;
        const g=ctx.createRadialGradient(lx,ly,0,lx,ly,R);
        g.addColorStop(0,`rgba(255,255,255,${.95*A})`); g.addColorStop(.7,`rgba(255,255,255,${.35*A})`); g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(lx,ly,R,0,7); ctx.fill();
        ctx.globalCompositeOperation='source-in';
        ctx.drawImage(off,0,0,W,H);
        ctx.globalCompositeOperation='source-over';
        ctx.strokeStyle=`rgba(255,255,255,${.14*A})`;
        ctx.beginPath(); ctx.arc(lx,ly,R*.99,0,7); ctx.stroke();
      } else if(m==='monolith'){
        ctx.font="10.5px 'JetBrains Mono',monospace"; ctx.textAlign='left';
        const wall=(sign)=>{ ctx.save();
          ctx.transform(1,sign*.16,0,1,sign>0?0:W*.55,sign>0?0:-W*.55*.16);
          for(let c2=0;c2<3;c2++){ const x=(sign>0?40:W*.02)+c2*150;
            for(let i2=0;i2<16;i2++){
              const p=(((i2/16)+t*.014*(1+c2*.3)*(sign>0?1:1.4))%1);
              const a=Math.sin(p*Math.PI)*(.16-c2*.04)*A;
              ctx.fillStyle=`rgba(255,255,255,${a})`;
              ctx.fillText(LOG[(i2+c2*5)%LOG.length],x,p*H*1.1); } }
          ctx.restore(); };
        wall(1); wall(-1);
        const g=ctx.createLinearGradient(0,0,W,0);
        g.addColorStop(.42,'rgba(6,6,6,0)');g.addColorStop(.5,`rgba(255,255,255,${.03*A})`);g.addColorStop(.58,'rgba(6,6,6,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      } else if(m==='candles'){
        const n=cands.length, cw=W/n;
        for(let i=0;i<n;i++){ const c=cands[i];
          const h=H*c.h*(1+.14*Math.sin(t*.5+c.ph));
          const y=H-h, bw=cw*.44, x=i*cw+cw*.28;
          ctx.strokeStyle=`rgba(255,255,255,${.07*A})`; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(x+bw/2,y-h*.18); ctx.lineTo(x+bw/2,H); ctx.stroke();
          if(c.w){ ctx.fillStyle=`rgba(255,255,255,${.06*A})`; ctx.fillRect(x,y,bw,h); }
          else { ctx.strokeRect(x+.5,y+.5,bw-1,h-1); } }
      } else if(m==='vortex'){
        const cx=W*.33, cy=H*.62, Rmax=Math.min(W,H)*.5, flat=.34, topY=H*.06;
        if(!this._vst){ this._vst={
          stars:Array.from({length:220},()=>({x:rnd(),y:rnd()*.92,r:rnd()*1.3+.2,ph:rnd()*7,tw:.4+rnd()*1.1})),
          disk:Array.from({length:520},()=>({a:rnd()*7,rad:.08+rnd()*.9,sp:.3+rnd()*.8,sz:rnd()*1.7+.3})),
          rise:Array.from({length:80},()=>({p:rnd(),x:(rnd()-.5),sp:.2+rnd()*.7,sz:rnd()*1.3+.3})) }; }
        const V=this._vst;
        for(const s of V.stars){ const a=(.25+.75*Math.abs(Math.sin(t*s.tw+s.ph)))*(.4+.6*s.r/1.5)*A; ctx.fillStyle=`rgba(255,255,255,${a.toFixed(2)})`; ctx.fillRect(s.x*W,s.y*H,s.r,s.r); }
        ctx.globalCompositeOperation='lighter';
        let bg=ctx.createRadialGradient(cx,cy,0,cx,cy,Rmax*.72); bg.addColorStop(0,`rgba(255,255,255,${.8*A})`); bg.addColorStop(.22,`rgba(255,255,255,${.16*A})`); bg.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(cx,cy,Rmax*.72,0,7); ctx.fill();
        for(let i=0;i<3;i++){ ctx.strokeStyle=`rgba(255,255,255,${(.05-i*.012)*A})`; ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(cx,cy,Rmax*(.5+i*.22),Rmax*flat*(.5+i*.22),0,0,7); ctx.stroke(); }
        for(const p of V.disk){ p.a+=(p.sp/(p.rad+.12))*.008; p.rad-=.0012*p.sp; if(p.rad<.05){ p.rad=.55+rnd()*.45; p.a=rnd()*7; }
          const R=p.rad*Rmax, x=cx+Math.cos(p.a)*R, y=cy+Math.sin(p.a)*R*flat, inner=1-p.rad, a=(.12+.72*inner)*A, sz=p.sz*(.6+inner);
          ctx.fillStyle=`rgba(255,255,255,${a.toFixed(2)})`; ctx.fillRect(x,y,sz,sz); }
        const pulse=.82+.12*Math.sin(t*4)+.06*Math.sin(t*13.7);
        const G=ctx.createLinearGradient(0,cy,0,topY); G.addColorStop(0,`rgba(255,255,255,${.98*A})`); G.addColorStop(.55,`rgba(255,255,255,${.8*A})`); G.addColorStop(1,'rgba(255,255,255,0)');
        ctx.strokeStyle=G; ctx.lineWidth=1;
        for(let gx=-28;gx<=28;gx++){ ctx.globalAlpha=Math.exp(-(gx*gx)/(2*5*5))*pulse; ctx.beginPath(); ctx.moveTo(cx+gx,cy); ctx.lineTo(cx+gx,topY); ctx.stroke(); }
        ctx.globalAlpha=pulse; ctx.strokeStyle=`rgba(255,255,255,${.98*A})`; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,topY); ctx.stroke();
        ctx.globalAlpha=1;
        for(const p of V.rise){ p.p+=p.sp*.006; if(p.p>1){p.p=0;p.x=(rnd()-.5);} const py=cy-(cy-topY)*p.p, px=cx+p.x*(6+p.p*40), a=(1-p.p)*.8*A; ctx.fillStyle=`rgba(255,255,255,${a.toFixed(2)})`; ctx.fillRect(px,py,p.sz,p.sz); }
        const star=6+2*Math.sin(t*5); const sg=ctx.createRadialGradient(cx,topY,0,cx,topY,star*5); sg.addColorStop(0,`rgba(255,255,255,${.95*A})`); sg.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(cx,topY,star*5,0,7); ctx.fill();
        ctx.strokeStyle=`rgba(255,255,255,${.6*A*pulse})`; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(cx-star*4,topY); ctx.lineTo(cx+star*4,topY); ctx.moveTo(cx,topY-star*3); ctx.lineTo(cx,topY+star*3); ctx.stroke();
        ctx.globalCompositeOperation='source-over';
        const vg=ctx.createRadialGradient(cx,H*.5,Math.min(W,H)*.2,cx,H*.5,Math.max(W,H)*.75); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,`rgba(0,0,0,${.5*A})`); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
      } else if(m==='starfall'){
        // cosmos drifting diagonally at an angle — layered parallax + occasional streaks
        const ang=(parseFloat(this.getAttribute('angle'))||24)*Math.PI/180; // from vertical
        const dx=Math.sin(ang), dy=Math.cos(ang), span=W+H;
        if(!this._sf){ this._sf={
          neb:Array.from({length:5},()=>({x:rnd(),y:rnd(),r:.3+rnd()*.45,ph:rnd()*7,b:.02+rnd()*.03})),
          stars:Array.from({length:420},()=>({c:rnd(),d:rnd(),z:rnd(),ph:rnd()*7,tw:.4+rnd()*1.3})),
          streaks:Array.from({length:7},()=>({p:1+rnd()*3,c:rnd(),z:.55+rnd()*.45,sp:.5+rnd()*.5,len:.05+rnd()*.06})) }; }
        const S=this._sf;
        // soft drifting nebulae for depth
        ctx.globalCompositeOperation='lighter';
        for(const n of S.neb){ const nx=(((n.x+t*.006*dx)%1)+1)%1*W, ny=(((n.y+t*.006*dy)%1)+1)%1*H, r=n.r*Math.min(W,H);
          const g=ctx.createRadialGradient(nx,ny,0,nx,ny,r); g.addColorStop(0,`rgba(255,255,255,${(n.b*A).toFixed(3)})`); g.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(nx,ny,r,0,7); ctx.fill(); }
        // parallax stars travelling along the diagonal
        for(const s of S.stars){
          const speed=(.012+.055*s.z)*A, prog=(s.d + t*speed);
          // position: cross axis 'c' fixed, travel axis wraps
          const trav=((prog%1)+1)%1;
          const cross=s.c;
          // map (cross, trav) onto screen rotated by ang so motion is diagonal
          const bx=cross*span - H*dx, by=trav*span;
          let x=(bx*dy + by*dx), y=(by*dy - bx*dx);
          x=((x%span)+span)%span - (span-W)/2; y=((y%span)+span)%span - (span-H)/2;
          const sz=.35+s.z*2.3, a=(.28+.68*s.z)*(.55+.45*Math.sin(t*s.tw+s.ph))*A;
          ctx.fillStyle=`rgba(255,255,255,${a.toFixed(2)})`; ctx.fillRect(x,y,sz,sz);
        }
        // occasional shooting streaks along the same angle
        for(const k of S.streaks){ k.p+=k.sp*.010;
          if(k.p>1){ if(rnd()<.03){ k.p=0; k.c=rnd(); k.z=.55+rnd()*.45; k.len=.05+rnd()*.06; } continue; }
          const trav=k.p, cross=k.c;
          const bx=cross*span - H*dx, by=trav*span;
          let x=(bx*dy + by*dx), y=(by*dy - bx*dx);
          x=((x%span)+span)%span - (span-W)/2; y=((y%span)+span)%span - (span-H)/2;
          const L=k.len*span, tx=x-dx*L, ty=y-dy*L, fade=Math.sin(k.p*Math.PI);
          const g=ctx.createLinearGradient(tx,ty,x,y); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(1,`rgba(255,255,255,${(.7*k.z*fade*A).toFixed(2)})`);
          ctx.strokeStyle=g; ctx.lineWidth=1.1*k.z; ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(x,y); ctx.stroke();
          ctx.fillStyle=`rgba(255,255,255,${(.9*k.z*fade*A).toFixed(2)})`; ctx.beginPath(); ctx.arc(x,y,1.2*k.z,0,7); ctx.fill(); }
        ctx.globalCompositeOperation='source-over';
        const vg=ctx.createRadialGradient(W*.5,H*.44,Math.min(W,H)*.18,W*.5,H*.5,Math.max(W,H)*.75); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,`rgba(0,0,0,${.42*A})`); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
      }
    };
    this._loop=loop; loop();
  }
}
if(!customElements.get('bg-fx')) customElements.define('bg-fx',BgFx);
})();
