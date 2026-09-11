(function(){
  'use strict';
  const pages=Array.from(document.querySelectorAll('.page'));
  const bars=Array.from(document.querySelectorAll('.progress i'));
  const previous=document.querySelector('[data-action="previous"]');
  const next=document.querySelector('[data-action="next"]');
  const step=document.querySelector('#step');
  const params=new URLSearchParams(location.search);
  const color=params.get('color');
  if(/^#[0-9a-f]{6}$/i.test(color||''))document.querySelector('#guide').style.setProperty('--accent',color);
  if(params.get('first')!=='1')document.querySelector('#eyebrow').textContent='使用说明';
  let index=0,down=null,dragging=false;
  const post=message=>window.chrome?.webview?.postMessage(message);
  function render(){
    pages.forEach((page,i)=>page.classList.toggle('on',i===index));
    bars.forEach((bar,i)=>bar.classList.toggle('on',i<=index));
    previous.disabled=index===0;next.textContent=index===pages.length-1?'开始使用':'下一步';
    step.textContent=`${index+1} / ${pages.length}`;
  }
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='previous'){index=Math.max(0,index-1);render();}
    else if(action==='next'){if(index<pages.length-1){index++;render();}else post({type:'guide-close'});}
    else if(action==='close')post({type:'guide-close'});
  });
  const head=document.querySelector('#guide-head');
  head.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('button'))return;down=[event.clientX,event.clientY];dragging=false;head.setPointerCapture(event.pointerId);});
  head.addEventListener('pointermove',event=>{if(!down||dragging)return;if(Math.hypot(event.clientX-down[0],event.clientY-down[1])>5){dragging=true;post({type:'guide-drag'});}});
  head.addEventListener('pointerup',()=>{down=null;dragging=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')post({type:'guide-close'});else if(event.key==='ArrowLeft'&&index>0){index--;render();}else if(event.key==='ArrowRight'){if(index<pages.length-1){index++;render();}}});
  render();post({type:'guide-ready'});
})();
