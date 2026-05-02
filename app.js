/* ═══════════════════════════════════════════
   FITPULSE — app.js
   ═══════════════════════════════════════════ */

'use strict';

// ─── STATE ───────────────────────────────────────────────────────────────────
let deferredInstallPrompt = null;
let runInterval = null;
let runSeconds = 0;
let isRunning = false;
let workoutDone = 0;
const WORKOUT_TOTAL = 5;

// ─── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  setGreeting();
  setupTabs();
  buildCalendarStrip();
  buildWeekChart();
  buildHabitDots();
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
// All tab buttons use data-tab attribute. Works for both top nav and bottom nav.
function setupTabs() {
  var allBtns = document.querySelectorAll('[data-tab]');
  allBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.getAttribute('data-tab'));
    });
  });
}

function switchTab(tabName) {
  // Hide all sections
  var sections = document.querySelectorAll('.section');
  sections.forEach(function (s) { s.classList.remove('active'); });

  // Show target section
  var target = document.getElementById('sec-' + tabName);
  if (target) target.classList.add('active');

  // Update all nav buttons (both top and bottom)
  var allBtns = document.querySelectorAll('[data-tab]');
  allBtns.forEach(function (btn) {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Scroll to top of page when switching tabs
  window.scrollTo(0, 0);
}

// ─── PWA / INSTALL ───────────────────────────────────────────────────────────
function checkPWAStatus() {
  // navigator.standalone is true ONLY on iOS Safari when launched from Home Screen.
  // display-mode: standalone is true ONLY when launched as installed PWA (not in browser).
  // We require BOTH conditions to be absent before showing the prompt —
  // and we never unlock just from a media query match inside a browser tab.
  var iosStandalone = window.navigator.standalone === true;
  var androidStandalone = window.matchMedia('(display-mode: standalone)').matches
                       && !window.matchMedia('(display-mode: browser)').matches;

  var isInstalled = iosStandalone || androidStandalone;
  // Also check if user previously installed on this device (survives page reloads)
  var wasInstalled = localStorage.getItem('pwa-installed') === '1';

  if (isInstalled || wasInstalled) {
    unlockPWAFeatures();
  } else {
    // Regular browser — show iOS home screen prompt after a delay
    var dismissed = localStorage.getItem('hsp-dismissed');
    if (!dismissed) {
      setTimeout(showHSP, 3500);
    }
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    var banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('show');
  });

  window.addEventListener('appinstalled', function () {
    var banner = document.getElementById('install-banner');
    if (banner) banner.classList.remove('show');
    dismissHSP();
    unlockPWAFeatures();
    showToast('FitPulse installed! PRO features unlocked \uD83C\uDF89');
  });
}

function installPWA() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function (result) {
      if (result.outcome === 'accepted') unlockPWAFeatures();
      deferredInstallPrompt = null;
    });
  }
}

function unlockPWAFeatures() {
  var badge = document.getElementById('pwa-badge');
  if (badge) badge.classList.add('show');

  var lockIds = ['lock-home', 'lock-workout', 'lock-nutrition', 'lock-habits', 'lock-running'];
  lockIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  });

  // Remember this device has installed the app
  localStorage.setItem('pwa-installed', '1');
}

function showHSP() {
  var hsp = document.getElementById('hsp');
  if (hsp) hsp.classList.add('show');
}

function dismissHSP() {
  var hsp = document.getElementById('hsp');
  if (hsp) hsp.classList.remove('show');
  localStorage.setItem('hsp-dismissed', '1');
}

// ─── SERVICE WORKER ──────────────────────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(function (reg) { console.log('[FitPulse] SW registered:', reg.scope); })
      .catch(function (err) { console.warn('[FitPulse] SW failed:', err); });
  }
}

// ─── CALENDAR STRIP ──────────────────────────────────────────────────────────
function buildCalendarStrip() {
  var strip = document.getElementById('cal-strip');
  if (!strip) return;

  var dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var today = new Date();
  var todayDow = today.getDay();

  var start = new Date(today);
  start.setDate(start.getDate() - todayDow);

  for (var i = 0; i < 14; i++) {
    var d = new Date(start);
    d.setDate(d.getDate() + i);

    var div = document.createElement('div');
    div.className = 'cal-day';
    if (i === todayDow) div.classList.add('today');
    if (i < todayDow) div.classList.add('active');

    div.innerHTML =
      '<div class="cal-day-name">' + dayNames[d.getDay()] + '</div>' +
      '<div class="cal-day-num">' + d.getDate() + '</div>';

    div.addEventListener('click', (function (el) {
      return function () {
        document.querySelectorAll('.cal-day').forEach(function (x) { x.classList.remove('active'); });
        el.classList.add('active');
      };
    })(div));

    strip.appendChild(div);
  }
}

