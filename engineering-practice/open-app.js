import {OPEN_BANK} from './open-bank.js';
import {graphicHTML,legendHTML,dataHTML} from './charts.js';
import {OPEN_STORAGE_KEY,blankDraft,hasWork,checkNumbers,selectSet,freshOpenProgress,hydrateOpen,compatibleUnits,unitLabel,invalidateDraft,reviewPrompt,parseReview} from './open-engine.js';

const root=document.querySelector('#app'),byId=new Map(OPEN_BANK.map(q=>[q.id,q]));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(n)?Number(n.toPrecision(6)).toLocaleString('en-US',{maximumSignificantDigits:6,useGrouping:false}):'—';
const paragraphs=s=>s.split(/\n\s*\n/).map(x=>'<p>'+esc(x)+'</p>').join('');
let state=freshOpenProgress(),view='home',saveFailed=false,reviewText='',copyText='',notice='';
try{state=hydrateOpen(JSON.parse(localStorage.getItem(OPEN_STORAGE_KEY)||'null'),OPEN_BANK);}catch(error){saveFailed=!(error instanceof SyntaxError);}
function save(){try{localStorage.setItem(OPEN_STORAGE_KEY,JSON.stringify(state));saveFailed=false;}catch{saveFailed=true;}const e=document.querySelector('#save-state');if(e)e.textContent=saveFailed?'This browser could not save. Keep this tab open.':'Draft saved on this device';}
function current(){return byId.get(state.session?.ids[state.session.index]);}
function draft(q){return state.drafts[q.id]??=blankDraft(q);}
function header(){return '<header class="shell topbar"><a class="brand" href="./index.html" aria-label="Open-answer practice home"><span class="brand-mark" aria-hidden="true">F</span><span><span class="brand-name">FIRST PRINCIPLES</span><span class="brand-sub" style="display:block">Open-answer studio</span></span></a><nav class="top-actions" aria-label="Navigation"><button class="text-button" data-action="home">Overview</button><a class="text-button" href="./multiple-choice.html">Multiple choice</a></nav></header>';}
function footer(){return '<footer class="shell page-foot">Independent interview practice · Numerical checks run on your device · ChatGPT review is a separate chat</footer>';}
function banner(){return saveFailed?'<p class="storage-warning" role="status">This browser could not save your draft. Keep this tab open and export your answer before leaving.</p>':'';}
function status(q){const d=state.drafts[q.id];return d?.ai?'AI '+fmt(d.ai.score)+'/20':d?.submittedAt?'Submitted':d&&hasWork(d)?'Draft':'';}
function home(){
 const answers=Object.values(state.drafts),submitted=answers.filter(d=>d.submittedAt).length,reviewed=answers.filter(d=>d.ai).length,s=state.session;
 return '<main class="shell"><section class="hero"><p class="eyebrow">No choices. Build your own answer.</p><h1>Work the problem.<br>Defend the design.</h1><p class="hero-copy">150 open-answer fundamentals and 36 demanding design cases. Type your calculations, assumptions and reasoning. Check numbers here, then take the full response to ChatGPT for a rubric-based review.</p><div class="hero-line"><span class="pill">186 mixed problems</span><span class="pill">36 complete design cases</span><span class="pill">30 supplied diagrams</span></div></section><section class="feature-strip" aria-label="Progress"><div class="stat"><div class="stat-value">'+submitted+'</div><div class="stat-label">Responses submitted</div></div><div class="stat"><div class="stat-value">'+reviewed+'</div><div class="stat-label">ChatGPT reviews imported</div></div><div class="stat"><div class="stat-value">'+answers.filter(hasWork).length+'</div><div class="stat-label">Problems with saved work</div></div></section>'+(s?'<div class="resume-card"><div class="resume-copy"><strong>Your practice set is saved.</strong>Problem '+(s.index+1)+' of '+s.ids.length+' · '+esc(s.ids[s.index])+'</div><button class="primary" data-action="resume">Resume set</button></div>':'')+'<section class="practice-panel"><div class="panel-heading"><h2>Choose your challenge</h2></div><div class="open-sets"><button class="set-button" data-action="start" data-mode="fundamental" data-count="10"><strong>10</strong><span>Short open answers</span></button><button class="set-button featured" data-action="start" data-mode="mixed" data-count="10"><strong>10</strong><span>Mixed, including design</span></button><button class="set-button" data-action="start" data-mode="design" data-count="3"><strong>3</strong><span>Complete design cases</span></button><button class="set-button" data-action="start" data-mode="mixed" data-count="186"><strong>186</strong><span>The full bank</span></button></div><p class="practice-note">Topics stay mixed. Fundamentals take roughly 4–6 minutes; design cases usually need 20–40 minutes. Responses remain editable.</p><div class="review-row"><button class="secondary" data-action="saved" '+(!state.saved.length?'disabled':'')+'>Saved problems ('+state.saved.length+')</button><button class="secondary" data-action="drafts" '+(!answers.some(hasWork)?'disabled':'')+'>Revisit my work</button></div>'+banner()+'</section><section class="home-notes"><div><h3>Numbers checked here.</h3><p>Choose units for each quantity. Most numerical checks allow ±3% rounding tolerance; absolute temperatures use ±0.25 K. They check the stated target, not whether your entire design is correct.</p></div><div><h3>Reasoning reviewed in ChatGPT.</h3><p>Copy the prepared review prompt, open ChatGPT and paste it. No API key is needed. Bring back its JSON review to keep the five-part score and feedback here.</p></div></section><details class="catalogue"><summary>Browse or search all 186 problems</summary><label class="input-label" for="problem-search">Find an ID, concept or scenario</label><input id="problem-search" type="search" placeholder="e.g. methane, beam, D017" autocomplete="off"><div id="catalogue-results">'+catalogue('')+'</div></details></main>';
}
function catalogue(search){
 const query=search.trim().toLowerCase();
 const found=OPEN_BANK.filter(q=>(q.id+' '+q.title+' '+q.prompt).toLowerCase().includes(query));
 return '<p class="subtle catalogue-count">'+found.length+' problems</p>'+found.map(q=>'<button class="catalogue-item" data-action="open" data-id="'+q.id+'"><span><strong>'+q.id+' · '+(q.level==='design'?'Design case':'Open answer')+'</strong>'+esc(q.level==='design'?q.title:q.prompt.slice(0,125)+(q.prompt.length>125?'…':''))+'</span><span class="catalogue-status">'+esc(status(q))+'</span></button>').join('');
}
function numberInputs(q,d){return q.fields.length?'<section class="answer-section"><h2>Numerical results</h2><p class="subtle">Type a number and select its units. Decimal dot or comma, scientific notation and fractions are accepted. Do not use thousands separators.</p><div class="number-grid">'+q.fields.map(f=>'<div class="quantity"><label class="input-label" for="value-'+f.key+'">'+esc(f.label)+'</label><div class="quantity-row"><input id="value-'+f.key+'" type="text" inputmode="decimal" data-field="value" data-key="'+f.key+'" value="'+esc(d.values[f.key])+'" placeholder="Your result" maxlength="100" autocomplete="off"><select aria-label="Units for '+esc(f.label)+'" data-field="unit" data-key="'+f.key+'">'+compatibleUnits(f.unit).map(u=>'<option value="'+esc(u)+'" '+(d.units[f.key]===u?'selected':'')+'>'+esc(unitLabel(u))+'</option>').join('')+'</select></div></div>').join('')+'</div></section>':'';}
function checks(q,d){
 if(!d.submittedAt)return '';
 const results=checkNumbers(q,d),passed=results.filter(x=>x.status==='pass').length;
 return '<section class="check-panel" aria-labelledby="check-title"><h2 id="check-title">'+(results.length?'Numerical check: '+passed+' / '+results.length+' within tolerance':'Response submitted')+'</h2><p class="subtle">'+(results.length?'Only the numerical targets were checked automatically. Your assumptions, reasoning and design need review.':'No automatic reasoning score has been assigned. Use ChatGPT or compare with the worked solution.')+'</p>'+results.map(x=>'<div class="numeric-result '+(x.status==='pass'?'ok':'needs-work')+'"><strong>'+esc(x.label)+'</strong><span>'+({pass:'Within tolerance',miss:'Recheck this result',missing:'Not answered',invalid:'Use a valid number and compatible units'}[x.status])+'</span>'+(x.actual!==undefined?'<p>Your result: '+fmt(x.actual)+' '+esc(unitLabel(x.unit))+'</p>':'')+'<p>Reference: '+fmt(x.expected)+' '+esc(unitLabel(x.unit))+'</p></div>').join('')+'</section>';
}
function aiResult(q,d){
 if(!d.ai)return '';
 const a=d.ai;return '<section class="ai-result"><p class="eyebrow">Imported ChatGPT review</p><h2>'+fmt(a.score)+' / 20</h2><p>'+esc(a.summary)+'</p>'+a.criteria.map(c=>'<div class="rubric-result"><strong>'+c.index+'. '+esc(q.rubric[c.index-1])+' · '+fmt(c.score)+'/4</strong><p>'+esc(c.feedback)+'</p></div>').join('')+(a.corrections.length?'<h3>Corrections</h3><ul>'+a.corrections.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ul>':'')+'<h3>Follow-up</h3><p>'+esc(a.followUp)+'</p><p class="subtle">This score was imported from the ChatGPT response you pasted. Editing your answer clears it.</p></section>';
}
function question(){
 const q=current();if(!q){view='home';return home();}const d=draft(q),s=state.session;
 const graphic=q.graph?'<figure class="graphic"><div class="graphic-toolbar"><span>SUPPLIED DIAGRAM</span><button data-action="enlarge">Enlarge</button></div>'+graphicHTML(q,!!d.submittedAt)+legendHTML(q.graph)+dataHTML(q.graph)+'<figcaption class="graphic-caption">'+esc(q.graph.caption||'Use the supplied model and assumptions.')+'</figcaption></figure>':'';
 return '<main class="shell open-workspace"><div class="question-top"><div class="question-meta"><strong>Problem '+(s.index+1)+' of '+s.ids.length+'</strong><span>'+q.id+' · '+(q.level==='design'?'Design case · about 25 min':'Open answer · about '+q.minutes+' min')+'</span></div><progress value="'+(s.index+1)+'" max="'+s.ids.length+'" aria-label="Position in practice set"></progress></div><article class="question-card"><div class="question-heading"><p class="eyebrow">'+esc(q.title)+'</p><button class="save-button" data-action="bookmark" aria-pressed="'+state.saved.includes(q.id)+'">'+(state.saved.includes(q.id)?'Saved':'Save problem')+'</button></div><h1 class="prompt" id="question-heading" tabindex="-1">'+esc(q.prompt)+'</h1>'+graphic+'<ol class="deliverables">'+q.tasks.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol><details class="hint"><summary>Show a starting hint</summary><p>'+esc(q.hint)+'</p></details><details class="rubric-preview"><summary>What a strong answer should cover</summary><ol>'+q.rubric.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol></details>'+numberInputs(q,d)+'<section class="answer-section"><h2>Your engineering answer</h2><label class="input-label" for="assumptions">Boundary, assumptions and design constraints</label><textarea id="assumptions" data-field="assumptions" rows="3" maxlength="6000" placeholder="Define your boundary, knowns, unknowns and assumptions.">'+esc(d.assumptions)+'</textarea><label class="input-label" for="reasoning">Calculations, reasoning, design choice and validation</label><textarea id="reasoning" data-field="reasoning" rows="8" maxlength="16000" placeholder="Show the equations and units. Explain why the result makes physical sense. For a design case, describe components, controls, tradeoffs and how you would test the solution.">'+esc(d.reasoning)+'</textarea><div class="submit-row"><button class="primary" data-action="submit">'+(q.fields.length?'Submit & check numbers':'Submit my response')+'</button><button class="secondary" data-action="download">Export my response</button></div><p id="save-state" class="subtle" role="status">'+(saveFailed?'This browser could not save. Keep this tab open.':'Draft saved on this device')+'</p><p id="work-notice" class="work-notice" role="status">'+esc(notice)+'</p></section>'+checks(q,d)+'<section class="chatgpt-panel"><p class="eyebrow">Review the reasoning</p><h2>Take your answer to ChatGPT</h2><p>The prompt includes this problem, your current response, the reference calculations and five scoring criteria. ChatGPT grades it in a separate conversation.</p><div class="submit-row"><button class="primary" data-action="copy-review">1. Copy review prompt</button><a class="secondary button-link" href="https://chatgpt.com/" target="_blank" rel="noopener">2. Open ChatGPT</a></div><p class="subtle">Paste and send the prompt there. Then copy its JSON review back into the field below to save the feedback here. Copying alone does not send anything.</p>'+(copyText?'<details class="copy-fallback" open><summary>Review prompt / manual copy</summary><textarea id="copy-prompt" rows="5" readonly aria-label="Review prompt to copy">'+esc(copyText)+'</textarea><button class="secondary" data-action="select-prompt">Select prompt</button></details>':'')+'<details id="review-import"><summary>3. Paste ChatGPT’s JSON review</summary><label class="input-label" for="review-json">JSON review block</label><textarea id="review-json" rows="5" maxlength="40000" placeholder="Paste the complete JSON block from ChatGPT here.">'+esc(reviewText)+'</textarea><button class="secondary" data-action="import-review">Save AI review</button><p id="import-message" class="work-notice" role="status"></p></details></section>'+aiResult(q,d)+(d.submittedAt?'<section class="solution-section"><button class="secondary" data-action="solution" aria-expanded="'+d.revealed+'">'+(d.revealed?'Hide':'Show')+' worked solution</button>'+(d.revealed?'<div class="worked-solution"><h2>Reference calculation & reasoning</h2>'+paragraphs(q.solution)+'<p class="subtle">A justified alternative design may also be correct. These practice estimates do not replace vendor qualification or applicable engineering requirements.</p></div>':'')+'</section>':'')+'</article>'+banner()+'<nav class="question-actions" aria-label="Practice navigation"><button class="secondary" data-action="previous" '+(s.index===0?'disabled':'')+'>Previous</button><button class="text-button" data-action="home">Pause</button><button class="primary" data-action="next">'+(s.index===s.ids.length-1?'Finish set':'Next problem')+'</button></nav><p class="subtle nav-note">Navigation saves your draft. Worked solutions appear only after you submit.</p></main>';
}
function render(focus=false){root.innerHTML=header()+(view==='home'?home():question())+footer();if(focus){window.scrollTo({top:0,behavior:'instant'});document.querySelector('#question-heading')?.focus({preventScroll:true});}}
function start(count,mode){state.session=selectSet(OPEN_BANK,count,mode);copyText='';reviewText='';notice='';save();view='question';render(true);}
function openIds(ids){if(!ids.length)return;state.session={ids,index:0};save();view='question';copyText='';reviewText='';notice='';render(true);}
function changed(e){
 const el=e.target;
 if(el.id==='problem-search'){document.querySelector('#catalogue-results').innerHTML=catalogue(el.value);return;}
 if(el.id==='review-json'){reviewText=el.value;return;}
 if(!el.dataset.field)return;
 const q=current();if(!q)return;const d=invalidateDraft(draft(q)),key=el.dataset.key;
 if(el.dataset.field==='value')d.values[key]=el.value;
 else if(el.dataset.field==='unit')d.units[key]=el.value;
 else d[el.dataset.field]=el.value;
 state.drafts[q.id]=d;copyText='';reviewText='';notice='';save();
 // Keep the typing caret stable while clearing feedback that belongs to an older draft.
 for(const old of root.querySelectorAll('.check-panel,.ai-result,.solution-section,.copy-fallback'))old.remove();
 const imported=document.querySelector('#review-json');if(imported)imported.value='';
 const oldNotice=document.querySelector('#work-notice');if(oldNotice)oldNotice.textContent='';
}
document.addEventListener('input',changed);
document.addEventListener('change',e=>{if(e.target.matches('select[data-field]'))changed(e);});
document.addEventListener('click',async e=>{
 const b=e.target.closest?.('[data-action]');if(!b||b.disabled)return;
 const action=b.dataset.action,q=current();
 if(action==='home'){save();view='home';copyText='';reviewText='';notice='';render(true);return;}
 if(action==='start'){start(Number(b.dataset.count),b.dataset.mode);return;}
 if(action==='open'){openIds([b.dataset.id]);return;}
 if(action==='saved'){openIds(state.saved);return;}
 if(action==='drafts'){openIds(OPEN_BANK.filter(x=>state.drafts[x.id]&&hasWork(state.drafts[x.id])).map(x=>x.id));return;}
 if(action==='resume'){view='question';render(true);return;}
 if(!q)return;const d=draft(q);
 if(action==='submit'){
  if(!hasWork(d)){notice='Write a response or enter a numerical result first.';document.querySelector('#work-notice').textContent=notice;return;}
  d.submittedAt=Date.now();notice=q.fields.length?'Numerical targets checked. The engineering reasoning has not been AI graded.':'Response saved. Use ChatGPT for a reasoning review.';save();const y=window.scrollY;render();window.scrollTo(0,y);document.querySelector('.check-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'});
 }else if(action==='next'||action==='previous'){
  if(action==='next'&&state.session.index===state.session.ids.length-1){view='home';save();render(true);return;}
  state.session.index+=action==='next'?1:-1;copyText='';reviewText='';notice='';save();render(true);
 }else if(action==='bookmark'){
  state.saved=state.saved.includes(q.id)?state.saved.filter(x=>x!==q.id):[...state.saved,q.id];save();b.textContent=state.saved.includes(q.id)?'Saved':'Save problem';b.setAttribute('aria-pressed',String(state.saved.includes(q.id)));
 }else if(action==='solution'){d.revealed=!d.revealed;save();const y=window.scrollY;render();window.scrollTo(0,y);
 }else if(action==='copy-review'){
  if(!hasWork(d)){document.querySelector('#work-notice').textContent='Write your answer first so ChatGPT has something to review.';return;}
  const text=reviewPrompt(q,d);copyText=text;
  let copied=false;try{await navigator.clipboard.writeText(text);copied=true;}catch{/* Manual copy remains available below. */}
  // Ignore a late clipboard completion if the user moved to another problem or edited this draft.
  if(current()?.id!==q.id||reviewPrompt(q,draft(q))!==text)return;
  notice=copied?'Copied. Open ChatGPT, paste and send. Then bring back its JSON review.':'Automatic copy was unavailable. Select and copy the prompt below, then paste it into ChatGPT.';
  const y=window.scrollY;render();window.scrollTo(0,y);document.querySelector('#work-notice').textContent=notice;
 }else if(action==='select-prompt'){const t=document.querySelector('#copy-prompt');t.focus();t.select();t.setSelectionRange(0,t.value.length);
 }else if(action==='import-review'){
  const m=document.querySelector('#import-message');try{d.ai=parseReview(reviewText,q,d);d.submittedAt||=Date.now();save();reviewText='';const y=window.scrollY;render();window.scrollTo(0,y);document.querySelector('.ai-result')?.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(error){m.textContent=error.message;}
 }else if(action==='download'){
  const content=q.id+' · '+q.title+'\n\n'+q.prompt+'\n\nDELIVERABLES\n'+q.tasks.map((t,i)=>(i+1)+'. '+t).join('\n')+'\n\nMY NUMERICAL RESULTS\n'+q.fields.map(f=>f.label+': '+(d.values[f.key]||'[not answered]')+' '+unitLabel(d.units[f.key])).join('\n')+'\n\nMY ASSUMPTIONS\n'+d.assumptions+'\n\nMY REASONING\n'+d.reasoning+(d.ai?'\n\nIMPORTED AI REVIEW\n'+JSON.stringify(d.ai,null,2):'');
  const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Engineering_'+q.id+'_response.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }else if(action==='enlarge'){
  const dialog=document.querySelector('#diagram-modal');document.querySelector('#diagram-content').innerHTML=graphicHTML(q,!!d.submittedAt,'expanded')+legendHTML(q.graph)+dataHTML(q.graph);if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
 }else if(action==='close-diagram'){const dialog=document.querySelector('#diagram-modal');if(dialog.close)dialog.close();else dialog.removeAttribute('open');}
});
document.querySelector('#diagram-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
window.addEventListener('pagehide',save);
render();
