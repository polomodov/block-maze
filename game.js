import { createGame } from './engine.js';
import { drawBoard, drawLandscape, drawMonsterPortrait, drawPortrait } from './art.js';

const byId = (id) => document.getElementById(id);
const lobby = byId('lobby');
const arena = byId('arena');
const board = byId('board');
const startButton = byId('play');
const pauseButton = byId('pause');
const abilityButton = byId('ability');
const message = byId('message');
const resumeButton = byId('resume');
const soundButton = byId('sound');
const help = byId('help-dialog');
const lives = byId('lives');
const gems = byId('gems');

const heroes = {
  kirill: { name: 'Кирилл', action: 'Ускориться' },
  maxim: { name: 'Максим', action: 'Ударить' },
};
const directions = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

let game;
let frame;
let previousTime;
let swipe;
let soundEnabled = false;
let audio;
let resumeAfterHelp = false;

function setText(element, value) {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

function buttonText(button, text) {
  setText(button.querySelector('[data-label]') || button, text);
}

function playNote(frequency, duration, type = 'triangle') {
  if (!soundEnabled || audio?.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function displaySound() {
  soundButton.setAttribute('aria-label', 'Звук');
  soundButton.title = soundEnabled ? 'Выключить звук' : 'Включить звук';
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  buttonText(soundButton, soundEnabled ? 'Звук вкл.' : 'Звук выкл.');
}

soundButton.addEventListener('click', async () => {
  soundEnabled = !soundEnabled;
  displaySound();
  if (!soundEnabled) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    audio ??= new Audio();
    await audio.resume();
    playNote(660, 0.12);
  } catch {
    soundEnabled = false;
    displaySound();
  }
});

function updateHud() {
  const state = game.state;
  setText(lives, state.lives);
  setText(gems, state.collected + ' / ' + state.totalGems);
  const cooldown = Math.ceil(state.cooldown);
  buttonText(abilityButton, cooldown > 0
    ? heroes[state.hero].action + ' · ' + cooldown + ' с'
    : heroes[state.hero].action);
  abilityButton.disabled = state.status !== 'playing' || cooldown > 0;
}

function updateScreen() {
  const { status, totalGems } = game.state;
  const paused = status === 'paused';
  const finished = status === 'won' || status === 'lost';
  message.hidden = !paused && !finished;
  pauseButton.disabled = finished;
  buttonText(pauseButton, paused ? 'Продолжить' : 'Пауза');
  updateHud();
  drawBoard(board, game.state);
  if (message.hidden) return;
  const screens = {
    paused: ['Пауза', 'Лабиринт подождёт.', 'Продолжить'],
    won: ['Победа!', 'Все изумруды собраны (' + totalGems + ').', 'Сыграть ещё'],
    lost: ['Попытки закончились', 'Собрано изумрудов: ' + game.state.collected + ' из ' + totalGems + '.', 'Попробовать ещё'],
  };
  const [title, copy, action] = screens[status];
  setText(byId('message-title'), title);
  setText(byId('message-copy'), copy);
  buttonText(resumeButton, action);
  if (!help.open) resumeButton.focus({ preventScroll: true });
}

function animate(time) {
  if (game?.state.status !== 'playing') return;
  const { collected, lives: previousLives } = game.state;
  const elapsed = previousTime === undefined ? 0 : (time - previousTime) / 1000;
  previousTime = time;
  game.update(Math.min(0.1, elapsed));

  if (game.state.lives < previousLives) playNote(124, 0.28, 'sawtooth');
  else if (game.state.collected > collected) playNote(770, 0.065);
  if (game.state.status !== 'playing') {
    if (game.state.status === 'won') playNote(980, 0.3);
    updateScreen();
    return;
  }
  updateHud();
  drawBoard(board, game.state);
  frame = requestAnimationFrame(animate);
}

function run() {
  cancelAnimationFrame(frame);
  previousTime = undefined;
  updateScreen();
  board.focus({ preventScroll: true });
  frame = requestAnimationFrame(animate);
}

function start() {
  const hero = document.querySelector('input[name="hero"]:checked').value;
  game = createGame(hero);
  game.start();
  setText(byId('hero-name'), heroes[hero].name);
  lobby.hidden = true;
  arena.hidden = false;
  playNote(520, 0.13);
  run();
}

function pause() {
  if (game?.state.status !== 'playing') return;
  cancelAnimationFrame(frame);
  swipe = undefined;
  game.pause();
  updateScreen();
}

function resume() {
  if (game?.state.status !== 'paused') return;
  game.resume();
  run();
}

function togglePause() {
  if (game?.state.status === 'paused') resume();
  else pause();
}

function activate() {
  if (game?.state.status !== 'playing' || !game.activate()) return;
  playNote(game.state.hero === 'kirill' ? 920 : 175, 0.18, 'square');
  updateHud();
}

startButton.addEventListener('click', start);
pauseButton.addEventListener('click', togglePause);
abilityButton.addEventListener('click', activate);
resumeButton.addEventListener('click', () => {
  if (game?.state.status === 'paused') resume();
  else start();
});
byId('menu').addEventListener('click', () => {
  cancelAnimationFrame(frame);
  game = undefined;
  swipe = undefined;
  arena.hidden = true;
  lobby.hidden = false;
  const selected = document.querySelector('input[name="hero"]:checked');
  selected.focus({ preventScroll: true });
});

byId('help').addEventListener('click', () => {
  resumeAfterHelp = game?.state.status === 'playing';
  help.showModal();
  if (resumeAfterHelp) pause();
});
help.addEventListener('close', () => {
  if (resumeAfterHelp && !document.hidden) resume();
  resumeAfterHelp = false;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resumeAfterHelp = false;
    pause();
  }
});

document.addEventListener('keydown', (event) => {
  if (!game || event.altKey || event.ctrlKey || event.metaKey || help.open) return;
  if (event.code === 'Escape') {
    event.preventDefault();
    if (!event.repeat) togglePause();
    return;
  }
  if (game.state.status !== 'playing') return;
  const dir = directions[event.code];
  if (dir) {
    event.preventDefault();
    game.turn(dir);
  } else if (event.code === 'Space' && !event.target.closest('button, input, a, dialog')) {
    event.preventDefault();
    if (!event.repeat) activate();
  }
});

byId('dpad').querySelectorAll('button[data-dir]').forEach((button) => {
  const turn = () => {
    if (game?.state.status === 'playing') game.turn(button.dataset.dir);
  };
  button.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    turn();
  });
  button.addEventListener('click', (event) => {
    if (event.detail === 0) turn();
  });
});

board.tabIndex = 0;
board.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0 || game?.state.status !== 'playing') return;
  board.focus({ preventScroll: true });
  swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  board.setPointerCapture(event.pointerId);
});

function readSwipe(event) {
  if (swipe?.id !== event.pointerId || game?.state.status !== 'playing') return;
  const dx = event.clientX - swipe.x;
  const dy = event.clientY - swipe.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
  const dir = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left')
    : (dy > 0 ? 'down' : 'up');
  game.turn(dir);
  swipe.x = event.clientX;
  swipe.y = event.clientY;
}

board.addEventListener('pointermove', readSwipe);
board.addEventListener('pointerup', (event) => {
  readSwipe(event);
  if (swipe?.id === event.pointerId) swipe = undefined;
});
board.addEventListener('lostpointercapture', (event) => {
  if (swipe?.id === event.pointerId) swipe = undefined;
});

// Render the pixel artwork at its native resolution; CSS scales it to the screen.
drawLandscape(byId('landscape'));
document.querySelectorAll('canvas[data-hero]').forEach((canvas) => drawPortrait(canvas, canvas.dataset.hero));
document.querySelectorAll('canvas[data-monster]').forEach((canvas) => drawMonsterPortrait(canvas, canvas.dataset.monster));
displaySound();
