/* ═══════════════════════════════════════════
   FITPULSE — app.js  (full rewrite)
   All data persisted to localStorage.
   Features: stats, nutrition, workouts, habits,
   GPS run tracker, weight tracker, personal records,
   water tracker, rest timer, journal, weekly summary.
═══════════════════════════════════════════ */
'use strict';

// ─── STORAGE ─────────────────────────────────────────────────────────────────
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function load(k, fb) { try { var v=localStorage.getItem(k); return v!==null?JSON.parse(v):fb; } catch(e){return fb;} }

function todayKey() {
  var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
}
function handleDayRollover() {
  if (load('last-date','') !== todayKey()) {
    save('stat-calories',0); save('stat-steps',0); save('stat-active',0);
    save('meals-today',[]); save('workout-done',[]);
    save('water-today',0);
    rolloverHabits();
    save('last-date', todayKey());
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  handleDayRollover();
  setGreeting();
  setupTabs();
  buildCalendarStrip();
  loadHomeStats();
  buildWeekChart();
  renderWater();
  loadWorkout();
  loadNutrition();
  loadHabits();
  loadRunHistory();
  loadWeightTracker();
  loadPRs();
  loadJournalHistory();
  loadWeeklySummary();
  loadJournalPreview();
  registerServiceWorker();
});

// ─── GREETING ────────────────────────────────────────────────────────────────
function setGreeting() {
  var h=new Date().getHours();
  var g=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  var el=document.getElementById('greeting');
  if(el) el.textContent=g+' \u2014 let\u2019s crush today \uD83D\uDCAA';
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('[data-tab]').forEach(function(btn) {
    btn.addEventListener('click', function(){ switchTab(btn.getAttribute('data-tab')); });
  });
}
function switchTab(name) {
  document.querySelectorAll('.section').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('[data-tab]').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-tab')===name); });
  var sec=document.getElementById('sec-'+name);
  if(sec) sec.classList.add('active');
  window.scrollTo(0,0);
}

// ─── HOME STATS ──────────────────────────────────────────────────────────────
function loadHomeStats() { renderStat('calories'); renderStat('steps'); renderStat('active'); renderStreak(); }

function renderStat(key) {
  var val=load('stat-'+key,0), goal=load('goal-'+key,defGoal(key));
  var el=document.getElementById('stat-'+key);
  var gl=document.getElementById('stat-'+key+'-goal');
  if(el) el.textContent=val.toLocaleString();
  if(gl) gl.textContent='of '+goal.toLocaleString()+goalUnit(key);
}
function defGoal(k){ return {calories:2000,steps:10000,active:60}[k]||0; }
function goalUnit(k){ return k==='active'?' min goal':' goal'; }
function renderStreak(){ var el=document.getElementById('stat-streak'); if(el) el.textContent=load('habit-overall-streak',0); }

// Stat modal
var activeStatKey=null;
var statCfg={
  calories:{title:'Calories',    valLabel:'Calories eaten today',  goalLabel:'Daily calorie goal'},
  steps:   {title:'Steps',       valLabel:'Steps taken today',     goalLabel:'Daily step goal'},
  active:  {title:'Active Min',  valLabel:'Active minutes today',  goalLabel:'Daily goal (minutes)'},
};
function openStatModal(key) {
  activeStatKey=key;
  var c=statCfg[key];
  setText('modal-stat-title','Update '+c.title);
  setText('modal-stat-label',c.valLabel);
  setText('modal-goal-label',c.goalLabel);
  document.getElementById('modal-stat-input').value=load('stat-'+key,0);
  document.getElementById('modal-goal-input').value=load('goal-'+key,defGoal(key));
  openModal('modal-stat');
}
function saveStatModal() {
  if(!activeStatKey) return;
  var val=parseInt(document.getElementById('modal-stat-input').value)||0;
  var goal=parseInt(document.getElementById('modal-goal-input').value)||defGoal(activeStatKey);
  save('stat-'+activeStatKey,val); save('goal-'+activeStatKey,goal);
  renderStat(activeStatKey);
  if(activeStatKey==='calories') updateCalorieRing();
  buildWeekChart(); updateWeeklyCalHistory();
  closeModal(); showToast('Updated \u2713');
}

