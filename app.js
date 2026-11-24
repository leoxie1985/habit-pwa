/* 每日打卡 PWA — 纯原生 JS + localStorage，离线可用 */
(function(){
"use strict";

const ICONS = ["💧","🏃","📚","🧘","💪","🥗","😴","✍️","🎯","🚭","☀️","🎧"];
const COLORS = ["#7c5cff","#22c5b4","#ff6b6b","#ffa940","#3b82f6","#ec4899","#10b981","#f43f5e"];
const KEY = "habit_pwa_data_v1";
const THEME_KEY = "habit_pwa_theme";
const MAX_LOG_DAYS = 400;

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pad = n => String(n).padStart(2,"0");
function ymd(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function todayStr(){ return ymd(new Date()); }
function addDays(dateStr, n){ const d=new Date(dateStr+"T00:00:00"); d.setDate(d.getDate()+n); return ymd(d); }
function uid(){ return "h"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

/* ---------- data ---------- */
let state = load();
function load(){
  try{ const raw = localStorage.getItem(KEY); if(raw) return JSON.parse(raw); }catch(e){}
  return seed();
}
function seed(){
  const t = todayStr();
  const h1 = {id:uid(),name:"喝水 8 杯",icon:"💧",color:"#3b82f6",goal:8,logs:{}};
  const h2 = {id:uid(),name:"运动 30 分钟",icon:"🏃",color:"#22c5b4",goal:1,logs:{}};
  const h3 = {id:uid(),name:"阅读 20 页",icon:"📚",color:"#ffa940",goal:1,logs:{}};
  // give a little history so stats look alive
  [h1,h2,h3].forEach((h,i)=>{
    for(let k=1;k<=15;k++){ const day=addDays(t,-k); if(Math.random()>0.3) h.logs[day]= i===0? Math.floor(4+Math.random()*5) : 1; }
    h.logs[t] = i===0?3:0; if(h.logs[t]===0) delete h.logs[t];
  });
  return {habits:[h1,h2,h3], created:t};
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }
function prune(){
  const min = addDays(todayStr(), -MAX_LOG_DAYS);
  state.habits.forEach(h=>{ Object.keys(h.logs).forEach(d=>{ if(d<min) delete h.logs[d]; }); });
}
function getHabit(id){ return state.habits.find(h=>h.id===id); }

/* ---------- streak (all habits or single) ---------- */
function streakFor(h){
  let s=0, d=todayStr();
  if(!h.logs[d]) d=addDays(d,-1); // today not done doesn't break the chain
  while(h.logs[d] && h.logs[d]>=h.goal){ s++; d=addDays(d,-1); }
  return s;
}
function count(h,day){ return Math.min(h.logs[day]||0, h.goal); }
function isDone(h){ return count(h,todayStr())>=h.goal; }

/* ---------- render: today ---------- */
function renderToday(){
  const t=todayStr(); const now=new Date();
  const wk=["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][now.getDay()];
  $("#today-weekday").textContent=wk;
  $("#today-date").textContent=(now.getMonth()+1)+"月"+now.getDate()+"日";

  const list=$("#today-list"); list.innerHTML="";
  const total=state.habits.length;
  const done=state.habits.filter(isDone).length;
  const pct= total? Math.round(done/total*100):0;
  const C=2*Math.PI*18;
  $("#ring-fg").style.strokeDashoffset=String(C*(1-pct/100));
  $("#ring-text").textContent=pct+"%";

  // hero
  const hero=$("#today-hero");
  if(total===0){ hero.innerHTML='<div class="hemoji">🌱</div><div class="htext"><div class="hbig">开始你的第一个习惯</div><div class="hsub">小步坚持，日拱一卒</div></div>'; hero.classList.remove("all-done"); }
  else if(done===total){ hero.innerHTML='<div class="hemoji">🎉</div><div class="htext"><div class="hbig">全部完成！</div><div class="hsub">今天 '+total+' 个习惯全部打卡，太棒了</div></div>'; hero.classList.add("all-done"); }
  else { hero.innerHTML='<div class="hemoji">'+(done>0?"🔥":"☀️")+'</div><div class="htext"><div class="hbig">今日 '+done+' / '+total+' 已完成</div><div class="hsub">加油，再坚持一下就完成啦</div></div>'; hero.classList.remove("all-done"); }

  $("#today-empty").hidden = total>0;

  state.habits.forEach(h=>{
    const doneFlag=isDone(h); const c=count(h,t); const st=streakFor(h);
    const li=document.createElement("li");
    li.className="habit"+(doneFlag?" done":"");
    li.style.setProperty("--c",h.color);
    let pips="";
    for(let i=0;i<h.goal;i++){ pips+='<span class="pip'+(i<c?" on":"")+'"></span>'; }
    li.innerHTML=
      '<div class="hicon" style="background:'+h.color+'">'+h.icon+'</div>'+
      '<div class="hmid"><div class="hname">'+escapeHtml(h.name)+'</div>'+
        '<div class="hmeta">'+(h.goal>1?('<span>'+c+'/'+h.goal+'</span><span class="hpips">'+pips+'</span>'):'<span>每日 1 次</span>')+
        (st>1?'<span class="streak-badge">🔥'+st+'天</span>':'')+'</div></div>'+
      '<div class="hcheck" role="button" aria-label="打卡">✓</div>';
    li.querySelector(".hcheck").addEventListener("click",()=>toggle(h.id));
    list.appendChild(li);
  });

  const quota=$("#today-quota");
  if(doneFlagAll()){ quota.hidden=false; } else { quota.hidden=true; }
}
function doneFlagAll(){ return false; }

/* ---------- render: stats ---------- */
function renderStats(){
  const t=todayStr();
  // longest streak across all habits
  let best=0; state.habits.forEach(h=>{ best=Math.max(best, longestEver(h)); });
  $("#stat-streak").textContent=best;

  // week (last 7 days) completion
  const days=[]; for(let k=6;k>=0;k--) days.push(addDays(t,-k));
  let doneWeek=0, possibleWeek=days.length*state.habits.length;
  state.habits.forEach(h=>days.forEach(d=>{ if((h.logs[d]||0)>=h.goal) doneWeek++; }));
  $("#stat-done").textContent=doneWeek;
  const rate=possibleWeek? Math.round(doneWeek/possibleWeek*100):0;
  $("#stat-rate").textContent=rate+"%";
  $("#stats-empty").hidden = state.habits.length>0;

  // heatmap: last 28 days, intensity = done habits / total
  const hm=$("#heatmap"); hm.innerHTML="";
  const total=state.habits.length||1;
  let cells=[]; for(let k=27;k>=0;k--){ const d=addDays(t,-k); let dc=0;
    state.habits.forEach(h=>{ if((h.logs[d]||0)>=h.goal) dc++; }); cells.push({d,dc,ratio:dc/total}); }
  cells.forEach(c=>{ const el=document.createElement("div"); el.className="hcell";
    el.title=c.d+" 完成"+c.dc;
    if(c.dc>0){ const a=0.2+0.8*c.ratio; el.style.background="color-mix(in srgb,var(--accent) "+Math.round(a*100)+"%, var(--line))"; }
    hm.appendChild(el);
  });

  // rank by this week completion per habit
  const rl=$("#rank-list"); rl.innerHTML="";
  const ranks=state.habits.map(h=>{ let dc=0; days.forEach(d=>{ if((h.logs[d]||0)>=h.goal) dc++; }); return {h,dc,pct:Math.round(dc/7*100)}; });
  ranks.sort((a,b)=>b.pct-a.pct);
  ranks.forEach(r=>{ const row=document.createElement("div"); row.className="rank-row";
    row.innerHTML='<span class="ri">'+r.h.icon+'</span><span class="rname">'+escapeHtml(r.h.name)+'</span>'+
      '<span class="rank-bar"><i style="width:'+r.pct+'%;background:'+r.h.color+'"></i></span>'+
      '<span class="rank-pct">'+r.pct+'%</span>';
    rl.appendChild(row);
  });
}
function longestEver(h){
  const keys=Object.keys(h.logs).filter(d=>h.logs[d]>=h.goal).sort();
  let best=0,cur=0,prev=null;
  keys.forEach(d=>{ if(prev && d===addDays(prev,1)) cur++; else cur=1; best=Math.max(best,cur); prev=d; });
  return best;
}

/* ---------- render: me ---------- */
function renderMe(){
  $("#profile-count").textContent=state.habits.length+" 个习惯";
}

/* ---------- actions ---------- */
function toggle(id){
  const h=getHabit(id); if(!h) return; const t=todayStr();
  if(count(h,t)>=h.goal){ // undo one
    if(h.logs[t]>1) h.logs[t]--; else delete h.logs[t];
    toast("已撤销");
  } else {
    h.logs[t]=(h.logs[t]||0)+1;
    if(h.logs[t]>=h.goal) toast("🎉 "+h.name+" 完成！");
  }
  save(); renderToday(); refreshActive();
}

/* ---------- modal: new/edit habit ---------- */
let editingId=null, pickIcon=ICONS[0], pickColor=COLORS[0];
function openModal(habit){
  editingId = habit? habit.id : null;
  pickIcon = habit? habit.icon : ICONS[0];
  pickColor= habit? habit.color : COLORS[0];
  $("#habit-modal-title").textContent = habit? "编辑习惯":"新建习惯";
  $("#habit-name").value = habit? habit.name:"";
  $("#habit-goal").value = habit? habit.goal:1;
  buildOpts();
  $("#habit-modal").classList.add("open");
  setTimeout(()=>$("#habit-name").focus(),300);
}
function closeModal(){ $("#habit-modal").classList.remove("open"); }
function buildOpts(){
  const io=$("#icon-opts"); io.innerHTML="";
  ICONS.forEach(ic=>{ const b=document.createElement("div"); b.className="opt"+(ic===pickIcon?" sel":""); b.textContent=ic;
    b.onclick=()=>{pickIcon=ic; buildOpts();}; io.appendChild(b); });
  const co=$("#color-opts"); co.innerHTML="";
  COLORS.forEach(c=>{ const b=document.createElement("div"); b.className="opt color"+(c===pickColor?" sel":""); b.style.setProperty("--c",c);
    b.onclick=()=>{pickColor=c; buildOpts();}; co.appendChild(b); });
}
function saveHabit(){
  const name=$("#habit-name").value.trim();
  if(!name){ toast("请输入名称"); return; }
  let goal=parseInt($("#habit-goal").value,10); if(isNaN(goal)||goal<1) goal=1; if(goal>50) goal=50;
  if(editingId){ const h=getHabit(editingId); h.name=name; h.goal=goal; h.icon=pickIcon; h.color=pickColor; }
  else { state.habits.push({id:uid(),name,icon:pickIcon,color:pickColor,goal,logs:{}}); }
  save(); prune(); save(); closeModal(); renderToday(); renderStats(); renderMe(); refreshActive();
  toast(editingId?"已更新":"已添加");
}
function deleteHabit(id){
  state.habits=state.habits.filter(h=>h.id!==id); save(); prune(); save();
  renderToday(); renderStats(); renderMe(); refreshActive();
}

/* edit list: reuse modal to edit existing */
function openEditList(){
  if(state.habits.length===0){ toast("还没有习惯"); return; }
  // simple picker via toast-free list: open first? -> use a prompt-less sheet: open edit for each by clicking.
  // Here we just open the modal for management using native select fallback.
  chooseHabitToDeleteOrEdit();
}
function chooseHabitToDeleteOrEdit(){
  // build a lightweight management modal reusing confirm box as list
  const box=$("#confirm"); $("#confirm-title").textContent="管理习惯";
  let html='<div style="display:flex;flex-direction:column;gap:8px;text-align:left;">';
  state.habits.forEach(h=>{ html+='<div class="mg-row" data-id="'+h.id+'"><span class="mg-i" style="background:'+h.color+'">'+h.icon+'</span>'+
    '<span class="mg-n">'+escapeHtml(h.name)+'</span>'+
    '<button class="mg-edit" data-act="edit">编辑</button><button class="mg-del" data-act="del">删除</button></div>'; });
  html+='</div>';
  $("#confirm-text").innerHTML=html;
  // repurpose buttons: hide actions, clicking backdrop closes
  box.querySelector(".confirm-actions").style.display="none";
  box.classList.add("open");
  const handler=e=>{
    const row=e.target.closest(".mg-row"); if(!row) return;
    const id=row.getAttribute("data-id"); const act=e.target.getAttribute("data-act");
    if(act==="edit"){ box.classList.remove("open"); restoreConfirm(); openModal(getHabit(id)); }
    else if(act==="del"){ box.classList.remove("open"); restoreConfirm();
      confirmDialog("删除习惯？","「"+getHabit(id).name+"」的历史记录将被移除，此操作不可恢复。",()=>deleteHabit(id)); }
  };
  $("#confirm-text").addEventListener("click",handler,{once:true});
  box.addEventListener("click",function once(ev){ if(ev.target===box){ box.classList.remove("open"); restoreConfirm(); box.removeEventListener("click",once); $("#confirm-text").removeEventListener("click",handler);} },{once:true});
}
function restoreConfirm(){ $(".confirm-actions").style.display=""; }

/* ---------- confirm dialog ---------- */
let confirmCb=null;
function confirmDialog(title,text,cb){
  $("#confirm-title").textContent=title; $("#confirm-text").textContent=text;
  confirmCb=cb; $("#confirm").classList.add("open");
}
$(".c-cancel").addEventListener("click",()=>{ $("#confirm").classList.remove("open"); confirmCb=null; });
$(".c-ok").addEventListener("click",()=>{ $("#confirm").classList.remove("open"); if(confirmCb){const c=confirmCb; confirmCb=null; c();} });

/* ---------- toast ---------- */
let toastTimer=null;
function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),1600); }

/* ---------- theme ---------- */
function applyTheme(mode){
  const root=document.documentElement;
  if(mode==="auto"){ const dark=window.matchMedia("(prefers-color-scheme: dark)").matches; root.setAttribute("data-theme", dark?"dark":"light"); }
  else root.setAttribute("data-theme", mode);
  $$("#theme-seg button").forEach(b=>b.classList.toggle("on", b.dataset.theme===mode));
  setMetaThemeColor();
}
function setMetaThemeColor(){ const dark=document.documentElement.getAttribute("data-theme")==="dark";
  $("meta[name=theme-color]").setAttribute("content", dark?"#0f1115":"#22c5b4"); }
function currentTheme(){ return localStorage.getItem(THEME_KEY)||"auto"; }

/* ---------- routing / tabs ---------- */
let activeView="today";
function showView(name){
  activeView=name;
  $$(".tab").forEach(t=>t.classList.toggle("active", t.dataset.view===name));
  $$(".view").forEach(v=>v.classList.toggle("active", v.id==="view-"+name));
  refreshActive();
}
function refreshActive(){
  if(activeView==="today") renderToday();
  else if(activeView==="stats") renderStats();
  else renderMe();
}

/* ---------- events ---------- */
$$(".tab").forEach(t=>t.addEventListener("click",()=>showView(t.dataset.view)));
$("#add-habit-btn").addEventListener("click",()=>openModal(null));
$("#habit-cancel").addEventListener("click",closeModal);
$("#habit-save").addEventListener("click",saveHabit);
$("#habit-modal").addEventListener("click",e=>{ if(e.target.id==="habit-modal") closeModal(); });
$("#edit-list-btn").addEventListener("click",openEditList);
$("#export-btn").addEventListener("click",exportData);
$("#reset-btn").addEventListener("click",()=>confirmDialog("重置所有数据？","所有习惯和打卡记录将被清空，无法恢复。",()=>{
  localStorage.removeItem(KEY); state=seed(); save(); showView("today"); renderToday(); renderStats(); renderMe(); toast("已重置");
}));
$("#theme-seg").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return;
  const m=b.dataset.theme; localStorage.setItem(THEME_KEY,m); applyTheme(m); });
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{ if(currentTheme()==="auto") applyTheme("auto"); });

function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="habit-data-"+todayStr()+".json"; document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},100);
  toast("已导出 JSON");
}

function escapeHtml(s){ return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

/* ---------- service worker ---------- */
if("serviceWorker" in navigator){ window.addEventListener("load",()=>{ navigator.serviceWorker.register("sw.js").catch(()=>{}); }); }

/* ---------- init ---------- */
applyTheme(currentTheme());
prune(); save();
renderToday(); renderStats(); renderMe(); showView("today");
})();
