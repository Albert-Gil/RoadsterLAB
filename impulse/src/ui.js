// Shared keyboard behavior; physics and playback state stay in app.js.
export function bindTuningLinks({trigger,panel,links=[],onVisit=()=>{}}){
 const controller=new AbortController();
 const visit=()=>{onVisit();panel.scrollTop=0;panel.scrollIntoView({behavior:'instant',block:'start'});panel.querySelector('#setup-title').focus({preventScroll:true});};
 const resize=()=>{
  if(innerWidth<860){panel.style.removeProperty('max-height');return;}
  const top=Math.max(16,panel.getBoundingClientRect().top);
  panel.style.maxHeight=Math.max(320,innerHeight-top-16)+'px';
 };
 for(const button of [trigger,...links])button.addEventListener('click',visit,{signal:controller.signal});
 window.addEventListener('resize',resize,{signal:controller.signal});
 window.addEventListener('scroll',resize,{signal:controller.signal,passive:true});
 requestAnimationFrame(()=>{if(panel.isConnected)resize();});
 return ()=>controller.abort();
}

export function bindChoiceKeys(buttons){
 const controller=new AbortController();
 buttons.forEach((button,index)=>button.addEventListener('keydown',e=>{
  let next;if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;
  else if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key))next=(index+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+buttons.length)%buttons.length;
  else return;
  e.preventDefault();buttons[next].focus({preventScroll:true});buttons[next].click();
 },{signal:controller.signal}));
 return ()=>controller.abort();
}

export function ownsKeyboardInput(target){
 return !!target?.closest('input,select,textarea,button,summary,a,[role="slider"],[contenteditable]:not([contenteditable="false"])');
}
