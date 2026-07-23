// <chrome-p> — rotating liquid-chrome letter P, transparent over black
(function(){
class ChromeP extends HTMLElement{
  connectedCallback(){ if(this._init) return; this._init=true; this.style.display='block'; this._start(); }
  disconnectedCallback(){ cancelAnimationFrame(this._raf); if(this._ro) this._ro.disconnect(); if(this._renderer) this._renderer.dispose(); }
  async _start(){
    const THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
    if(!this.isConnected) return;
    const canvas=document.createElement('canvas');
    canvas.style.cssText='width:100%;height:100%;display:block';
    this.appendChild(canvas);
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
    this._renderer=renderer;
    const scene=new THREE.Scene();
    const cam=new THREE.PerspectiveCamera(32,1,.1,100); cam.position.set(0,0,26);
    // minimal studio environment for chrome reflections
    const env=new THREE.Scene();
    env.background=new THREE.Color(0x000000);
    const mk=(w,h,i,x,y,z,rx,ry)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color().setScalar(i)}));m.position.set(x,y,z);m.rotation.set(rx||0,ry||0,0);env.add(m)};
    mk(14,4,18,0,7,-6,Math.PI/2.6,0); mk(3,14,10,-8,0,-4,0,Math.PI/3); mk(3,14,6,8,0,-4,0,-Math.PI/3); mk(16,2,4,0,-7,-5,-Math.PI/2.4,0); mk(2,10,25,0,2,8,0,Math.PI);
    const pmrem=new THREE.PMREMGenerator(renderer);
    const envTex=pmrem.fromScene(env,0.04).texture;
    // letter P shape
    const s=new THREE.Shape();
    s.moveTo(0,0); s.lineTo(0,10); s.lineTo(4.4,10);
    s.quadraticCurveTo(7.4,10,7.4,7.55); s.quadraticCurveTo(7.4,5.1,4.4,5.1);
    s.lineTo(2.3,5.1); s.lineTo(2.3,0); s.closePath();
    const h=new THREE.Path();
    h.moveTo(2.3,8.55); h.lineTo(4.2,8.55); h.quadraticCurveTo(5.5,8.55,5.5,7.55);
    h.quadraticCurveTo(5.5,6.55,4.2,6.55); h.lineTo(2.3,6.55); h.closePath();
    s.holes.push(h);
    const geo=new THREE.ExtrudeGeometry(s,{depth:1.9,bevelEnabled:true,bevelThickness:.55,bevelSize:.5,bevelSegments:8,curveSegments:48});
    geo.center();
    const mat=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:1,roughness:.06,envMap:envTex,envMapIntensity:1.35,clearcoat:1,clearcoatRoughness:.08});
    const mesh=new THREE.Mesh(geo,mat);
    const grp=new THREE.Group(); grp.add(mesh); grp.rotation.x=.08; scene.add(grp);
    const fit=()=>{const w=this.clientWidth||300,hh=this.clientHeight||300;renderer.setSize(w,hh,false);cam.aspect=w/hh;cam.updateProjectionMatrix()};
    this._ro=new ResizeObserver(fit); this._ro.observe(this); fit();
    const t0=performance.now();
    const loop=()=>{this._raf=requestAnimationFrame(loop);
      const t=(performance.now()-t0)/1000;
      grp.rotation.y=t*.55;
      grp.position.y=Math.sin(t*.8)*.35;
      grp.rotation.x=.08+Math.sin(t*.5)*.05;
      renderer.render(scene,cam)};
    loop();
  }
}
if(!customElements.get('chrome-p')) customElements.define('chrome-p',ChromeP);
})();