// ─── WEEKLY BAR CHART ────────────────────────────────────────────────────────
function buildWeekChart() {
  var chart = document.getElementById('mini-chart');
  if (!chart) return;

  var vals = [60, 85, 40, 100, 72, 88, 55];
  var days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var today = new Date().getDay();

  vals.forEach(function (v, i) {
    var bar = document.createElement('div');
    bar.className = 'bar' + (i === today ? ' active' : '');
    bar.style.height = Math.round(v * 0.48) + 'px';
    bar.title = days[i] + ': ' + v + '% of goal';
    chart.appendChild(bar);
  });
}

// ─── HABIT DOTS ──────────────────────────────────────────────────────────────
function buildHabitDots() {
  var habits = [
    { id: 'hd1', streak: 6 },
    { id: 'hd2', streak: 4 },
    { id: 'hd3', streak: 5 },
    { id: 'hd4', streak: 3 },
    { id: 'hd5', streak: 2 },
    { id: 'hd6', streak: 7 },
  ];

  habits.forEach(function (h) {
    var el = document.getElementById(h.id);
    if (!el) return;
    for (var i = 0; i < 7; i++) {
      var dot = document.createElement('div');
      var cls = 'habit-dot';
      if (i === 6) cls += ' today';
      else if (i < h.streak) cls += ' done';
      dot.className = cls;
      el.appendChild(dot);
    }
  });
}

// ─── WORKOUT CHECKS ──────────────────────────────────────────────────────────
function toggleCheck(el) {
  var wasDone = el.classList.contains('done');
  el.classList.toggle('done');
  el.textContent = el.classList.contains('done') ? '\u2713' : '';

  workoutDone += el.classList.contains('done') ? 1 : -1;
  workoutDone = Math.max(0, Math.min(workoutDone, WORKOUT_TOTAL));

  var pText = document.getElementById('workout-progress-text');
  var pFill = document.getElementById('workout-progress-fill');
  if (pText) pText.textContent = workoutDone + ' / ' + WORKOUT_TOTAL + ' done';
  if (pFill) pFill.style.width = Math.round((workoutDone / WORKOUT_TOTAL) * 100) + '%';

  showToast(el.classList.contains('done') ? 'Exercise complete! \uD83D\uDCAA' : 'Unmarked');
}

// ─── HABITS ──────────────────────────────────────────────────────────────────
function toggleHabit(el) {
  el.classList.toggle('active');
  el.textContent = el.classList.contains('active') ? '\u2713' : '';
  el.setAttribute('aria-pressed', el.classList.contains('active') ? 'true' : 'false');
  showToast(el.classList.contains('active') ? 'Habit done! \uD83C\uDFAF' : 'Habit unmarked');
}

// ─── RUN TRACKER ─────────────────────────────────────────────────────────────
function toggleRun() {
  if (!isRunning) {
    startRun();
  } else {
    stopRun();
  }
}

function startRun() {
  isRunning = true;
  runSeconds = 0;
  var btn = document.getElementById('run-btn');
  var sub = document.getElementById('run-sub');
  if (btn) { btn.textContent = '\u23F8 Stop Run'; btn.classList.add('running'); }
  if (sub) sub.textContent = 'Running...';
  runInterval = setInterval(tickRun, 1000);
}

function stopRun() {
  isRunning = false;
  clearInterval(runInterval);
  runInterval = null;
  var btn = document.getElementById('run-btn');
  var sub = document.getElementById('run-sub');
  var dist = (runSeconds / 400).toFixed(2);
  if (btn) { btn.textContent = '\u25B6 Start Run'; btn.classList.remove('running'); }
  if (sub) sub.textContent = 'Run complete! ' + dist + ' mi in ' + formatTime(runSeconds) + ' \uD83C\uDF89';
  showToast('Run saved! \uD83C\uDFC3');
}

function tickRun() {
  runSeconds++;
  var dist = runSeconds / 400;
  var distEl = document.getElementById('run-dist');
  var timeEl = document.getElementById('run-time');
  var paceEl = document.getElementById('run-pace');
  var calEl  = document.getElementById('run-cal');
  if (distEl) distEl.innerHTML = dist.toFixed(2) + ' <span class="run-dist-unit">mi</span>';
  if (timeEl) timeEl.textContent = formatTime(runSeconds);
  if (calEl)  calEl.textContent  = Math.round(runSeconds * 0.12);
  if (paceEl && dist > 0) paceEl.textContent = formatTime(Math.round(runSeconds / dist));
}

function formatTime(totalSec) {
  var m = Math.floor(totalSec / 60);
  var s = totalSec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
var toastTimer = null;
function showToast(msg) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2400);
}