// Shared keyboard behavior; physics and playback state stay in app.js.
export function bindTuningLinks({trigger,panel,links=[],initialOpen=false,onToggle=()=>{},onVisit=()=>{}}){
 const controller=new AbortController();
 let opener=trigger;
 const resize=()=>{
  if(panel.hidden||innerWidth<860){panel.style.removeProperty('max-height');return;}
  const bounds=panel.closest('.lab-layout').getBoundingClientRect();
  const top=Math.max(16,bounds.top),bottom=Math.min(innerHeight-16,bounds.bottom);
  panel.style.maxHeight=Math.max(240,bottom-top)+'px';
 };
 const setOpen=(open,focus=true)=>{
  panel.hidden=!open;
  trigger.setAttribute('aria-expanded',String(open));
  for(const link of links){link.setAttribute('aria-controls',panel.id);link.setAttribute('aria-expanded',String(open));}
  panel.closest('.lab-layout')?.classList.toggle('parameters-open',open);
  onToggle(open);
  resize();
  if(!focus)return;
  if(open){
   onVisit();panel.scrollTop=0;
   if(innerWidth<860)panel.scrollIntoView({behavior:'instant',block:'start'});
   panel.querySelector('#setup-title').focus({preventScroll:true});
  }else if(opener?.isConnected){opener.focus({preventScroll:true});if(innerWidth<860)opener.scrollIntoView({behavior:'instant',block:'nearest'});}
 };
 trigger.addEventListener('click',()=>{opener=trigger;setOpen(panel.hidden);},{signal:controller.signal});
 for(const button of links)button.addEventListener('click',()=>{opener=button;setOpen(true);},{signal:controller.signal});
 panel.querySelector('#parameters-close').addEventListener('click',()=>setOpen(false),{signal:controller.signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();setOpen(false);}},{signal:controller.signal});
 window.addEventListener('resize',resize,{signal:controller.signal});
 window.addEventListener('scroll',resize,{signal:controller.signal,passive:true});
 setOpen(initialOpen,false);
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
