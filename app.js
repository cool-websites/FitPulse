/* ═══════════════════════════════════════════
   FITPULSE — app.js
   All user data saved to localStorage.
   Resets daily stats at midnight automatically.
   ═══════════════════════════════════════════ */

'use strict';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
var WORKOUT_EXERCISES = ['bench-press', 'pullups', 'squats', 'core', 'ohp'];
var HABITS = ['water', 'sleep', 'meditate', 'noscreens', 'read', 'veggies'];

// ─── RUNTIME STATE ───────────────────────────────────────────────────────────
var deferredInstallPrompt = null;
var runInterval = null;
var runSeconds = 0;
var isRunning = false;
var activeStatModal = null; // which stat is being edited

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function load(key, fallback) {
  try {
    var v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch(e) { return fallback; }
}

// ─── DATE HELPERS ────────────────────────────────────────────────────────────
function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

// Returns true if the stored "last active date" is before today
function isNewDay() {
  return load('last-active-date', '') !== todayKey();
}

// Call at startup: if it's a new day, reset daily stats
function handleDayRollover() {
  if (isNewDay()) {
    // Reset daily stats (keep goals)
    save('stat-calories', 0);
    save('stat-steps', 0);
    save('stat-active', 0);
    save('meals-today', []);
    // Reset workout checks
    save('workout-done', []);
    // Update habits: mark yesterday and reset today's toggle
    advanceHabitDay();
    save('last-active-date', todayKey());
  }
}

// ─── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  handleDayRollover();
  setGreeting();
  setupTabs();
  buildCalendarStrip();
  loadHomeStats();
  buildWeekChart();
  loadWorkout();
  loadNutrition();
  loadHabits();
  loadRunHistory();
  checkPWAStatus();
  setupInstallPrompt();
  registerServiceWorker();
});

// ─── GREETING ────────────────────────────────────────────────────────────────
function setGreeting() {
  var h = new Date().getHours();
  var greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  var el = document.getElementById('greeting');
  if (el) el.textContent = greet + ' \u2014 let\u2019s crush today \uD83D\uDCAA';
}

// ─── TAB SWITCHING ───────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.getAttribute('data-tab'));
    });
  });
}

function switchTab(name) {
  document.querySelectorAll('.section').forEach(function (s) { s.classList.remove('active'); });
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === name);
  });
  var sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');
  window.scrollTo(0, 0);
}

// ─── HOME STATS ──────────────────────────────────────────────────────────────
function loadHomeStats() {
  renderStat('calories');
  renderStat('steps');
  renderStat('active');
  renderStreak();
}

function renderStat(key) {
  var val  = load('stat-' + key, 0);
  var goal = load('goal-' + key, defaultGoal(key));
  var el   = document.getElementById('stat-' + key);
  var gelp = document.getElementById('stat-' + key + '-goal');
  if (el) el.textContent = val.toLocaleString();
  if (gelp) gelp.textContent = 'of ' + goal.toLocaleString() + goalUnit(key);
}

function defaultGoal(key) {
  return { calories: 2000, steps: 10000, active: 60 }[key] || 0;
}
function goalUnit(key) {
  return key === 'active' ? ' min goal' : ' goal';
}

function renderStreak() {
  var streak = load('habit-overall-streak', 0);
  var el = document.getElementById('stat-streak');
  if (el) el.textContent = streak;
}

// ─── STAT MODAL ──────────────────────────────────────────────────────────────
var statConfig = {
  calories: { title: 'Calories',    valLabel: 'Calories eaten today', goalLabel: 'Daily calorie goal' },
  steps:    { title: 'Steps',       valLabel: 'Steps taken today',    goalLabel: 'Daily step goal' },
  active:   { title: 'Active Min',  valLabel: 'Active minutes today', goalLabel: 'Daily goal (minutes)' },
};

