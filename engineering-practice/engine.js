export const STORAGE_KEY = "first-principles-practice-v1";
export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function freshProgress() { return {version:1, history:{}, saved:[], session:null}; }
export function makeSession(bank, count=20, ids=null, random=Math.random, now=Date.now()) {
  const allowed = ids ? new Set(ids) : null;
  const pool = bank.filter(q => !allowed || allowed.has(q.id));
  const size = Math.min(count, pool.length);
  let chosen = [];
  // Guarantee visual and numerical practice in normal mixed sets when available.
  if (size >= 10) {
    for (const predicate of [q=>!!q.graph, q=>q.kind==="calculation", q=>q.kind==="reasoning", q=>q.domain==="structure", q=>q.domain==="cycle"]) {
      const candidates=pool.filter(q=>predicate(q)&&!chosen.some(x=>x.id===q.id));
      if(candidates.length) chosen.push(shuffle(candidates,random)[0]);
    }
  }
  const rest=shuffle(pool.filter(q=>!chosen.some(x=>x.id===q.id)),random);
  chosen=shuffle([...chosen,...rest.slice(0,Math.max(0,size-chosen.length))],random);
  const order=chosen.map(q=>q.id);
  const optionOrder=Object.fromEntries(chosen.map(q=>[q.id,shuffle(q.options.map(o=>o.id),random)]));
  return {order,optionOrder,index:0,answers:{},startedAt:now,finishedAt:null,done:order.length===0};
}
export function grade(session, question, selected, now=Date.now()) {
  if (session.done || session.order[session.index] !== question.id) throw new Error("Question is not active");
  if (session.answers[question.id]) return {session, recorded:false};
  if (!question.options.some(o=>o.id===selected)) throw new Error("Unknown answer option");
  const answer={selected,correct:selected===question.correct,answeredAt:now};
  return {session:{...session,answers:{...session.answers,[question.id]:answer}},recorded:true};
}
export function nextQuestion(session, now=Date.now()) {
  const id=session.order[session.index];
  if (!session.answers[id]) throw new Error("Answer this question before continuing");
  const index=session.index+1, done=index>=session.order.length;
  return {...session,index,done,finishedAt:done?now:null};
}
export function finishSession(session, now=Date.now()) {
  return {...session,done:true,finishedAt:now};
}
export function recordAttempt(progress, questionId, correct) {
  const old=progress.history[questionId]||{attempts:0,correctAttempts:0,lastCorrect:false};
  return {...progress,history:{...progress.history,[questionId]:{
    attempts:old.attempts+1,correctAttempts:old.correctAttempts+(correct?1:0),lastCorrect:correct
  }}};
}
export function sessionStats(session) {
  const answers=Object.entries(session.answers);
  return {
    answered:answers.length,
    correct:answers.filter(([,a])=>a.correct).length,
    total:session.order.length,
    missed:answers.filter(([,a])=>!a.correct).map(([id])=>Number(id))
  };
}
export function progressStats(progress, bank) {
  const valid=new Set(bank.map(q=>String(q.id)));
  const entries=Object.entries(progress.history).filter(([id])=>valid.has(id));
  const attempts=entries.reduce((s,[,v])=>s+v.attempts,0);
  const correct=entries.reduce((s,[,v])=>s+v.correctAttempts,0);
  return {
    seen:entries.length,attempts,correct,
    accuracy:attempts?Math.round(correct/attempts*100):null,
    mistakes:entries.filter(([,v])=>!v.lastCorrect).map(([id])=>Number(id))
  };
}
export function hydrate(raw, bank) {
  const clean=freshProgress(), byId=new Map(bank.map(q=>[q.id,q]));
  if(!raw||raw.version!==1) return clean;
  for(const [id,value] of Object.entries(raw.history||{})) {
    if(!byId.has(Number(id))||!value||!Number.isFinite(value.attempts)||value.attempts<1)continue;
    const attempts=Math.floor(value.attempts);
    const c=Number.isFinite(value.correctAttempts)?Math.max(0,Math.min(attempts,Math.floor(value.correctAttempts))):0;
    clean.history[id]={attempts,correctAttempts:c,lastCorrect:!!value.lastCorrect};
  }
  clean.saved=[...new Set(Array.isArray(raw.saved)?raw.saved:[])].filter(id=>byId.has(id));
  const s=raw.session;
  if(!s||!Array.isArray(s.order)||!s.order.length)return clean;
  const order=[...new Set(s.order)].filter(id=>byId.has(id));
  if(order.length!==s.order.length)return clean;
  const index=Number.isInteger(s.index)?Math.max(0,Math.min(order.length,s.index)):0;
  const optionOrder={},answers={};
  for(const id of order) {
    const q=byId.get(id), ids=q.options.map(o=>o.id), stored=s.optionOrder?.[id];
    optionOrder[id]=Array.isArray(stored)&&stored.length===ids.length&&new Set(stored).size===ids.length&&stored.every(x=>ids.includes(x))?[...stored]:shuffle(ids);
    const a=s.answers?.[id];
    if(a&&ids.includes(a.selected))answers[id]={selected:a.selected,correct:a.selected===q.correct,answeredAt:Number.isFinite(a.answeredAt)?a.answeredAt:0};
  }
  // Do not resume past an unanswered question in malformed local data.
  const missing=order.slice(0,index).findIndex(id=>!answers[id]);
  const safeIndex=missing>=0?missing:index;
  clean.session={order,optionOrder,answers,index:safeIndex,
    startedAt:Number.isFinite(s.startedAt)?s.startedAt:Date.now(),
    finishedAt:Number.isFinite(s.finishedAt)?s.finishedAt:null,
    done:!!s.done||safeIndex>=order.length};
  return clean;
}
