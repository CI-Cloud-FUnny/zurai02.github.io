const WasmEngine = (() => {
  const PARTICLE_COUNT = 80;
  const CONNECT_DIST   = 140;
  const SPEED_MIN      = 0.15;
  const SPEED_MAX      = 0.55;
  const SIZE_MIN       = 1.5;
  const SIZE_MAX       = 3.5;
  const COLOR          = "255,107,53";

  let engine  = null;
  let running = false;
  let rafId   = null;

  const rand     = (mn, mx) => mn + Math.random() * (mx - mn);
  const randSign = ()        => Math.random() < 0.5 ? 1 : -1;

  async function loadWasm() {
    try {
      const mod = await import("./pkg/particle_engine.js");
      await mod.default();
      engine = new mod.ParticleEngine(PARTICLE_COUNT);
      console.log("[wasm] Rust engine loaded.");
    } catch (err) {
      console.warn("[wasm] fallback to JS.", err);
      engine = null;
    }
  }

  function initParticles(w, h) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      engine.set_particle(i,
        rand(0,w), rand(0,h),
        randSign()*rand(SPEED_MIN,SPEED_MAX),
        randSign()*rand(SPEED_MIN,SPEED_MAX),
        rand(0.3,0.9), rand(SIZE_MIN,SIZE_MAX)
      );
    }
  }

  function drawWasm(ctx, w, h, dt) {
    engine.update(w, h, dt * 60);
    ctx.clearRect(0, 0, w, h);
    for (let i=0; i<PARTICLE_COUNT; i++) {
      for (let j=i+1; j<PARTICLE_COUNT; j++) {
        const a = engine.connection_alpha(i, j, CONNECT_DIST);
        if (a<=0) continue;
        ctx.beginPath();
        ctx.moveTo(engine.get_x(i), engine.get_y(i));
        ctx.lineTo(engine.get_x(j), engine.get_y(j));
        ctx.strokeStyle=`rgba(${COLOR},${(a*0.35).toFixed(3)})`;
        ctx.lineWidth=0.75; ctx.stroke();
      }
    }
    for (let i=0; i<PARTICLE_COUNT; i++) {
      ctx.beginPath();
      ctx.arc(engine.get_x(i), engine.get_y(i), engine.get_size(i), 0, Math.PI*2);
      ctx.fillStyle=`rgba(${COLOR},${engine.get_alpha(i).toFixed(3)})`;
      ctx.fill();
    }
  }

  class JSParticle {
    constructor(w,h) {
      this.x=rand(0,w); this.y=rand(0,h);
      this.vx=randSign()*rand(SPEED_MIN,SPEED_MAX);
      this.vy=randSign()*rand(SPEED_MIN,SPEED_MAX);
      this.alpha=rand(0.3,0.9); this.size=rand(SIZE_MIN,SIZE_MAX);
    }
  }

  function drawJS(ctx, pts, w, h, dt) {
    const mv=dt*60, tsq=CONNECT_DIST*CONNECT_DIST;
    ctx.clearRect(0,0,w,h);
    for (const p of pts) {
      p.x+=p.vx*mv; p.y+=p.vy*mv;
      if(p.x<0)p.x=w; if(p.x>w)p.x=0;
      if(p.y<0)p.y=h; if(p.y>h)p.y=0;
    }
    for (let i=0;i<pts.length;i++) for (let j=i+1;j<pts.length;j++) {
      const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y, dsq=dx*dx+dy*dy;
      if(dsq>=tsq) continue;
      ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y);
      ctx.strokeStyle=`rgba(${COLOR},${((1-dsq/tsq)*0.35).toFixed(3)})`; ctx.lineWidth=0.75; ctx.stroke();
    }
    for (const p of pts) {
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fillStyle=`rgba(${COLOR},${p.alpha})`; ctx.fill();
    }
  }

  function resize(c) { c.width=window.innerWidth; c.height=window.innerHeight; }

  async function init(canvas) {
    if (!canvas||running) return;
    running=true;
    const ctx=canvas.getContext("2d");
    resize(canvas);
    window.addEventListener("resize",()=>resize(canvas));
    await loadWasm();
    let jsP=null;
    if (engine) initParticles(canvas.width, canvas.height);
    else jsP=Array.from({length:PARTICLE_COUNT},()=>new JSParticle(canvas.width,canvas.height));
    let last=performance.now();
    function frame(now) {
      const dt=Math.min((now-last)/1000,0.05); last=now;
      engine ? drawWasm(ctx,canvas.width,canvas.height,dt)
             : drawJS(ctx,jsP,canvas.width,canvas.height,dt);
      rafId=requestAnimationFrame(frame);
    }
    rafId=requestAnimationFrame(frame);
  }

  return { init, stop: ()=>{ if(rafId) cancelAnimationFrame(rafId); running=false; rafId=null; } };
})();

document.addEventListener("DOMContentLoaded",()=>{
  const c=document.getElementById("bg-canvas");
  if(c) WasmEngine.init(c);
});