function openStatModal(key) {
  activeStatModal = key;
  var cfg = statConfig[key];
  document.getElementById('modal-stat-title').textContent  = 'Update ' + cfg.title;
  document.getElementById('modal-stat-label').textContent  = cfg.valLabel;
  document.getElementById('modal-goal-label').textContent  = cfg.goalLabel;
  document.getElementById('modal-stat-input').value        = load('stat-' + key, 0);
  document.getElementById('modal-goal-input').value        = load('goal-' + key, defaultGoal(key));
  openModal('modal-stat');
}

function saveStatModal() {
  if (!activeStatModal) return;
  var val  = parseInt(document.getElementById('modal-stat-input').value, 10) || 0;
  var goal = parseInt(document.getElementById('modal-goal-input').value, 10) || defaultGoal(activeStatModal);
  save('stat-' + activeStatModal, val);
  save('goal-' + activeStatModal, goal);
  renderStat(activeStatModal);
  // Also update nutrition ring if calories changed
  if (activeStatModal === 'calories') updateCalorieRing();
  closeModal();
  showToast('Stats updated \u2713');
}

// ─── WEEK CHART ──────────────────────────────────────────────────────────────
function buildWeekChart() {
  var chart = document.getElementById('mini-chart');
  if (!chart) return;
  chart.innerHTML = '';
  var history = load('weekly-calories', [0,0,0,0,0,0,0]);
  // Put today's value in
  history[new Date().getDay()] = load('stat-calories', 0);
  var goal = load('goal-calories', 2000);
  var days = ['S','M','T','W','T','F','S'];
  var today = new Date().getDay();
  history.forEach(function (v, i) {
    var pct = goal > 0 ? Math.min(v / goal, 1) : 0;
    var bar = document.createElement('div');
    bar.className = 'bar' + (i === today ? ' active' : '');
    bar.style.height = Math.max(4, Math.round(pct * 48)) + 'px';
    bar.title = days[i] + ': ' + v + ' cal';
    chart.appendChild(bar);
  });
}

// ─── WORKOUT ─────────────────────────────────────────────────────────────────
function loadWorkout() {
  var done = load('workout-done', []);
  var checks = document.querySelectorAll('#workout-list .workout-check');
  var items  = document.querySelectorAll('#workout-list .workout-item');
  items.forEach(function (item, i) {
    var key = item.getAttribute('data-exercise');
    var isDone = done.indexOf(key) !== -1;
    if (checks[i]) {
      checks[i].classList.toggle('done', isDone);
      checks[i].textContent = isDone ? '\u2713' : '';
    }
  });
  updateWorkoutProgress();
}

function toggleCheck(btn) {
  btn.classList.toggle('done');
  btn.textContent = btn.classList.contains('done') ? '\u2713' : '';
  // Save state
  var done = [];
  document.querySelectorAll('#workout-list .workout-item').forEach(function (item) {
    var check = item.querySelector('.workout-check');
    if (check && check.classList.contains('done')) {
      done.push(item.getAttribute('data-exercise'));
    }
  });
  save('workout-done', done);
  updateWorkoutProgress();
  showToast(btn.classList.contains('done') ? 'Exercise complete! \uD83D\uDCAA' : 'Unmarked');
}

function updateWorkoutProgress() {
  var done  = document.querySelectorAll('#workout-list .workout-check.done').length;
  var total = WORKOUT_EXERCISES.length;
  var pText = document.getElementById('workout-progress-text');
  var pFill = document.getElementById('workout-progress-fill');
  if (pText) pText.textContent = done + ' / ' + total + ' done';
  if (pFill) pFill.style.width = Math.round((done / total) * 100) + '%';
}

// ─── NUTRITION ───────────────────────────────────────────────────────────────
function loadNutrition() {
  renderFoodLog();
  updateCalorieRing();
}