// ─── WEEKLY SUMMARY ──────────────────────────────────────────────────────────
function loadWeeklySummary() {
  var runs=load('run-history',[]);
  var now=new Date(); var weekAgo=new Date(now); weekAgo.setDate(weekAgo.getDate()-7);
  var weekRuns=runs.filter(function(r){ return r.ts && new Date(r.ts)>=weekAgo; });
  setText('ws-runs', weekRuns.length);
  // Workout days this week
  var wDays=load('workout-days-week',[]);
  setText('ws-workouts', wDays.length);
  // Habit completion rate
  var hHistory=load('habit-week-completion',[]);
  var rate=hHistory.length>0?Math.round(hHistory.reduce(function(a,b){return a+b;},0)/hHistory.length)+'%':'0%';
  setText('ws-habits', rate);
  // Avg calories
  var calHistory=load('weekly-calories',[0,0,0,0,0,0,0]);
  var nonZero=calHistory.filter(function(c){return c>0;});
  var avg=nonZero.length>0?Math.round(nonZero.reduce(function(a,b){return a+b;},0)/nonZero.length):0;
  setText('ws-cal', avg.toLocaleString());
}

// ─── WEEK CHART ──────────────────────────────────────────────────────────────
function buildWeekChart() {
  var chart=document.getElementById('mini-chart'); if(!chart) return;
  chart.innerHTML='';
  var history=load('weekly-calories',[0,0,0,0,0,0,0]);
  history[new Date().getDay()]=load('stat-calories',0);
  var goal=load('goal-calories',2000);
  var days=['S','M','T','W','T','F','S'], today=new Date().getDay();
  history.forEach(function(v,i){
    var pct=goal>0?Math.min(v/goal,1):0;
    var bar=document.createElement('div');
    bar.className='bar'+(i===today?' active':'');
    bar.style.height=Math.max(4,Math.round(pct*48))+'px';
    bar.title=days[i]+': '+v+' cal';
    chart.appendChild(bar);
  });
}
function updateWeeklyCalHistory() {
  var h=load('weekly-calories',[0,0,0,0,0,0,0]);
  h[new Date().getDay()]=load('stat-calories',0);
  save('weekly-calories',h);
}

// ─── WATER TRACKER ───────────────────────────────────────────────────────────
var WATER_GOAL=8;
function renderWater() {
  var current=load('water-today',0);
  var gl=document.getElementById('water-glasses'); if(!gl) return;
  gl.innerHTML='';
  for(var i=0;i<WATER_GOAL;i++){
    var btn=document.createElement('button');
    btn.className='glass-btn'+(i<current?' filled':'');
    btn.textContent=i<current?'💧':'○';
    btn.setAttribute('data-idx',i);
    btn.addEventListener('click',(function(idx){
      return function(){ toggleGlass(idx); };
    })(i));
    gl.appendChild(btn);
  }
  var lbl=document.getElementById('water-label');
  if(lbl) lbl.textContent=current+' / '+WATER_GOAL+' glasses';
}
function toggleGlass(idx) {
  var current=load('water-today',0);
  // Click filled = set to idx, click empty = set to idx+1
  save('water-today', current>idx ? idx : idx+1);
  renderWater();
  showToast(load('water-today',0)===WATER_GOAL?'Great job! Goal reached \uD83D\uDCA7':'Water logged!');
}
function resetWater(){ save('water-today',0); renderWater(); }

// ─── WORKOUT ─────────────────────────────────────────────────────────────────
var DEFAULT_EXERCISES=[
  {id:'bench-press', name:'Bench Press',  meta:'4 sets · 8–10 reps · 135 lbs', icon:'🏋️'},
  {id:'pullups',     name:'Pull-ups',      meta:'3 sets · Max reps',             icon:'💪'},
  {id:'squats',      name:'Squats',        meta:'4 sets · 10 reps · 185 lbs',   icon:'🦵'},
  {id:'core',        name:'Core Circuit',  meta:'2 rounds · 8 exercises',        icon:'🔥'},
  {id:'ohp',         name:'Overhead Press',meta:'3 sets · 8 reps · 95 lbs',     icon:'🏆'},
];

function loadWorkout() {
  var exercises=load('custom-exercises', DEFAULT_EXERCISES);
  var done=load('workout-done',[]);
  var list=document.getElementById('workout-list'); if(!list) return;
  list.innerHTML='';
  exercises.forEach(function(ex){
    var isDone=done.indexOf(ex.id)!==-1;
    var li=document.createElement('li');
    li.className='workout-item';
    li.setAttribute('data-exercise',ex.id);
    li.innerHTML=
      '<div class="workout-icon wi-green">'+ex.icon+'</div>'+
      '<div class="workout-info">'+
        '<div class="workout-name">'+escHtml(ex.name)+'</div>'+
        '<div class="workout-meta">'+escHtml(ex.meta)+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:8px;align-items:center">'+
        '<button class="workout-check'+(isDone?' done':'\"')+'" onclick="toggleCheck(this)" aria-label="Mark complete">'+(isDone?'\u2713':'')+'</button>'+
        '<button class="ex-delete" onclick="deleteExercise(\''+ex.id+'\')" aria-label="Remove">\u00D7</button>'+
      '</div>';
    // Fix the class attribute bug above
    li.querySelector('.workout-check').className='workout-check'+(isDone?' done':'');
    list.appendChild(li);
  });
  updateWorkoutProgress();
}

