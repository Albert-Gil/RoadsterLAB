import {QUESTIONS} from "./questions.js";
import {STORAGE_KEY,freshProgress,makeSession,grade,nextQuestion,finishSession,recordAttempt,sessionStats,progressStats,hydrate} from "./engine.js";
import {graphicHTML,legendHTML,dataHTML} from "./charts.js";
const app=document.querySelector("#app");
const byId=new Map(QUESTIONS.map(q=>[q.id,q]));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let storageFailed=false,progress=freshProgress(),view="home";
try{progress=hydrate(JSON.parse(localStorage.getItem(STORAGE_KEY)||"null"),QUESTIONS);}catch(error){if(!(error instanceof SyntaxError))storageFailed=true;}
function save(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(progress));storageFailed=false;}catch{storageFailed=true;}
}
function header(){
  return '<header class="shell topbar"><button class="brand" data-action="home" aria-label="Practice overview"><span class="brand-mark" aria-hidden="true">F</span><span><span class="brand-name">FIRST PRINCIPLES</span><span class="brand-sub" style="display:block">Technical interview practice</span></span></button><nav class="top-actions" aria-label="Main navigation">'+(view!=="home"?'<button class="text-button" data-action="home">Overview</button>':'')+'<button class="text-button" data-action="info">About</button></nav></header>';
}
const warning=()=>storageFailed?'<p class="storage-warning" role="status">This browser is not saving progress. You can keep practicing in this tab, but a reload may lose this session.</p>':"";
function footer(){return '<footer class="shell page-foot">Independent practice · Engineering first principles · Progress stays in this browser</footer>';}
function home(){
  const stats=progressStats(progress,QUESTIONS),s=progress.session;
  const resume=s&&!s.done?'<div class="resume-card"><div class="resume-copy"><strong>Your mixed set is waiting.</strong>Question '+Math.min(s.index+1,s.order.length)+' of '+s.order.length+' · '+sessionStats(s).answered+' answered</div><button class="primary" data-action="resume">Resume set →</button></div>':"";
  return '<main class="shell"><section class="hero"><p class="eyebrow">For your next technical screen</p><h1>Think it through.<br>Then make your call.</h1><p class="hero-copy">150 mixed questions. Four choices. The calculation or reasoning appears after you answer — including why the alternatives miss the mark.</p><div class="hero-line"><span class="pill">30 graphs & schematics</span><span class="pill">Calculations + reasoning</span><span class="pill">Made for your phone</span></div></section><section class="feature-strip" aria-label="Your progress"><div class="stat"><div class="stat-value">'+stats.seen+'<span class="muted" style="font-size:16px"> / 150</span></div><div class="stat-label">Questions answered</div></div><div class="stat"><div class="stat-value">'+(stats.accuracy===null?"—":stats.accuracy+"%")+'</div><div class="stat-label">Answer accuracy</div></div><div class="stat"><div class="stat-value">'+stats.mistakes.length+'</div><div class="stat-label">To revisit</div></div></section>'+resume+'<section class="practice-panel" aria-labelledby="choose-title"><div class="panel-heading"><h2 id="choose-title">Pick a mixed set</h2><span class="subtle">New order every time</span></div><div class="sets"><button class="set-button" data-action="start" data-count="10"><strong>10</strong><span>A quick round</span></button><button class="set-button featured" data-action="start" data-count="20"><strong>20</strong><span>A focused set →</span></button><button class="set-button" data-action="start" data-count="150"><strong>150</strong><span>The full bank</span></button></div><p class="practice-note">Topics stay mixed: cooling, fluids, structures, cryogenics, thermal cycles and engineering decisions.</p><div class="review-row"><button class="secondary" data-action="review" '+(!stats.mistakes.length?"disabled":"")+'>Review mistakes <span class="review-count">'+stats.mistakes.length+'</span></button><button class="secondary" data-action="saved" '+(!progress.saved.length?"disabled":"")+'>Saved questions <span class="review-count">'+progress.saved.length+'</span></button></div>'+(s&&s.done?'<button class="text-button" style="margin-top:10px" data-action="results">View last set results →</button>':"")+warning()+'</section><section class="home-notes"><div><h3>Make the answer earn its place.</h3><p>Estimate first. Track units, assumptions and the physical boundary. Some choices are plausible only under a different operating constraint.</p></div><div><h3>Small sets, real feedback.</h3><p>Tap a choice, inspect the reasoning, and save anything worth revisiting. Your set and answers survive a reload on this browser.</p></div></section></main>';
}
function graphic(q,answered){
  if(!q.graph)return "";
  return '<figure class="graphic"><div class="graphic-toolbar"><span>SUPPLIED DIAGRAM</span><button data-action="enlarge" aria-label="Enlarge this diagram">Enlarge ↗</button></div>'+graphicHTML(q,answered)+legendHTML(q.graph)+dataHTML(q.graph)+'<figcaption class="graphic-caption">'+esc(q.graph.caption||"Use the stated model and assumptions. Diagrams are generated from the supplied data; component sketches are schematic.")+'</figcaption></figure>';
}
function feedback(q,a,ordered){
  const correct=q.options.find(o=>o.id===q.correct);
  const selected=q.options.find(o=>o.id===a.selected);
  const paragraphs=q.explanation.split(/\n\s*\n/).map(t=>'<p>'+esc(t)+'</p>').join("");
  return '<section id="feedback" class="feedback" tabindex="-1" aria-live="polite"><h3 class="feedback-title '+(!a.correct?"wrong":"")+'">'+(a.correct?"That’s the right call.":"Let’s work through it.")+'</h3>'+(!a.correct?'<div class="your-answer"><div class="reason-label">Why your choice misses</div>'+esc(selected.feedback)+'</div>':"")+'<div class="reason-label">Reasoning / calculation</div><div class="explanation">'+paragraphs+'</div>'+(q.trap?'<p class="trap"><strong>Watch for:</strong> '+esc(q.trap)+'</p>':"")+'<details class="alternatives"><summary>Why each option does or doesn’t fit</summary>'+ordered.map((o,i)=>'<div class="alternative"><strong>'+String.fromCharCode(65+i)+'. '+esc(o.text)+(o.id===correct.id?' · Correct answer':"")+'</strong>'+esc(o.feedback)+'</div>').join("")+'</details></section>';
}
function question(){
  const s=progress.session;if(!s||s.done){view=s?"results":"home";return s?results():home();}
  const q=byId.get(s.order[s.index]),a=s.answers[q.id],stats=sessionStats(s);
  const ordered=s.optionOrder[q.id].map(id=>q.options.find(o=>o.id===id));
  const saved=progress.saved.includes(q.id);
  return '<main class="shell"><div class="question-top"><div class="question-meta"><strong>Question '+(s.index+1)+' of '+s.order.length+'</strong><span>'+stats.correct+' / '+stats.answered+' correct</span></div><progress value="'+stats.answered+'" max="'+s.order.length+'" aria-label="'+stats.answered+' of '+s.order.length+' answered"></progress></div><article class="question-card"><div class="question-heading"><span class="question-id">Mixed practice · #'+String(q.id).padStart(3,"0")+'</span><button class="save-button" data-action="bookmark" aria-pressed="'+saved+'"><span class="star" aria-hidden="true">'+(saved?"★":"☆")+'</span>'+(saved?"Saved":"Save")+'</button></div><h1 class="prompt" id="question-prompt" tabindex="-1">'+esc(q.prompt)+'</h1>'+graphic(q,!!a)+(!a?'<details class="hint"><summary>Show a hint</summary><p>'+esc(q.hint)+'</p></details>':"")+'<div class="options" role="group" aria-labelledby="question-prompt">'+ordered.map((o,i)=>{
    let cls="option",badge="";
    if(a){
      if(o.id===q.correct){cls+=" correct";badge='<span class="option-badge">Correct answer</span>';}
      else if(o.id===a.selected){cls+=" incorrect";badge='<span class="option-badge">Your choice</span>';}
      else cls+=" dimmed";
    }
    return '<button class="'+cls+'" data-action="answer" data-option="'+esc(o.id)+'" '+(a?'disabled ':"")+'><span class="letter" aria-hidden="true">'+String.fromCharCode(65+i)+'</span><span>'+esc(o.text)+'</span>'+badge+'</button>';
  }).join("")+'</div>'+(a?feedback(q,a,ordered):"")+'</article>'+warning()+'<div class="question-actions"><button class="text-button" data-action="home">Pause & overview</button><button class="primary" data-action="next" '+(!a?"disabled":"")+'>'+(!a?"Select an answer":s.index===s.order.length-1?"See results →":"Next question →")+'</button></div><div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 20px"><button class="text-button" data-action="finish">Finish set here</button><span class="keyboard-note">Keys 1–4 to answer · Enter to continue</span></div></main>';
}
function results(){
  const s=progress.session;if(!s){view="home";return home();}
  const st=sessionStats(s),left=st.total-st.answered;
  const time=Math.max(0,Math.round(((s.finishedAt||Date.now())-s.startedAt)/60000));
  return '<main class="shell results"><p class="eyebrow">Set complete</p><h1>Keep the reasoning.<br>Revisit the misses.</h1><div class="score-card"><div class="score-value">'+st.correct+'<small> / '+st.answered+'</small></div><p>Correct among answered questions'+(left?' · '+left+' not answered':"")+' · '+time+' min elapsed</p></div><div class="result-actions"><button class="primary" data-action="review-session" '+(!st.missed.length?"disabled":"")+'>Review '+st.missed.length+' missed '+(st.missed.length===1?"question":"questions")+'</button><button class="secondary" data-action="start" data-count="20">Start a fresh mixed set</button></div>'+(st.missed.length?'<h2>Worth another look</h2><div class="missed-list">'+st.missed.map(id=>{const q=byId.get(id);return '<div class="missed-item"><strong>QUESTION '+String(id).padStart(3,"0")+'</strong>'+esc(q.prompt)+'</div>';}).join("")+'</div>':'<div class="empty-note">'+(st.answered?"Every answered question in this set was correct. Try a fresh mixed set, or work the underlying calculations without looking at the options.":"No answers were recorded in this set. Start a fresh mixed set whenever you are ready.")+'</div>')+'<button class="text-button" style="margin-top:22px" data-action="home">← Back to overview</button></main>';
}
function render(focus=false){
  app.innerHTML=header()+(view==="home"?home():view==="results"?results():question())+footer();
  if(focus){
    window.scrollTo({top:0,behavior:"instant"});
    requestAnimationFrame(()=>app.querySelector("h1")?.focus({preventScroll:true}));
  }
}
function start(count,ids=null){
  progress.session=makeSession(QUESTIONS,count,ids);
  save();view="question";render(true);
}
function activeQuestion(){return byId.get(progress.session?.order[progress.session.index]);}
function openDiagram(){
  const q=activeQuestion();if(!q?.graph)return;
  const a=progress.session.answers[q.id];
  document.querySelector("#diagram-content").innerHTML=graphicHTML(q,!!a,"expanded")+legendHTML(q.graph)+dataHTML(q.graph);
  const dialog=document.querySelector("#diagram-modal");
  if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
}
document.addEventListener("click",e=>{
  const b=e.target.closest?.("[data-action]");
  if(!b||b.disabled)return;
  const action=b.dataset.action;
  if(action==="home"){view="home";render(true);}
  else if(action==="start")start(Number(b.dataset.count));
  else if(action==="resume"){view="question";render(true);}
  else if(action==="results"){view="results";render(true);}
  else if(action==="review")start(150,progressStats(progress,QUESTIONS).mistakes);
  else if(action==="saved")start(150,progress.saved);
  else if(action==="review-session")start(150,sessionStats(progress.session).missed);
  else if(action==="answer"){
    const q=activeQuestion();if(!q)return;
    const result=grade(progress.session,q,b.dataset.option);
    if(!result.recorded)return;
    progress=recordAttempt(progress,q.id,result.session.answers[q.id].correct);
    progress.session=result.session;save();render();
    requestAnimationFrame(()=>{
      const f=document.querySelector("#feedback");f?.focus({preventScroll:true});
      f?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"nearest"});
    });
  }else if(action==="next"){
    if(!progress.session?.answers[activeQuestion()?.id])return;
    progress.session=nextQuestion(progress.session);save();
    view=progress.session.done?"results":"question";render(true);
  }else if(action==="bookmark"){
    const id=activeQuestion()?.id;if(!id)return;
    progress.saved=progress.saved.includes(id)?progress.saved.filter(x=>x!==id):[...progress.saved,id];
    save();
    b.setAttribute("aria-pressed",String(progress.saved.includes(id)));
    b.innerHTML='<span class="star" aria-hidden="true">'+(progress.saved.includes(id)?"★":"☆")+'</span>'+(progress.saved.includes(id)?"Saved":"Save");
  }else if(action==="finish"){
    progress.session=finishSession(progress.session);save();view="results";render(true);
  }else if(action==="enlarge")openDiagram();
  else if(action==="close-diagram")document.querySelector("#diagram-modal").close();
  else if(action==="info")document.querySelector("#info-modal").showModal();
  else if(action==="close-info")document.querySelector("#info-modal").close();
});
document.addEventListener("keydown",e=>{
  if(document.querySelector("dialog[open]")||view!=="question"||e.ctrlKey||e.metaKey||e.altKey)return;
  if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
  const q=activeQuestion();if(!q)return;
  if(/^[1-4]$/.test(e.key)&&!progress.session.answers[q.id]){
    const id=progress.session.optionOrder[q.id][Number(e.key)-1];
    app.querySelector('[data-option="'+id+'"]')?.click();e.preventDefault();
  }else if(e.key==="Enter"&&progress.session.answers[q.id]&&document.activeElement?.tagName!=="BUTTON"){
    app.querySelector('[data-action="next"]')?.click();e.preventDefault();
  }
});
for(const d of document.querySelectorAll("dialog")){
  d.addEventListener("click",e=>{if(e.target===d)d.close();});
}
window.addEventListener("pagehide",save);
render();
