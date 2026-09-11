(function () {
  'use strict';
  // Geometry adapted from Banyao Kites/blender/hexagonal_kite/build_hexagonal_kite.py.
  // A rectangle plus a 45-degree square: six projecting tips, NOT a regular hexagon.
  // Coordinates are normalized to kite height, with positive Y pointing upwards.
  const OUTLINE = [[-.25,.5],[.25,.5],[.25,.25],[.5,0],[.25,-.25],[.25,-.5],[-.25,-.5],[-.25,-.25],[-.5,0],[-.25,.25]];
  const RECT = [[-.25,.5],[.25,.5],[.25,-.5],[-.25,-.5]];
  const DIAMOND = [[0,.5],[.5,0],[0,-.5],[-.5,0]];
  const ROWS = [[9,.479,.212,.018],[10,.444,.238,.020],[9,.409,.212,.020],
    [10,.375,.237,.022],[9,.339,.211,.023],[10,.305,.239,.024],[9,.271,.215,.027],
    [10,.236,.240,.027],[11,.196,.268,.030],[12,.144,.296,.031],[13,.085,.329,.034]];
  const WHISTLES = ROWS.flatMap(([count,y,span,d], row) => Array.from({length:count}, (_,i) =>
    ({x:-span + span*2*i/(count-1), y, d, row})));
  [[-.138,-.122,.079],[.145,-.122,.079],[.016,-.285,.136]].forEach(([x,y,d]) => WHISTLES.push({x,y,d,row:11}));
  const clamp = (n,a=0,b=1) => Math.max(a,Math.min(b,n));
  const smooth = n => { n=clamp(n); return n*n*(3-2*n); };
  const mix = (a,b,t) => a+(b-a)*t;
  const seed = i => { const n=Math.sin(i*127.1+311.7)*43758.5453; return n-Math.floor(n); };
  const NOTES = ['♪','♫','♬','♩'];

  // Exact point-to-point nine-star proportions from build_nine_linked_star.py.
  // Each component is the union of two equal squares, with a 45-degree turn.
  const starOutline=([x,y,side])=>Array.from({length:16},(_,i)=>{
    const angle=i*Math.PI/8,r=i%2?side/(2*Math.cos(Math.PI/8)):side/Math.SQRT2;
    return [x+Math.cos(angle)*r,y+Math.sin(angle)*r];
  });
  const squareFrame=([x,y,side],rotated)=>Array.from({length:4},(_,i)=>{
    const angle=(i*2+1)*Math.PI/4+(rotated?Math.PI/4:0),r=side/Math.SQRT2;
    return [x+Math.cos(angle)*r,y+Math.sin(angle)*r];
  });
  const STAR_COMPONENTS=[[0,0,1-1/Math.SQRT2],...Array.from({length:8},(_,i)=>
    [Math.cos(i*Math.PI/4)/(2*Math.SQRT2),Math.sin(i*Math.PI/4)/(2*Math.SQRT2),(Math.SQRT2-1)/2])];
  const STAR_WHISTLES=Array.from({length:8},(_,i)=>{
    const angle=(i+.5)*Math.PI/4;
    return {x:Math.cos(angle)*.2135285065,y:Math.sin(angle)*.2135285065,
      d:(i===5||i===6)?.09015611460128481:.05303300858899105,row:i+1};
  });
  const MODELS={
    hexagonal:{label:'六角板鹞',outlines:[OUTLINE],whistles:WHISTLES,heroIndex:114,sailSource:'./kite-sail.svg',
      frameLines:[RECT,DIAMOND,[[0,-.5],[0,.5]],...ROWS.map(([,y])=>{
        const span=Math.max(.25,.5-Math.abs(y));return [[-span,y-.006],[span,y-.006]];
      })],tailAnchors:[[-.225,-.5],[.225,-.5]]},
    nineStar:{label:'九连星板鹞',components:STAR_COMPONENTS,outlines:STAR_COMPONENTS.map(starOutline),
      whistles:STAR_WHISTLES,heroIndex:6,sailSource:'./kite-nine-sail.svg',
      frameLines:STAR_COMPONENTS.flatMap(c=>[squareFrame(c,false),squareFrame(c,true)]),
      tailAnchors:[[-.1035533906,-.4571067812],[.1035533906,-.4571067812]]}
  };

  function timeline(seconds,reduced=false) {
    const duration = reduced ? 4.6 : 10.4;
    return { duration, done:seconds>=duration,
      assemble: reduced ? smooth(seconds/.4) : clamp((seconds-.3)/3.2),
      returning: smooth((seconds-(reduced?4:8.6))/(reduced?.6:1.8)),
      reveal: smooth(seconds/(reduced?.25:.5)) };
  }

  function hull(points) {
    const sorted=points.filter(p=>p.every(Number.isFinite)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    if(sorted.length<3)return sorted;
    const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const lower=[],upper=[];
    for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
    for(const p of sorted.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
    return lower.slice(0,-1).concat(upper.slice(0,-1));
  }

  class BanyaoKiteAnimation {
    constructor({stage,bot,onFinish}) {
      this.stage=stage; this.bot=bot; this.onFinish=onFinish;
      this.canvas=document.createElement('canvas');
      this.canvas.className='kite-canvas';
      this.canvas.setAttribute('role','img');
      this.canvas.hidden=true;
      stage.appendChild(this.canvas);
      this.ctx=this.canvas.getContext('2d',{alpha:true});
      this.body=new Path2D(document.querySelector('#shape-body-path').getAttribute('d'));
      this.seam=new Path2D('M35 68Q114.5 74 195 68Q114.5 82 35 68Z');
      this.mouth=new Path2D('M66 22Q114.5 10.5 163 22Q114.5 22.8 66 22Z');
      // A small, hand-drawn vector simplification of the reference model's painted sail.
      this.sails=Object.fromEntries(Object.entries(MODELS).map(([kind,model])=>{
        const sail=typeof Image==='function'?new Image():null;
        if(sail)sail.src=model.sailSource;
        return [kind,sail];
      }));
      this.kind='hexagonal';this.model=MODELS.hexagonal;this.sail=this.sails.hexagonal;
      this.active=false; this.geometry=null; this.notes=[];
    }
    start(now=performance.now(),kind='hexagonal') {
      if(this.active||!this.ctx)return false;
      this.kind=Object.hasOwn(MODELS,kind)?kind:'hexagonal';
      this.model=MODELS[this.kind];this.sail=this.sails[this.kind];
      this.canvas.setAttribute('aria-label',`${this.model.whistles.length} 枚哨口汇成${this.model.label}，随风轻摆并飘出音符`);
      this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.startTime=now; this.notes=[]; this.nextNote=3.2; this.active=true;
      this.canvas.hidden=false; this.stage.classList.add('kite-active');
      this.render(now);
      return true;
    }
    finish() {
      if(!this.active)return;
      this.active=false; this.geometry=null; this.notes=[];
      this.canvas.hidden=true; this.stage.classList.remove('kite-active');
      this.bot.style.opacity='';
      this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
      this.onFinish?.();
    }
    render(now) {
      if(!this.active)return;
      const time=Math.max(0,(now-this.startTime)/1000), state=timeline(time,this.reduced);
      if(state.done){this.finish();return;}
      const w=this.stage.clientWidth,h=this.stage.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2.5);
      if(this.width!==w||this.height!==h||this.dpr!==dpr){
        this.width=w;this.height=h;this.dpr=dpr;
        this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
      }
      const ctx=this.ctx;
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      const style=getComputedStyle(document.documentElement);
      const modelSize=parseFloat(style.getPropertyValue('--pet-size'))||100;
      // Measure the configured SVG model, not its breathing transform or temporary window.
      const originalDiameter=modelSize*212/285;
      const extent=Math.min(originalDiameter*1.5,Math.max(1,w-64),Math.max(1,h-174));
      const cx=w/2,cy=h*.51;
      const botBox=this.bot.getBoundingClientRect(), stageBox=this.stage.getBoundingClientRect();
      const origin=[botBox.left-stageBox.left+botBox.width/2,botBox.top-stageBox.top+botBox.height/2];
      const flying=smooth((state.assemble-.65)/.35)*(1-state.returning);
      // Same low-frequency, ~3 degree breeze as the reference kite-model.js.
      const roll=this.reduced?0:Math.sin(time*.81)*.052*flying;
      const yaw=this.reduced?0:Math.sin(time*.47)*.035*flying;
      const pitch=this.reduced?0:Math.sin(time*.6)*.035*flying;
      const bob=this.reduced?0:Math.sin(time*.7)*.018*extent*flying;
      const project=(x,y)=>{
        // Orthographic projection keeps the wind motion, with an illustrated 2D silhouette.
        const xx=x*Math.cos(yaw),yy=y*Math.cos(pitch)+x*Math.sin(yaw)*Math.sin(pitch);
        return [cx+(xx*Math.cos(roll)-yy*Math.sin(roll))*extent,
          cy-(xx*Math.sin(roll)+yy*Math.cos(roll))*extent+bob];
      };
      const path=(points,begin=true)=>{if(begin)ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();};
      const outlines=this.model.outlines.map(points=>points.map(([x,y])=>project(x,y)));
      const cloth=smooth((state.assemble-.61)/.28)*(1-state.returning);
      const frame=smooth((state.assemble-.38)/.32)*(1-state.returning);
      const hit=[],polygons=[];
      const color=style.getPropertyValue('--pet-color').trim()||'#2f86ed';
      if(cloth>.001){
        ctx.save();ctx.globalAlpha=cloth;
        ctx.beginPath();for(const outline of outlines)path(outline,false);
        ctx.fillStyle='#f4dfaf';ctx.fill();
        ctx.clip();
        if(this.sail?.complete&&this.sail.naturalWidth){
          const tl=project(-.5,.5),tr=project(.5,.5),bl=project(-.5,-.5);
          ctx.transform(tr[0]-tl[0],tr[1]-tl[1],bl[0]-tl[0],bl[1]-tl[1],tl[0],tl[1]);
          ctx.drawImage(this.sail,0,0,1,1);
        }
        ctx.restore();
      }
      if(frame>.001){
        ctx.save();ctx.globalAlpha=frame;ctx.lineJoin='round';ctx.lineCap='round';
        const stroke=(points,width,ink)=>{path(points.map(([x,y])=>project(x,y)));ctx.lineWidth=width;ctx.strokeStyle=ink;ctx.stroke();};
        // Fine, single-colour ink strokes replace bevels and glossy bamboo shading.
        for(const outline of this.model.outlines)stroke(outline,Math.max(.6,extent*.004),'#8f4b38');
        ctx.globalAlpha=frame*.55;
        for(const line of this.model.frameLines)stroke(line,Math.max(.35,extent*.002),'#b89458');
        ctx.globalAlpha=frame;
        // A pair of short silk streamers follows the same breeze, without extending the window.
        for(const [anchorX,anchorY] of this.model.tailAnchors){
          const points=Array.from({length:13},(_,i)=>project(anchorX+Math.sin((this.reduced?0:time*1.6)-i*.43)*.019*(i/12),anchorY-i*.013));
          ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));
          ctx.strokeStyle=anchorX<0?color:'#d7a55c';ctx.lineWidth=Math.max(1.2,extent*.009);ctx.stroke();hit.push(...points);
          polygons.push(hull(points.flatMap(([x,y])=>[[x-1.5,y-1.5],[x+1.5,y+1.5]])));
        }
        ctx.restore();for(const outline of outlines){hit.push(...outline);polygons.push(outline);}
      }
      const whistles=this.model.whistles.map((whistle,i)=>{
        const r=seed(i+1),delay=.08+Math.min(whistle.row,11)*.019+r*.07;
        const arrival=this.reduced?state.assemble:smooth((state.assemble-delay)/.55);
        const target=project(whistle.x,whistle.y,whistle.d*.5+.0036);
        const spreadAngle=i*2.399963, spreadX=Math.cos(spreadAngle)*(w*.40),spreadY=Math.sin(spreadAngle)*(h*.32);
        const control=[clamp(cx+spreadX,18,w-18),clamp(cy+spreadY,25,h-32)];
        const t=arrival,q=1-t;
        let x=q*q*origin[0]+2*q*t*control[0]+t*t*target[0];
        let y=q*q*origin[1]+2*q*t*control[1]+t*t*target[1];
        const hero=i===this.model.heroIndex;
        if(hero){x=mix(origin[0],target[0],t);y=mix(origin[1],target[1],t);}
        x=mix(x,origin[0],state.returning);y=mix(y,origin[1],state.returning);
        let diameter=hero?mix(originalDiameter,whistle.d*extent,t):whistle.d*extent*(1+(1-t)*(1.8+r*2));
        diameter=hero?mix(diameter,originalDiameter,state.returning):diameter*(1-state.returning*.7);
        const opacity=hero?state.reveal*(1-smooth((state.returning-.72)/.28)):
          smooth((state.assemble-delay)/.09)*(1-smooth((state.returning-.38)/.60));
        return {x,y,diameter,opacity,hero,seed:r};
      });
      this.bot.style.opacity=String(Math.max(1-state.reveal,smooth((state.returning-.72)/.28)));
      // Paint the original little pet last, including the nine-star's lower-right hero.
      for(const item of whistles.sort((a,b)=>Number(a.hero)-Number(b.hero))){
        if(item.opacity<.008)continue;
        const {x,y,diameter,opacity,hero}=item;
        const bodyHit=[[x-diameter*.55,y-diameter*.55],[x+diameter*.55,y-diameter*.55],
          [x+diameter*.55,y+diameter*.55],[x-diameter*.55,y+diameter*.55]];
        hit.push(...bodyHit);polygons.push(bodyHit);
        ctx.save();ctx.globalAlpha=opacity;ctx.translate(x,y);ctx.rotate(-roll);
        ctx.scale(diameter/212,diameter/212);ctx.translate(-114.5,-115);
        ctx.fillStyle=color;ctx.fill(this.body);
        ctx.fillStyle='#2b1810';ctx.globalAlpha=opacity*.9;ctx.fill(this.seam);
        ctx.fillStyle='#24130d';ctx.globalAlpha=opacity;ctx.fill(this.mouth);
        if(hero){ctx.globalAlpha=opacity;ctx.fillStyle='#fff';for(const eyeX of [83,146]){ctx.beginPath();ctx.ellipse(eyeX,116,15,20,0,0,Math.PI*2);ctx.fill();}}
        ctx.restore();
      }
      if(!this.reduced&&time>this.nextNote&&state.returning<.01){
        this.nextNote=time+.38;
        if(this.notes.length<7){const id=Math.floor(time*8),r=seed(id+90),p=project((r-.5)*.46,.37+r*.09,.02);
          this.notes.push({born:time,x:p[0],y:p[1],drift:(r-.5)*45,size:15+r*8,glyph:NOTES[id%NOTES.length],life:1.45});}
      }
      this.notes=this.notes.filter(n=>time-n.born<n.life);
      const rects=[];
      for(const note of this.notes){
        const age=(time-note.born)/note.life, x=note.x+note.drift*age+Math.sin(age*6)*4,y=note.y-age*52;
        ctx.save();ctx.globalAlpha=Math.sin(age*Math.PI)*(1-state.returning);ctx.translate(x,y);ctx.rotate(Math.sin(age*5)*.15);
        ctx.font=`600 ${note.size}px "Segoe UI Symbol",sans-serif`;ctx.fillStyle=note.glyph==='♫'?'#d99e45':color;
        ctx.fillText(note.glyph,0,0);ctx.restore();
        rects.push([note.x-Math.abs(note.drift)-8,note.y-64,Math.abs(note.drift)*2+note.size+16,80]);
      }
      if(Number(this.bot.style.opacity)>.01){const originalHit=[[origin[0]-originalDiameter*.6,origin[1]-originalDiameter*.6],
        [origin[0]+originalDiameter*.6,origin[1]-originalDiameter*.6],[origin[0]+originalDiameter*.6,origin[1]+originalDiameter*.6],
        [origin[0]-originalDiameter*.6,origin[1]+originalDiameter*.6]];
        hit.push(...originalHit);polygons.push(originalHit);
      }
      this.geometry={polygon:hull(hit),polygons,rects};
      this.canvas.dataset.phase=state.returning>0?'returning':state.assemble<1?'assembling':'flying';
      this.canvas.dataset.kind=this.kind;
      this.canvas.dataset.whistles=String(this.model.whistles.length);
      this.canvas.dataset.extent=String(extent);
      this.canvas.dataset.color=color;
      this.canvas.dataset.sail=this.sail?.complete&&this.sail.naturalWidth?'painted':'loading';
    }
    hitRegion() { return this.active?this.geometry:null; }
  }
  // Pure geometry helpers also support regression checks without a browser or user data.
  BanyaoKiteAnimation.model={outline:OUTLINE,whistles:WHISTLES,timeline,hull};
  BanyaoKiteAnimation.models=MODELS;
  window.BanyaoKiteAnimation=BanyaoKiteAnimation;
})();