function toggleCheck(btn) {
  btn.classList.toggle('done');
  btn.textContent=btn.classList.contains('done')?'\u2713':'';
  var done=[];
  document.querySelectorAll('#workout-list .workout-item').forEach(function(item){
    var chk=item.querySelector('.workout-check');
    if(chk&&chk.classList.contains('done')) done.push(item.getAttribute('data-exercise'));
  });
  save('workout-done',done);
  updateWorkoutProgress();
  // Track workout days
  if(done.length>0){
    var wdays=load('workout-days-week',[]);
    var td=todayKey();
    if(wdays.indexOf(td)===-1){ wdays.push(td); save('workout-days-week',wdays); }
  }
  showToast(btn.classList.contains('done')?'Exercise complete! \uD83D\uDCAA':'Unmarked');
}

function updateWorkoutProgress() {
  var done=document.querySelectorAll('#workout-list .workout-check.done').length;
  var total=load('custom-exercises',DEFAULT_EXERCISES).length;
  setText('workout-progress-text',done+' / '+total+' done');
  var fill=document.getElementById('workout-progress-fill');
  if(fill) fill.style.width=(total>0?Math.round((done/total)*100):0)+'%';
}

function saveExercise() {
  var name=document.getElementById('exercise-name-input').value.trim();
  var meta=document.getElementById('exercise-meta-input').value.trim();
  var icon=document.getElementById('exercise-icon-input').value;
  if(!name){ showToast('Enter a name'); return; }
  var exercises=load('custom-exercises',DEFAULT_EXERCISES);
  var id='ex-'+Date.now();
  exercises.push({id:id, name:name, meta:meta||'', icon:icon});
  save('custom-exercises',exercises);
  loadWorkout(); closeModal();
  showToast('Exercise added \uD83D\uDCAA');
}

function deleteExercise(id) {
  var exercises=load('custom-exercises',DEFAULT_EXERCISES);
  exercises=exercises.filter(function(e){ return e.id!==id; });
  save('custom-exercises',exercises);
  var done=load('workout-done',[]).filter(function(d){ return d!==id; });
  save('workout-done',done);
  loadWorkout();
}

// ─── PERSONAL RECORDS ────────────────────────────────────────────────────────
function savePR() {
  var lift=document.getElementById('pr-lift-input').value;
  var weight=parseFloat(document.getElementById('pr-weight-input').value)||0;
  var reps=parseInt(document.getElementById('pr-reps-input').value)||1;
  if(!weight){ showToast('Enter a weight'); return; }
  var prs=load('personal-records',[]);
  prs.push({lift:lift, weight:weight, reps:reps, date:todayKey(), ts:Date.now()});
  save('personal-records',prs);
  loadPRs(); closeModal();
  showToast('PR saved! \uD83C\uDFC6');
}

function loadPRs() {
  var prs=load('personal-records',[]);
  renderPRGrid('pr-grid', prs);
  renderPRGrid('pr-grid-more', prs);
}

function renderPRGrid(gridId, prs) {
  var grid=document.getElementById(gridId); if(!grid) return;
  if(prs.length===0){ grid.innerHTML='<div class="pr-empty">No PRs logged yet.</div>'; return; }
  // Show best per lift
  var best={};
  prs.forEach(function(pr){
    if(!best[pr.lift]||pr.weight>best[pr.lift].weight) best[pr.lift]=pr;
  });
  grid.innerHTML='';
  Object.keys(best).forEach(function(lift){
    var pr=best[lift];
    var card=document.createElement('div');
    card.className='pr-card';
    card.innerHTML=
      '<div class="pr-lift">'+escHtml(lift)+'</div>'+
      '<div class="pr-weight">'+pr.weight+' <span class="pr-unit">lbs</span></div>'+
      '<div class="pr-reps">'+pr.reps+' rep'+(pr.reps>1?'s':'')+'</div>'+
      '<div class="pr-date">'+pr.date+'</div>';
    grid.appendChild(card);
  });
}