function renderFoodLog() {
  var meals  = load('meals-today', []);
  var list   = document.getElementById('food-log');
  var empty  = document.getElementById('food-log-empty');
  if (!list) return;
  list.innerHTML = '';
  if (meals.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  meals.forEach(function (meal, idx) {
    var li = document.createElement('li');
    li.className = 'food-item';
    li.innerHTML =
      '<div>' +
        '<div class="food-name">' + escHtml(meal.name) + '</div>' +
        '<div class="food-time">' + escHtml(meal.type) + ' \u00B7 ' + meal.time + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div class="food-cal">' + meal.cal + ' cal</div>' +
        '<button class="meal-delete" onclick="deleteMeal(' + idx + ')" aria-label="Delete meal">\u00D7</button>' +
      '</div>';
    list.appendChild(li);
  });
}

function updateCalorieRing() {
  var meals = load('meals-today', []);
  var totalCal = meals.reduce(function (sum, m) { return sum + (m.cal || 0); }, 0);
  var goal = load('goal-calories', 2000);
  var pct = goal > 0 ? Math.min(totalCal / goal, 1) : 0;
  var circumference = 408;
  var offset = circumference - Math.round(pct * circumference);

  var arc       = document.getElementById('calorie-ring-arc');
  var valEl     = document.getElementById('ring-cal-val');
  var remEl     = document.getElementById('ring-cal-remaining');
  var macProt   = document.getElementById('macro-protein');
  var macCarbs  = document.getElementById('macro-carbs');
  var macFat    = document.getElementById('macro-fat');

  if (arc)    arc.setAttribute('stroke-dashoffset', offset);
  if (valEl)  valEl.textContent = totalCal.toLocaleString();
  if (remEl)  remEl.textContent = Math.max(0, goal - totalCal).toLocaleString() + ' remaining';

  // Rough macro estimates (protein 4cal/g, carbs 4cal/g, fat 9cal/g at 30/40/30 split)
  if (macProt)  macProt.textContent  = Math.round(totalCal * 0.30 / 4) + 'g';
  if (macCarbs) macCarbs.textContent = Math.round(totalCal * 0.40 / 4) + 'g';
  if (macFat)   macFat.textContent   = Math.round(totalCal * 0.30 / 9) + 'g';

  // Also sync the home calories stat card
  save('stat-calories', totalCal);
  renderStat('calories');
  buildWeekChart();
}

function openMealModal() {
  document.getElementById('meal-name-input').value = '';
  document.getElementById('meal-cal-input').value  = '';
  openModal('modal-meal');
  setTimeout(function () { document.getElementById('meal-name-input').focus(); }, 100);
}

function saveMeal() {
  var name = document.getElementById('meal-name-input').value.trim();
  var cal  = parseInt(document.getElementById('meal-cal-input').value, 10) || 0;
  var type = document.getElementById('meal-type-input').value;
  if (!name) { showToast('Please enter a meal name'); return; }

  var now  = new Date();
  var time = now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
  var ampm = now.getHours() < 12 ? 'AM' : 'PM';
  var h12  = now.getHours() % 12 || 12;
  var timeStr = h12 + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes() + ' ' + ampm;

  var meals = load('meals-today', []);
  meals.push({ name: name, cal: cal, type: type, time: timeStr });
  save('meals-today', meals);
  renderFoodLog();
  updateCalorieRing();
  closeModal();
  showToast('Meal logged! \uD83C\uDF7D\uFE0F');
}

function deleteMeal(idx) {
  var meals = load('meals-today', []);
  meals.splice(idx, 1);
  save('meals-today', meals);
  renderFoodLog();
  updateCalorieRing();
  showToast('Meal removed');
}

// ─── HABITS ──────────────────────────────────────────────────────────────────
function loadHabits() {
  var todayDone = load('habits-today', {});
  HABITS.forEach(function (key, i) {
    var card   = document.querySelector('[data-habit="' + key + '"]');
    var toggle = card ? card.querySelector('.habit-toggle') : null;
    var isDone = todayDone[key] === true;
    if (toggle) {
      toggle.classList.toggle('active', isDone);
      toggle.textContent = isDone ? '\u2713' : '';
      toggle.setAttribute('aria-pressed', isDone ? 'true' : 'false');
    }
    renderHabitStreak(key);
    buildHabitDots(key, i + 1);
  });
  updateOverallStreak();
}

function toggleHabit(btn) {
  var card = btn.closest('[data-habit]');
  var key  = card ? card.getAttribute('data-habit') : null;
  if (!key) return;

  btn.classList.toggle('active');
  var isDone = btn.classList.contains('active');
  btn.textContent = isDone ? '\u2713' : '';
  btn.setAttribute('aria-pressed', isDone ? 'true' : 'false');

  var todayDone = load('habits-today', {});
  todayDone[key] = isDone;
  save('habits-today', todayDone);

  // Update streak
  var streaks = load('habit-streaks', {});
  if (isDone) {
    streaks[key] = (streaks[key] || 0) + 1;
  } else {
    streaks[key] = Math.max(0, (streaks[key] || 1) - 1);
  }
  save('habit-streaks', streaks);
  renderHabitStreak(key);
  updateOverallStreak();
  showToast(isDone ? 'Habit done! \uD83C\uDFAF' : 'Habit unmarked');
}

function renderHabitStreak(key) {
  var streaks = load('habit-streaks', {});
  var el = document.getElementById('streak-' + key);
  if (el) el.textContent = streaks[key] || 0;
}

function updateOverallStreak() {
  var todayDone = load('habits-today', {});
  var allDone = HABITS.every(function (k) { return todayDone[k] === true; });
  if (allDone) {
    var s = load('habit-overall-streak', 0);
    save('habit-overall-streak', s + 1);
  }
  renderStreak();
}

function advanceHabitDay() {
  // Called on new day: habits reset, streaks stay
  save('habits-today', {});
}

function buildHabitDots(key, dotId) {
  var el = document.getElementById('hd' + dotId);
  if (!el) return;
  el.innerHTML = '';
  var history = load('habit-history-' + key, []);
  // Show last 6 days + today
  for (var i = 0; i < 7; i++) {
    var dot = document.createElement('div');
    var isToday = i === 6;
    var wasDone = history[i] === true;
    dot.className = 'habit-dot' + (isToday ? ' today' : wasDone ? ' done' : '');
    el.appendChild(dot);
  }
}

// ─── RUN TRACKER (GPS) ───────────────────────────────────────────────────────
var gpsWatchId    = null;   // navigator.geolocation watch handle
var gpsCoords     = [];     // array of {lat, lng} points collected this run
var gpsDistMiles  = 0;      // accumulated GPS distance in miles
var gpsLastPos    = null;   // last known position

function loadRunHistory() {
  var runs  = load('run-history', []);
  var list  = document.getElementById('run-history');
  var empty = document.getElementById('run-empty');
  if (!list) return;
  list.querySelectorAll('.workout-item').forEach(function (i) { i.remove(); });
  if (runs.length === 0) { if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  runs.slice().reverse().slice(0, 5).forEach(function (run) {
    var li = document.createElement('li');
    li.className = 'workout-item';
    li.innerHTML =
      '<div class="workout-icon wi-green">\uD83C\uDFC3</div>' +
      '<div class="workout-info">' +
        '<div class="workout-name">' + escHtml(run.label) + '</div>' +
        '<div class="workout-meta">' + run.dist + ' mi \u00B7 ' + run.time + ' \u00B7 ' + run.pace + '/mi' +
          (run.gps ? ' \u00B7 \uD83D\uDCCD GPS' : '') + '</div>' +
      '</div>' +
      '<div class="run-day-label">' + run.day + '</div>';
    list.insertBefore(li, list.firstChild);
  });
}

function toggleRun() {
  if (!isRunning) startRun(); else stopRun();
}

function startRun() {
  isRunning    = true;
  runSeconds   = 0;
  gpsCoords    = [];
  gpsDistMiles = 0;
  gpsLastPos   = null;

  var btn = document.getElementById('run-btn');
  var sub = document.getElementById('run-sub');
  if (btn) { btn.textContent = '\u23F8 Stop Run'; btn.classList.add('running'); }

  // Try to get GPS — ask permission and start watching position
  if ('geolocation' in navigator) {
    if (sub) sub.textContent = 'Acquiring GPS signal...';
    gpsWatchId = navigator.geolocation.watchPosition(
      onGpsPosition,
      onGpsError,
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000
      }
    );
  } else {
    if (sub) sub.textContent = 'Running... (no GPS available)';
  }

  runInterval = setInterval(tickRun, 1000);
}

function onGpsPosition(pos) {
  var lat = pos.coords.latitude;
  var lng = pos.coords.longitude;
  var acc = pos.coords.accuracy; // meters

  // Ignore very inaccurate readings (> 50m accuracy)
  if (acc > 50) return;

  var sub = document.getElementById('run-sub');

  if (gpsLastPos === null) {
    // First good fix
    if (sub) sub.textContent = 'GPS locked \uD83D\uDCCD Running...';
  } else {
    // Calculate distance from last point and add it
    var delta = haversineDistMiles(gpsLastPos.lat, gpsLastPos.lng, lat, lng);
    // Ignore tiny jitter (< 3 meters = ~0.00186 miles)
    if (delta > 0.00186) {
      gpsDistMiles += delta;
    }
  }

  gpsLastPos = { lat: lat, lng: lng };
  gpsCoords.push({ lat: lat, lng: lng });
  updateRunDisplay();
}

function onGpsError(err) {
  var sub = document.getElementById('run-sub');
  var msg = 'Running (GPS unavailable)';
  if (err.code === 1) msg = 'Location permission denied — using timer';
  else if (err.code === 2) msg = 'GPS signal lost — using timer';
  if (sub) sub.textContent = msg;
}

// Haversine formula — returns distance in miles between two lat/lng points
function haversineDistMiles(lat1, lng1, lat2, lng2) {
  var R = 3958.8; // Earth radius in miles
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function stopRun() {
  isRunning = false;
  clearInterval(runInterval);
  runInterval = null;

  // Stop GPS watching
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  var usingGPS = gpsDistMiles > 0;
  var distNum  = usingGPS ? gpsDistMiles : runSeconds / 400;
  var dist     = distNum.toFixed(2);
  var timeStr  = formatTime(runSeconds);
  var paceStr  = runSeconds > 0 && distNum > 0
    ? formatTime(Math.round(runSeconds / distNum))
    : '0:00';

  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var h = new Date().getHours();
  var run = {
    dist:  dist,
    time:  timeStr,
    pace:  paceStr,
    day:   days[new Date().getDay()],
    label: h < 12 ? 'Morning Run' : h < 17 ? 'Afternoon Run' : 'Evening Run',
    gps:   usingGPS
  };

  var runs = load('run-history', []);
  runs.push(run);
  save('run-history', runs);
  loadRunHistory();

  var btn = document.getElementById('run-btn');
  var sub = document.getElementById('run-sub');
  if (btn) { btn.textContent = '\u25B6 Start Run'; btn.classList.remove('running'); }
  if (sub) sub.textContent = 'Done! ' + dist + ' mi in ' + timeStr + ' \uD83C\uDF89' + (usingGPS ? ' \uD83D\uDCCD' : '');

  // Reset display
  ['run-dist','run-time','run-pace','run-cal'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (id === 'run-dist') el.innerHTML = '0.00 <span class="run-dist-unit">mi</span>';
    else el.textContent = '0:00';
  });
  document.getElementById('run-cal').textContent = '0';

  gpsDistMiles = 0;
  gpsLastPos   = null;
  gpsCoords    = [];

  showToast('Run saved! \uD83C\uDFC3');
}

function tickRun() {
  runSeconds++;
  updateRunDisplay();
}

function updateRunDisplay() {
  var usingGPS = gpsDistMiles > 0;
  var distNum  = usingGPS ? gpsDistMiles : runSeconds / 400;
  var distEl   = document.getElementById('run-dist');
  var timeEl   = document.getElementById('run-time');
  var paceEl   = document.getElementById('run-pace');
  var calEl    = document.getElementById('run-cal');
  // Calories: ~60 cal/mile running, or ~0.12/sec fallback
  var cal = usingGPS ? Math.round(gpsDistMiles * 60) : Math.round(runSeconds * 0.12);
  if (distEl) distEl.innerHTML = distNum.toFixed(2) + ' <span class="run-dist-unit">mi</span>';
  if (timeEl) timeEl.textContent = formatTime(runSeconds);
  if (calEl)  calEl.textContent  = cal;
  if (paceEl && distNum > 0 && runSeconds > 0) {
    paceEl.textContent = formatTime(Math.round(runSeconds / distNum));
  }
}

function formatTime(s) {
  var m   = Math.floor(s / 60);
  var sec = s % 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// ─── CALENDAR STRIP ──────────────────────────────────────────────────────────
function buildCalendarStrip() {
  var strip = document.getElementById('cal-strip');
  if (!strip) return;
  var dayNames = ['S','M','T','W','T','F','S'];
  var today = new Date();
  var todayDow = today.getDay();
  var start = new Date(today);
  start.setDate(start.getDate() - todayDow);
  for (var i = 0; i < 14; i++) {
    var d = new Date(start);
    d.setDate(d.getDate() + i);
    var div = document.createElement('div');
    div.className = 'cal-day' + (i === todayDow ? ' today' : '') + (i < todayDow ? ' active' : '');
    div.innerHTML = '<div class="cal-day-name">' + dayNames[d.getDay()] + '</div><div class="cal-day-num">' + d.getDate() + '</div>';
    div.addEventListener('click', (function(el){ return function(){
      document.querySelectorAll('.cal-day').forEach(function(x){ x.classList.remove('active'); });
      el.classList.add('active');
    }; })(div));
    strip.appendChild(div);
  }
}

// ─── MODAL SYSTEM ────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById(id).classList.add('show');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.querySelectorAll('.modal').forEach(function (m) { m.classList.remove('show'); });
  activeStatModal = null;
}

// ─── PWA ─────────────────────────────────────────────────────────────────────
function checkPWAStatus() {
  var iosStandalone     = window.navigator.standalone === true;
  var androidStandalone = window.matchMedia('(display-mode: standalone)').matches
                       && !window.matchMedia('(display-mode: browser)').matches;
  var wasInstalled      = load('pwa-installed', false) === true;

  if (iosStandalone || androidStandalone || wasInstalled) {
    unlockPWAFeatures();
  } else {
    var dismissed = load('hsp-dismissed', false);
    if (!dismissed) setTimeout(showHSP, 3500);
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    var b = document.getElementById('install-banner');
    if (b) b.classList.add('show');
  });
  window.addEventListener('appinstalled', function () {
    var b = document.getElementById('install-banner');
    if (b) b.classList.remove('show');
    dismissHSP();
    unlockPWAFeatures();
    showToast('FitPulse installed! PRO features unlocked \uD83C\uDF89');
  });
}

function installPWA() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function (r) {
      if (r.outcome === 'accepted') unlockPWAFeatures();
      deferredInstallPrompt = null;
    });
  }
}

function unlockPWAFeatures() {
  var badge = document.getElementById('pwa-badge');
  if (badge) badge.classList.add('show');
  ['lock-home','lock-workout','lock-nutrition','lock-habits','lock-running'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  });
  save('pwa-installed', true);
}

function showHSP() {
  var hsp = document.getElementById('hsp');
  if (hsp) hsp.classList.add('show');
}
function dismissHSP() {
  var hsp = document.getElementById('hsp');
  if (hsp) hsp.classList.remove('show');
  save('hsp-dismissed', true);
}

// ─── SERVICE WORKER ──────────────────────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(function (r) { console.log('[FitPulse] SW registered:', r.scope); })
      .catch(function (e) { console.warn('[FitPulse] SW failed:', e); });
  }
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
var toastTimer = null;
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