// ─── NUTRITION ───────────────────────────────────────────────────────────────
function loadNutrition() { renderFoodLog(); updateCalorieRing(); }

function renderFoodLog() {
  var meals=load('meals-today',[]);
  var list=document.getElementById('food-log');
  var empty=document.getElementById('food-log-empty');
  if(!list) return;
  list.innerHTML='';
  if(meals.length===0){ if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  meals.forEach(function(meal,idx){
    var li=document.createElement('li'); li.className='food-item';
    li.innerHTML=
      '<div><div class="food-name">'+escHtml(meal.name)+'</div>'+
      '<div class="food-time">'+escHtml(meal.type)+' \u00B7 '+meal.time+'</div></div>'+
      '<div style="display:flex;align-items:center;gap:10px">'+
        '<div class="food-cal">'+meal.cal+' cal</div>'+
        '<button class="meal-delete" onclick="deleteMeal('+idx+')">\u00D7</button>'+
      '</div>';
    list.appendChild(li);
  });
}

function updateCalorieRing() {
  var meals=load('meals-today',[]);
  var total=meals.reduce(function(s,m){return s+(m.cal||0);},0);
  var goal=load('goal-calories',2000);
  var pct=goal>0?Math.min(total/goal,1):0;
  var arc=document.getElementById('calorie-ring-arc');
  if(arc) arc.setAttribute('stroke-dashoffset',408-Math.round(pct*408));
  setText('ring-cal-val',total.toLocaleString());
  setText('ring-cal-remaining',Math.max(0,goal-total).toLocaleString()+' remaining');
  setText('macro-protein',Math.round(total*0.30/4)+'g');
  setText('macro-carbs',Math.round(total*0.40/4)+'g');
  setText('macro-fat',Math.round(total*0.30/9)+'g');
  save('stat-calories',total); renderStat('calories'); buildWeekChart(); updateWeeklyCalHistory();
}

function openMealModal() {
  document.getElementById('meal-name-input').value='';
  document.getElementById('meal-cal-input').value='';
  openModal('modal-meal');
  setTimeout(function(){ document.getElementById('meal-name-input').focus(); },120);
}

function saveMeal() {
  var name=document.getElementById('meal-name-input').value.trim();
  var cal=parseInt(document.getElementById('meal-cal-input').value)||0;
  var type=document.getElementById('meal-type-input').value;
  if(!name){ showToast('Enter a meal name'); return; }
  var now=new Date();
  var h=now.getHours()%12||12, m=now.getMinutes();
  var timeStr=h+':'+(m<10?'0':'')+m+' '+(now.getHours()<12?'AM':'PM');
  var meals=load('meals-today',[]);
  meals.push({name:name, cal:cal, type:type, time:timeStr});
  save('meals-today',meals);
  renderFoodLog(); updateCalorieRing(); closeModal();
  showToast('Meal logged! \uD83C\uDF7D\uFE0F');
}

function deleteMeal(idx) {
  var meals=load('meals-today',[]); meals.splice(idx,1); save('meals-today',meals);
  renderFoodLog(); updateCalorieRing(); showToast('Removed');
}

// ─── HABITS ──────────────────────────────────────────────────────────────────
var DEFAULT_HABITS=[
  {id:'water',     name:'Drink 3L Water',   icon:'💧'},
  {id:'sleep',     name:'Sleep 8hrs',        icon:'😴'},
  {id:'meditate',  name:'Meditate',          icon:'🧘'},
  {id:'noscreens', name:'No Screens 1hr',    icon:'📵'},
  {id:'read',      name:'Read 20min',        icon:'📖'},
  {id:'veggies',   name:'Eat Veggies',       icon:'🥦'},
];

function loadHabits() {
  var habits=load('habit-list',DEFAULT_HABITS);
  var todayDone=load('habits-today',{});
  var streaks=load('habit-streaks',{});
  var grid=document.getElementById('habit-grid'); if(!grid) return;
  grid.innerHTML='';
  habits.forEach(function(h, hIdx){
    var isDone=todayDone[h.id]===true;
    var streak=streaks[h.id]||0;
    var card=document.createElement('div');
    card.className='habit-card';
    card.setAttribute('data-habit',h.id);
    card.innerHTML=
      '<button class="habit-toggle'+(isDone?' active':'\"')+' onclick="toggleHabit(this)" aria-pressed="'+(isDone?'true':'false')+'">'+(isDone?'\u2713':'')+'</button>'+
      '<div class="habit-name">'+h.icon+' '+escHtml(h.name)+'</div>'+
      '<div class="habit-streak" id="streak-'+h.id+'" style="color:var(--accent)">'+streak+'</div>'+
      '<div class="habit-streak-label">day streak</div>'+
      '<div class="habit-dots" id="hd-'+h.id+'"></div>'+
      '<button class="habit-delete" onclick="deleteHabit(\''+h.id+'\')">\u00D7</button>';
    // Fix class
    card.querySelector('.habit-toggle').className='habit-toggle'+(isDone?' active':'');
    grid.appendChild(card);
    buildHabitDots(h.id);
  });
}

function toggleHabit(btn) {
  var card=btn.closest('[data-habit]');
  var key=card?card.getAttribute('data-habit'):null; if(!key) return;
  btn.classList.toggle('active');
  var isDone=btn.classList.contains('active');
  btn.textContent=isDone?'\u2713':'';
  btn.setAttribute('aria-pressed',isDone?'true':'false');
  var todayDone=load('habits-today',{});
  todayDone[key]=isDone; save('habits-today',todayDone);
  var streaks=load('habit-streaks',{});
  streaks[key]=isDone?((streaks[key]||0)+1):Math.max(0,(streaks[key]||1)-1);
  save('habit-streaks',streaks);
  var el=document.getElementById('streak-'+key);
  if(el) el.textContent=streaks[key];
  updateOverallStreak();
  trackHabitCompletion();
  showToast(isDone?'Habit done! \uD83C\uDFAF':'Unmarked');
}

function trackHabitCompletion() {
  var habits=load('habit-list',DEFAULT_HABITS);
  var todayDone=load('habits-today',{});
  var done=habits.filter(function(h){return todayDone[h.id];}).length;
  var rate=habits.length>0?Math.round((done/habits.length)*100):0;
  var history=load('habit-week-completion',[]);
  history[new Date().getDay()]=rate;
  save('habit-week-completion',history);
}

function updateOverallStreak() {
  var habits=load('habit-list',DEFAULT_HABITS);
  var todayDone=load('habits-today',{});
  var allDone=habits.length>0&&habits.every(function(h){return todayDone[h.id]===true;});
  if(allDone){
    var s=load('habit-overall-streak',0)+1;
    save('habit-overall-streak',s);
  }
  renderStreak();
}

function rolloverHabits() { save('habits-today',{}); }

function buildHabitDots(key) {
  var el=document.getElementById('hd-'+key); if(!el) return;
  el.innerHTML='';
  var history=load('habit-history-'+key,[]);
  for(var i=0;i<7;i++){
    var dot=document.createElement('div');
    dot.className='habit-dot'+(i===6?' today':history[i]?' done':'');
    el.appendChild(dot);
  }
}

function saveHabit() {
  var name=document.getElementById('habit-name-input').value.trim();
  var icon=document.getElementById('habit-icon-input').value;
  if(!name){ showToast('Enter a habit name'); return; }
  var habits=load('habit-list',DEFAULT_HABITS);
  habits.push({id:'habit-'+Date.now(), name:name, icon:icon});
  save('habit-list',habits);
  loadHabits(); closeModal();
  showToast('Habit added \uD83C\uDFAF');
}

function deleteHabit(id) {
  var habits=load('habit-list',DEFAULT_HABITS);
  habits=habits.filter(function(h){return h.id!==id;});
  save('habit-list',habits);
  loadHabits();
}

// ─── RUN TRACKER (GPS) ───────────────────────────────────────────────────────
var gpsWatchId=null, gpsDistMiles=0, gpsLastPos=null;
var runInterval=null, runSeconds=0, isRunning=false;

function loadRunHistory() {
  var runs=load('run-history',[]);
  var list=document.getElementById('run-history');
  var empty=document.getElementById('run-empty');
  if(!list) return;
  list.querySelectorAll('.workout-item').forEach(function(i){i.remove();});
  if(runs.length===0){ if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  runs.slice().reverse().slice(0,5).forEach(function(run){
    var li=document.createElement('li'); li.className='workout-item';
    li.innerHTML=
      '<div class="workout-icon wi-green">\uD83C\uDFC3</div>'+
      '<div class="workout-info">'+
        '<div class="workout-name">'+escHtml(run.label)+'</div>'+
        '<div class="workout-meta">'+run.dist+' mi \u00B7 '+run.time+' \u00B7 '+run.pace+'/mi'+(run.gps?' \uD83D\uDCCD':'')+' \u00B7 '+run.cal+' cal</div>'+
      '</div>'+
      '<div class="run-day-label">'+run.day+'</div>';
    list.insertBefore(li,list.firstChild);
  });
}

function toggleRun() { if(!isRunning) startRun(); else stopRun(); }

function startRun() {
  isRunning=true; runSeconds=0; gpsDistMiles=0; gpsLastPos=null;
  var btn=document.getElementById('run-btn');
  var sub=document.getElementById('run-sub');
  if(btn){btn.textContent='\u23F8 Stop Run';btn.classList.add('running');}
  if('geolocation' in navigator){
    if(sub) sub.textContent='Acquiring GPS signal...';
    gpsWatchId=navigator.geolocation.watchPosition(onGpsPos,onGpsErr,{enableHighAccuracy:true,maximumAge:2000,timeout:10000});
  } else {
    if(sub) sub.textContent='Running... (no GPS)';
  }
  runInterval=setInterval(tickRun,1000);
}

function onGpsPos(pos) {
  var lat=pos.coords.latitude, lng=pos.coords.longitude, acc=pos.coords.accuracy;
  if(acc>50) return;
  var sub=document.getElementById('run-sub');
  if(!gpsLastPos){ if(sub) sub.textContent='GPS locked \uD83D\uDCCD Running...'; }
  else {
    var d=haversine(gpsLastPos.lat,gpsLastPos.lng,lat,lng);
    if(d>0.00186) gpsDistMiles+=d;
  }
  gpsLastPos={lat:lat,lng:lng};
  updateRunDisplay();
}
function onGpsErr(err) {
  var sub=document.getElementById('run-sub');
  if(sub) sub.textContent=err.code===1?'Location denied \u2014 using timer':'GPS unavailable \u2014 using timer';
}
function haversine(lat1,lng1,lat2,lng2) {
  var R=3958.8, dL=(lat2-lat1)*Math.PI/180, dG=(lng2-lng1)*Math.PI/180;
  var a=Math.sin(dL/2)*Math.sin(dL/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dG/2)*Math.sin(dG/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function stopRun() {
  isRunning=false; clearInterval(runInterval); runInterval=null;
  if(gpsWatchId!==null){navigator.geolocation.clearWatch(gpsWatchId);gpsWatchId=null;}
  var usingGPS=gpsDistMiles>0;
  var distNum=usingGPS?gpsDistMiles:runSeconds/400;
  var dist=distNum.toFixed(2);
  var timeStr=formatTime(runSeconds);
  var paceStr=runSeconds>0&&distNum>0?formatTime(Math.round(runSeconds/distNum)):'0:00';
  var cal=usingGPS?Math.round(distNum*60):Math.round(runSeconds*0.12);
  var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var h=new Date().getHours();
  var run={dist:dist,time:timeStr,pace:paceStr,cal:cal,day:days[new Date().getDay()],
           label:h<12?'Morning Run':h<17?'Afternoon Run':'Evening Run',gps:usingGPS,ts:Date.now()};
  var runs=load('run-history',[]); runs.push(run); save('run-history',runs);
  loadRunHistory(); loadWeeklySummary();
  var btn=document.getElementById('run-btn'),sub=document.getElementById('run-sub');
  if(btn){btn.textContent='\u25B6 Start Run';btn.classList.remove('running');}
  if(sub) sub.textContent='Done! '+dist+' mi in '+timeStr+(usingGPS?' \uD83D\uDCCD':'')+' \uD83C\uDF89';
  ['run-dist','run-time','run-pace','run-cal'].forEach(function(id){
    var el=document.getElementById(id);
    if(!el) return;
    el.innerHTML=id==='run-dist'?'0.00 <span class="run-dist-unit">mi</span>':'0:00';
  });
  document.getElementById('run-cal').textContent='0';
  gpsDistMiles=0; gpsLastPos=null;
  showToast('Run saved! \uD83C\uDFC3');
}

function tickRun(){ runSeconds++; updateRunDisplay(); }
function updateRunDisplay() {
  var usingGPS=gpsDistMiles>0;
  var distNum=usingGPS?gpsDistMiles:runSeconds/400;
  var cal=usingGPS?Math.round(distNum*60):Math.round(runSeconds*0.12);
  var distEl=document.getElementById('run-dist');
  if(distEl) distEl.innerHTML=distNum.toFixed(2)+' <span class="run-dist-unit">mi</span>';
  setText('run-time',formatTime(runSeconds));
  setText('run-cal',cal);
  var paceEl=document.getElementById('run-pace');
  if(paceEl&&distNum>0&&runSeconds>0) paceEl.textContent=formatTime(Math.round(runSeconds/distNum));
}
function formatTime(s){ var m=Math.floor(s/60),sec=s%60; return m+':'+(sec<10?'0':'')+sec; }

// ─── WEIGHT TRACKER ──────────────────────────────────────────────────────────
function saveWeight() {
  var w=parseFloat(document.getElementById('weight-input').value)||0;
  var g=parseFloat(document.getElementById('weight-goal-input').value)||0;
  if(!w){ showToast('Enter a weight'); return; }
  var entries=load('weight-log',[]);
  entries.push({weight:w, date:todayKey(), ts:Date.now()});
  save('weight-log',entries);
  if(g>0) save('weight-goal',g);
  loadWeightTracker(); closeModal();
  showToast('Weight logged \u2713');
}

function loadWeightTracker() {
  var entries=load('weight-log',[]);
  var goal=load('weight-goal',0);
  if(entries.length===0){
    setText('weight-current','—'); setText('weight-start','—');
    setText('weight-goal-display',goal?goal+' lbs':'—');
    setText('weight-change','—');
    var wc=document.getElementById('weight-chart'); if(wc) wc.innerHTML='<div class="pr-empty" style="text-align:center;padding:20px">No entries yet</div>';
    return;
  }
  var current=entries[entries.length-1].weight;
  var start=entries[0].weight;
  var change=Math.round((current-start)*10)/10;
  var changeStr=(change>0?'+':'')+change+' lbs';
  setText('weight-current',current+' lbs');
  setText('weight-start',start+' lbs');
  setText('weight-goal-display',goal?goal+' lbs':'—');
  var changeEl=document.getElementById('weight-change');
  if(changeEl){
    changeEl.textContent=changeStr;
    changeEl.style.color=change<0?'var(--accent)':change>0?'var(--accent3)':'var(--text2)';
  }
  // Build simple bar chart for weight over time
  renderWeightChart(entries);
  // Pre-fill modal with current values
  document.getElementById('weight-input').value=current;
  if(goal) document.getElementById('weight-goal-input').value=goal;
}

function renderWeightChart(entries) {
  var chart=document.getElementById('weight-chart'); if(!chart) return;
  chart.innerHTML='';
  var recent=entries.slice(-14);
  var weights=recent.map(function(e){return e.weight;});
  var mn=Math.min.apply(null,weights), mx=Math.max.apply(null,weights);
  var range=mx-mn||1;
  var wrap=document.createElement('div'); wrap.className='weight-bars';
  recent.forEach(function(e,i){
    var pct=(e.weight-mn)/range;
    var col=document.createElement('div'); col.className='weight-bar-wrap';
    var bar=document.createElement('div'); bar.className='weight-bar';
    // Invert: higher weight = shorter bar from top (lower is better if losing)
    bar.style.height=Math.max(8,Math.round(pct*60))+'px';
    bar.title=e.date+': '+e.weight+' lbs';
    col.appendChild(bar);
    wrap.appendChild(col);
  });
  chart.appendChild(wrap);
}

// ─── REST TIMER ──────────────────────────────────────────────────────────────
var timerInterval=null, timerRemaining=90, timerTotal=90, timerRunning=false;

function setTimer(seconds) {
  stopTimer();
  timerRemaining=seconds; timerTotal=seconds;
  updateTimerDisplay();
  document.querySelectorAll('.timer-preset').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.timer-preset').forEach(function(b){
    if(parseInt(b.textContent)===seconds||(b.textContent==='1m'&&seconds===60)||
       (b.textContent==='1:30'&&seconds===90)||(b.textContent==='2m'&&seconds===120)||
       (b.textContent==='3m'&&seconds===180)||(b.textContent==='30s'&&seconds===30))
      b.classList.add('active');
  });
}

function toggleTimer() {
  if(timerRunning){ stopTimer(); }
  else { startTimer(); }
}

function startTimer() {
  timerRunning=true;
  setText('timer-toggle-btn','\u23F8 Pause');
  timerInterval=setInterval(function(){
    timerRemaining--;
    updateTimerDisplay();
    if(timerRemaining<=0){
      stopTimer(); timerRemaining=timerTotal;
      updateTimerDisplay();
      showToast('Rest complete! Time to work \uD83D\uDCAA');
    }
  },1000);
}
function stopTimer() {
  timerRunning=false;
  clearInterval(timerInterval); timerInterval=null;
  setText('timer-toggle-btn','\u25B6 Start');
}
function updateTimerDisplay() {
  var el=document.getElementById('timer-display');
  if(el){
    el.textContent=formatTime(timerRemaining);
    el.style.color=timerRemaining<=10?'var(--accent3)':'var(--accent)';
  }
}

// ─── JOURNAL ─────────────────────────────────────────────────────────────────
var selectedMood=0;
function selectMood(btn) {
  selectedMood=parseInt(btn.getAttribute('data-mood'));
  document.querySelectorAll('.mood-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}
function saveJournal() {
  var text=document.getElementById('journal-input').value.trim();
  if(!text&&!selectedMood){ closeModal(); return; }
  var entries=load('journal-entries',[]);
  var existing=entries.findIndex(function(e){return e.date===todayKey();});
  var entry={date:todayKey(), text:text, mood:selectedMood, ts:Date.now()};
  if(existing>=0) entries[existing]=entry; else entries.push(entry);
  save('journal-entries',entries);
  loadJournalHistory(); loadJournalPreview();
  closeModal(); showToast('Note saved \u2713');
}
function loadJournalHistory() {
  var entries=load('journal-entries',[]);
  var container=document.getElementById('journal-history'); if(!container) return;
  if(entries.length===0){ container.innerHTML='<div class="pr-empty">No entries yet.</div>'; return; }
  container.innerHTML='';
  entries.slice().reverse().slice(0,10).forEach(function(e){
    var div=document.createElement('div'); div.className='journal-entry';
    var moods=['','😞','😐','🙂','😄','🔥'];
    div.innerHTML=
      '<div class="je-header">'+
        '<span class="je-date">'+e.date+'</span>'+
        (e.mood?'<span class="je-mood">'+moods[e.mood]+'</span>':'')+
      '</div>'+
      (e.text?'<div class="je-text">'+escHtml(e.text)+'</div>':'');
    container.appendChild(div);
  });
}
function loadJournalPreview() {
  var entries=load('journal-entries',[]);
  var today=entries.find(function(e){return e.date===todayKey();});
  var preview=document.getElementById('journal-preview');
  var btn=document.getElementById('journal-btn');
  var moods=['','😞','😐','🙂','😄','🔥'];
  if(today){
    if(preview){ preview.style.display='flex'; }
    setText('jp-mood',today.mood?moods[today.mood]:'');
    setText('jp-text',today.text||'');
    if(btn) btn.style.display='none';
    // Pre-fill modal
    document.getElementById('journal-input').value=today.text||'';
    if(today.mood){
      selectedMood=today.mood;
      setTimeout(function(){
        var btn2=document.querySelector('.mood-btn[data-mood="'+today.mood+'"]');
        if(btn2) btn2.classList.add('active');
      },100);
    }
  } else {
    if(preview) preview.style.display='none';
    if(btn) btn.style.display='block';
  }
}

// ─── CALENDAR STRIP ──────────────────────────────────────────────────────────
function buildCalendarStrip() {
  var strip=document.getElementById('cal-strip'); if(!strip) return;
  var days=['S','M','T','W','T','F','S'],today=new Date(),todayDow=today.getDay();
  var start=new Date(today); start.setDate(start.getDate()-todayDow);
  for(var i=0;i<14;i++){
    var d=new Date(start); d.setDate(d.getDate()+i);
    var div=document.createElement('div');
    div.className='cal-day'+(i===todayDow?' today':'')+(i<todayDow?' active':'');
    div.innerHTML='<div class="cal-day-name">'+days[d.getDay()]+'</div><div class="cal-day-num">'+d.getDate()+'</div>';
    div.addEventListener('click',(function(el){return function(){
      document.querySelectorAll('.cal-day').forEach(function(x){x.classList.remove('active');});
      el.classList.add('active');
    };})(div));
    strip.appendChild(div);
  }
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById(id).classList.add('show');
  // Reset timer display when opening timer modal
  if(id==='modal-timer') updateTimerDisplay();
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.querySelectorAll('.modal').forEach(function(m){m.classList.remove('show');});
}

// ─── RESET ───────────────────────────────────────────────────────────────────
function confirmReset() {
  if(confirm('Reset ALL data? This cannot be undone.')) {
    localStorage.clear();
    location.reload();
  }
}

// ─── SERVICE WORKER ──────────────────────────────────────────────────────────
function registerServiceWorker() {
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js')
      .then(function(r){console.log('[FitPulse] SW:',r.scope);})
      .catch(function(e){console.warn('[FitPulse] SW failed:',e);});
  }
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
var toastTimer=null;
function showToast(msg) {
  var t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('show');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.remove('show');},2400);
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function setText(id,val){ var el=document.getElementById(id); if(el) el.textContent=val; }
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
