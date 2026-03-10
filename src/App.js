import { useState, useEffect, useRef } from 'react';
import './App.css';

// ============================================
// VOICE SYSTEM - OpenAI TTS (gpt-4o-mini-tts)
// Human-sounding voices via OpenAI API
// Falls back to browser speech if no key set
// ============================================

const OPENAI_TTS_VOICES = [
  { id: 'nova',    label: '🌟 Nova — Warm & Sultry (Female)' },
  { id: 'shimmer', label: '✨ Shimmer — Smooth & Bright (Female)' },
  { id: 'coral',   label: '🪸 Coral — Rich & Expressive (Female)' },
  { id: 'sage',    label: '🌿 Sage — Calm & Seductive (Female)' },
  { id: 'alloy',   label: '⚡ Alloy — Clear & Confident (Female)' },
  { id: 'onyx',    label: '🪨 Onyx — Deep & Powerful (Male)' },
  { id: 'fable',   label: '📖 Fable — Smooth & Charismatic (Male)' },
  { id: 'ash',     label: '🌫️ Ash — Soft & Intimate (Male)' },
  { id: 'ballad',  label: '🎵 Ballad — Velvety & Deep (Male)' },
  { id: 'echo',    label: '🎙️ Echo — Smooth (Male)' },
  { id: 'fable',   label: '📖 Fable — Expressive' },
  { id: 'coral',   label: '🪸 Coral — Warm (Female)' },
  { id: 'sage',    label: '🌿 Sage — Calm & Clear' },
];

// Global voice state — persisted in localStorage
let openaiApiKey = localStorage.getItem('gymBuddyOAIKey') || '';
let openaiVoice = localStorage.getItem('gymBuddyOAIVoice') || 'nova';
let currentTTSAudio = null;
let ttsQueue = [];
let isTTSPlaying = false;

// Separate key for the AI chatbot — same OpenAI key works for both voice + chat
let chatApiKey = localStorage.getItem('gymBuddyChatKey') || localStorage.getItem('gymBuddyOAIKey') || '';
function setChatApiKey(k) {
  chatApiKey = k.trim();
  localStorage.setItem('gymBuddyChatKey', chatApiKey);
}

function setOAIKey(key) {
  openaiApiKey = key.trim();
  localStorage.setItem('gymBuddyOAIKey', openaiApiKey);
}
function setOAIVoice(v) {
  openaiVoice = v;
  localStorage.setItem('gymBuddyOAIVoice', v);
}

// OpenAI TTS fetch — seq is passed in; if seq changed before audio plays, we abort
async function speakWithOpenAI(text, seq, voiceOverride) {
  if (!openaiApiKey) return false;
  try {
    const clean = text
        .replace(/[🔥💪⚡🎯🏆🏋️🥗😴🤖📊✨🎉🏅📋📅🔒🎙️🌟⚡🪨🪸🌿📖]/g, '')
        .replace(/\*\*/g, '').replace(/\n/g, '. ')
        .replace(/[^\x00-\x7F]/g, '')
        .trim()
        .slice(0, 1000);
    if (!clean) return false;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: clean,
        voice: voiceOverride || openaiVoice,
        speed: 1.0,
        response_format: 'mp3',
      }),
    });

    // Check if we've been superseded while waiting for the network
    if (seq !== null && speakSeq !== seq) return true; // return true so speakBrowser is NOT called

    if (!response.ok) {
      try { const j = await response.json(); console.warn('OpenAI TTS:', j?.error?.message); } catch(e) {}
      return false;
    }

    const blob = await response.blob();
    if (seq !== null && speakSeq !== seq) return true; // superseded while reading blob

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentTTSAudio = audio;
    audio.onended = () => { try { URL.revokeObjectURL(url); } catch(e){} currentTTSAudio = null; };
    audio.onerror = () => { try { URL.revokeObjectURL(url); } catch(e){} currentTTSAudio = null; };
    audio.play().catch(e => console.warn('Audio play failed:', e));
    return true;
  } catch (e) {
    console.warn('OpenAI TTS failed:', e.message);
    return false;
  }
}

// Browser Web Speech API fallback
let browserVoices = [];
let selectedVoiceId = '';

function loadBrowserVoices() {
  if (!window.speechSynthesis) return;
  browserVoices = window.speechSynthesis.getVoices();
  const preferred = browserVoices.find(v =>
          v.lang.startsWith('en') && (
              v.name.includes('Samantha') || v.name.includes('Karen') ||
              v.name.includes('Google US') || v.name.includes('Google UK') ||
              v.name.includes('Microsoft Aria') || v.name.includes('Microsoft Jenny') ||
              v.name.includes('Natural') || (!v.localService && v.lang.startsWith('en'))
          )
  );
  if (preferred && !selectedVoiceId) selectedVoiceId = preferred.voiceURI;
}

if ('speechSynthesis' in window) {
  loadBrowserVoices();
  window.speechSynthesis.onvoiceschanged = loadBrowserVoices;
}

function speakBrowser(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*#🔥💪⚡🎯🏆🏋️]/g, '').replace(/\n/g, ' ').trim();
  if (!clean) return;
  const utterance = new SpeechSynthesisUtterance(clean);
  const voice = selectedVoiceId
      ? browserVoices.find(v => v.voiceURI === selectedVoiceId)
      : (browserVoices.find(v => v.lang.startsWith('en') && !v.localService) ||
          browserVoices.find(v => v.lang.startsWith('en')) || browserVoices[0]);
  if (voice) utterance.voice = voice;
  utterance.rate = 0.92;
  utterance.pitch = 1.05;
  utterance.volume = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ─── SPEAK ENGINE ─────────────────────────────────────────────────────────────
// ONE voice at a time, guaranteed.
// speakSeq increments on every speak() call.
// Pending timeouts are tracked in pendingSpeakTimer and cancelled on each call.
// This kills the setTimeout-based overlap problem completely.
let speakSeq = 0;
let pendingSpeakTimer = null;

function cancelAllSpeech() {
  speakSeq++;
  if (pendingSpeakTimer !== null) {
    clearTimeout(pendingSpeakTimer);
    pendingSpeakTimer = null;
  }
  try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch(e){}
  if (currentTTSAudio) {
    currentTTSAudio.pause();
    try { URL.revokeObjectURL(currentTTSAudio.src); } catch(e){}
    currentTTSAudio = null;
  }
}

async function speak(text) {
  if (!text?.trim()) return;

  // Cancel everything immediately — kills audio AND any pending speak timer
  cancelAllSpeech();
  const mySeq = speakSeq;

  // 250ms debounce via tracked timer (clearTimeout-able)
  await new Promise(resolve => {
    pendingSpeakTimer = setTimeout(() => {
      pendingSpeakTimer = null;
      resolve();
    }, 250);
  });
  if (speakSeq !== mySeq) return;   // another speak() fired during debounce

  const usedAI = await speakWithOpenAI(text, mySeq);
  if (speakSeq !== mySeq) return;   // another speak() fired during fetch
  if (!usedAI) speakBrowser(text);
}

function getVoiceOptions() {
  return browserVoices.filter(v => v.lang.startsWith('en'));
}

// ============================================
// SOUND EFFECTS - Stamp / Smack sounds
// ============================================
function playStampSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Layer 1: low thud
    const buf1 = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const d1 = buf1.getChannelData(0);
    for (let i = 0; i < d1.length; i++) {
      const t = i / ctx.sampleRate;
      d1[i] = Math.exp(-t * 40) * (Math.random() * 2 - 1) * 0.9;
    }
    const src1 = ctx.createBufferSource();
    src1.buffer = buf1;
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(1.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    src1.connect(gain1); gain1.connect(ctx.destination); src1.start();

    // Layer 2: high crack/smack
    const buf2 = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const d2 = buf2.getChannelData(0);
    for (let i = 0; i < d2.length; i++) {
      const t = i / ctx.sampleRate;
      d2[i] = Math.exp(-t * 80) * (Math.random() * 2 - 1);
    }
    const src2 = ctx.createBufferSource();
    src2.buffer = buf2;
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.8, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 800;
    src2.connect(filter); filter.connect(gain2); gain2.connect(ctx.destination); src2.start();
  } catch(e) {}
}

// ============================================
// COMPREHENSIVE WORKOUT DATABASE
// ============================================
const WORKOUTS = {
  loseWeight: {
    loseWeightOnly: [
      { name: 'Burpees', sets: 4, reps: '15', rest: '30 sec', calories: 180, difficulty: 'Hard',
        description: 'Start standing, drop to a squat with hands on floor, kick feet back to plank, do a push-up, jump feet forward, then explosively jump up with arms overhead.',
        tips: 'Keep your core tight throughout. Modify by stepping back instead of jumping if needed.' },
      { name: 'Mountain Climbers', sets: 4, reps: '45 sec', rest: '20 sec', calories: 120, difficulty: 'Medium',
        description: 'Start in plank position. Drive one knee toward your chest, then quickly switch legs in a running motion while keeping your hips low.',
        tips: 'Keep your shoulders over your wrists. Move as fast as you can while maintaining form.' },
      { name: 'Jump Rope (Imaginary)', sets: 5, reps: '1 min', rest: '30 sec', calories: 150, difficulty: 'Easy',
        description: 'Simulate jumping rope by hopping on the balls of your feet while rotating your wrists as if holding a rope.',
        tips: 'Stay light on your feet. Keep jumps small and quick for maximum calorie burn.' },
      { name: 'High Knees', sets: 4, reps: '1 min', rest: '20 sec', calories: 130, difficulty: 'Medium',
        description: 'Run in place while driving your knees up to hip height with each step. Pump your arms for momentum.',
        tips: 'Land softly on the balls of your feet. Keep your core engaged.' },
      { name: 'Jumping Jacks', sets: 4, reps: '50', rest: '20 sec', calories: 100, difficulty: 'Easy',
        description: 'Start with feet together and arms at sides. Jump feet apart while raising arms overhead, then return to start.',
        tips: 'Keep a steady rhythm. Fully extend your arms overhead each rep.' },
      { name: 'Squat Jumps', sets: 4, reps: '20', rest: '30 sec', calories: 140, difficulty: 'Medium',
        description: 'Lower into a squat, then explosively jump as high as possible. Land softly and immediately go into the next squat.',
        tips: 'Push through your heels when jumping. Land with bent knees to absorb impact.' },
      { name: 'Speed Skaters', sets: 4, reps: '30', rest: '25 sec', calories: 110, difficulty: 'Medium',
        description: 'Leap laterally from one foot to the other, swinging your arms and bringing the trailing leg behind you.',
        tips: 'Push off powerfully from each leg. Stay low to engage your glutes more.' },
      { name: 'Tuck Jumps', sets: 3, reps: '12', rest: '45 sec', calories: 95, difficulty: 'Hard',
        description: 'Jump straight up and pull both knees toward your chest at the peak of the jump.',
        tips: 'Use your arms for momentum. Land softly with bent knees.' },
    ],
    fullBody: [
      { name: 'Burpees', sets: 3, reps: '15', rest: '30 sec', calories: 150, difficulty: 'Hard',
        description: 'Start standing, drop to a squat with hands on floor, kick feet back to plank, do a push-up, jump feet forward, then explosively jump up with arms overhead.',
        tips: 'Keep your core tight throughout. Modify by stepping back instead of jumping if needed.' },
      { name: 'Mountain Climbers', sets: 4, reps: '30 sec', rest: '20 sec', calories: 100, difficulty: 'Medium',
        description: 'Start in plank position. Drive one knee toward your chest, then quickly switch legs in a running motion.',
        tips: 'Keep your hips low and shoulders over wrists.' },
      { name: 'Jump Squats', sets: 3, reps: '20', rest: '30 sec', calories: 120, difficulty: 'Medium',
        description: 'Lower into a squat, then explosively jump up. Land softly and repeat.',
        tips: 'Push through your heels and land with bent knees.' },
      { name: 'High Knees', sets: 4, reps: '45 sec', rest: '15 sec', calories: 90, difficulty: 'Easy',
        description: 'Run in place, driving your knees up to hip height with each step.',
        tips: 'Pump your arms and stay on the balls of your feet.' },
      { name: 'Plank Jacks', sets: 3, reps: '20', rest: '30 sec', calories: 80, difficulty: 'Medium',
        description: 'Start in plank, jump feet out wide then back together like a jumping jack.',
        tips: 'Keep your core tight and hips stable.' },
      { name: 'Jumping Lunges', sets: 3, reps: '20', rest: '30 sec', calories: 110, difficulty: 'Hard',
        description: 'Lunge position, jump and switch legs mid-air, land in opposite lunge.',
        tips: 'Keep your front knee behind your toes when landing.' },
    ],
    arms: [
      { name: 'Boxing Punches', sets: 4, reps: '1 min', rest: '30 sec', calories: 100, difficulty: 'Easy',
        description: 'Throw alternating jabs, crosses, hooks, and uppercuts at the air with intensity.',
        tips: 'Rotate your hips with each punch for power. Keep your guard up.' },
      { name: 'Arm Circles', sets: 3, reps: '30 sec each direction', rest: '15 sec', calories: 40, difficulty: 'Easy',
        description: 'Extend arms to sides and make small circles, gradually increasing size.',
        tips: 'Keep your core engaged and shoulders down.' },
      { name: 'Tricep Dips', sets: 3, reps: '15', rest: '30 sec', calories: 60, difficulty: 'Medium',
        description: 'Use a chair or bench. Lower your body by bending elbows to 90 degrees, then press up.',
        tips: 'Keep your back close to the chair. Dont let shoulders shrug.' },
      { name: 'Push-up to Shoulder Tap', sets: 3, reps: '12', rest: '30 sec', calories: 80, difficulty: 'Hard',
        description: 'Do a push-up, then at the top, tap your left shoulder with right hand, then right shoulder with left.',
        tips: 'Keep hips stable during the taps. Widen feet for more balance.' },
      { name: 'Diamond Push-ups', sets: 3, reps: '10', rest: '45 sec', calories: 70, difficulty: 'Hard',
        description: 'Push-up with hands together forming a diamond shape under your chest.',
        tips: 'Keep elbows close to your body as you lower down.' },
      { name: 'Plank Up-Downs', sets: 3, reps: '12', rest: '30 sec', calories: 75, difficulty: 'Medium',
        description: 'Start in forearm plank, press up to high plank one arm at a time, then lower back down.',
        tips: 'Alternate which arm leads. Minimize hip rotation.' },
    ],
    legs: [
      { name: 'Jump Lunges', sets: 4, reps: '20', rest: '30 sec', calories: 130, difficulty: 'Hard',
        description: 'Start in lunge, explosively jump and switch legs mid-air.',
        tips: 'Land softly with bent knees. Use arms for momentum.' },
      { name: 'Squat Jumps', sets: 3, reps: '15', rest: '30 sec', calories: 110, difficulty: 'Medium',
        description: 'Deep squat, then explode upward jumping as high as possible.',
        tips: 'Push through your heels. Land quietly.' },
      { name: 'High Knees', sets: 4, reps: '1 min', rest: '20 sec', calories: 100, difficulty: 'Easy',
        description: 'Run in place with knees driving up to hip height.',
        tips: 'Stay on balls of feet. Pump arms vigorously.' },
      { name: 'Skater Jumps', sets: 3, reps: '20', rest: '30 sec', calories: 90, difficulty: 'Medium',
        description: 'Leap side to side, landing on one foot with the other leg behind.',
        tips: 'Push off powerfully. Stay low for more glute engagement.' },
      { name: 'Wall Sit', sets: 3, reps: '45 sec', rest: '30 sec', calories: 50, difficulty: 'Medium',
        description: 'Back against wall, slide down until thighs are parallel to floor. Hold.',
        tips: 'Keep weight in your heels. Dont let knees go past toes.' },
      { name: 'Calf Raises', sets: 4, reps: '25', rest: '20 sec', calories: 40, difficulty: 'Easy',
        description: 'Rise up onto the balls of your feet, squeezing calves at the top.',
        tips: 'Go slow and controlled. Hold the top for 1 second.' },
    ],
    chest: [
      { name: 'Push-ups', sets: 4, reps: '15', rest: '30 sec', calories: 70, difficulty: 'Medium',
        description: 'Hands shoulder-width apart, lower chest to floor, push back up.',
        tips: 'Keep body in straight line. Elbows at 45-degree angle.' },
      { name: 'Wide Push-ups', sets: 3, reps: '12', rest: '30 sec', calories: 65, difficulty: 'Medium',
        description: 'Push-up with hands wider than shoulder width to target outer chest.',
        tips: 'Go deeper to stretch the chest more.' },
      { name: 'Diamond Push-ups', sets: 3, reps: '10', rest: '30 sec', calories: 60, difficulty: 'Hard',
        description: 'Hands together forming diamond shape, targets inner chest and triceps.',
        tips: 'Keep elbows close to body.' },
      { name: 'Decline Push-ups', sets: 3, reps: '12', rest: '30 sec', calories: 75, difficulty: 'Hard',
        description: 'Feet elevated on chair or step, targets upper chest.',
        tips: 'Keep core tight to prevent sagging.' },
      { name: 'Chest Squeeze Press', sets: 3, reps: '15', rest: '30 sec', calories: 50, difficulty: 'Easy',
        description: 'Press palms together hard in front of chest, push forward and back.',
        tips: 'Squeeze as hard as possible throughout.' },
      { name: 'Explosive Push-ups', sets: 3, reps: '10', rest: '45 sec', calories: 85, difficulty: 'Hard',
        description: 'Push up explosively so hands leave the ground.',
        tips: 'Land with soft elbows to absorb impact.' },
    ],
    back: [
      { name: 'Superman Hold', sets: 4, reps: '30 sec', rest: '20 sec', calories: 40, difficulty: 'Easy',
        description: 'Lie face down, lift arms and legs off ground simultaneously, hold.',
        tips: 'Squeeze glutes and look at the floor to keep neck neutral.' },
      { name: 'Reverse Snow Angels', sets: 3, reps: '15', rest: '30 sec', calories: 45, difficulty: 'Easy',
        description: 'Lying face down, move arms from sides to overhead in arc motion.',
        tips: 'Keep arms elevated throughout the movement.' },
      { name: 'Bird Dogs', sets: 3, reps: '12 each side', rest: '20 sec', calories: 50, difficulty: 'Easy',
        description: 'On all fours, extend opposite arm and leg simultaneously.',
        tips: 'Keep hips level. Move slowly and controlled.' },
      { name: 'Prone Y Raises', sets: 3, reps: '15', rest: '30 sec', calories: 40, difficulty: 'Easy',
        description: 'Lie face down, raise arms in Y shape overhead.',
        tips: 'Squeeze shoulder blades together at the top.' },
      { name: 'Aquaman', sets: 3, reps: '20', rest: '30 sec', calories: 55, difficulty: 'Medium',
        description: 'Like Superman but alternate lifting opposite arm and leg.',
        tips: 'Keep movements controlled, dont swing.' },
      { name: 'Good Mornings', sets: 3, reps: '15', rest: '30 sec', calories: 50, difficulty: 'Medium',
        description: 'Stand with hands behind head, hinge at hips keeping back straight.',
        tips: 'Feel the stretch in your hamstrings. Dont round your back.' },
    ],
    core: [
      { name: 'Bicycle Crunches', sets: 4, reps: '30', rest: '20 sec', calories: 80, difficulty: 'Medium',
        description: 'Lie on back, alternate bringing elbow to opposite knee in cycling motion.',
        tips: 'Really twist and squeeze the obliques. Slow and controlled.' },
      { name: 'Plank', sets: 3, reps: '1 min', rest: '30 sec', calories: 50, difficulty: 'Medium',
        description: 'Hold push-up position on forearms, body in straight line.',
        tips: 'Dont let hips sag or pike up. Breathe steadily.' },
      { name: 'Russian Twists', sets: 3, reps: '30', rest: '30 sec', calories: 70, difficulty: 'Medium',
        description: 'Seated, lean back slightly, rotate torso side to side.',
        tips: 'Lift feet off ground for more challenge. Touch the floor each side.' },
      { name: 'Leg Raises', sets: 3, reps: '15', rest: '30 sec', calories: 60, difficulty: 'Medium',
        description: 'Lie flat, raise legs to 90 degrees then lower slowly.',
        tips: 'Keep lower back pressed into floor. Go slow on the way down.' },
      { name: 'Dead Bug', sets: 3, reps: '12 each side', rest: '20 sec', calories: 45, difficulty: 'Easy',
        description: 'Lie on back, extend opposite arm and leg while keeping core engaged.',
        tips: 'Keep lower back pressed to floor throughout.' },
      { name: 'Flutter Kicks', sets: 3, reps: '40', rest: '25 sec', calories: 65, difficulty: 'Medium',
        description: 'Lie on back, alternate kicking legs up and down rapidly.',
        tips: 'Keep lower back pressed down. Hands under hips if needed.' },
    ],
  },

  gainMuscle: {
    fullBody: [
      { name: 'Squat to Press', sets: 4, reps: '12', rest: '60 sec', calories: 100, difficulty: 'Medium',
        description: 'Hold weights at shoulders, squat down, then as you stand, press weights overhead.',
        tips: 'Keep core tight. Use legs to help drive the press.' },
      { name: 'Deadlift', sets: 4, reps: '10', rest: '90 sec', calories: 120, difficulty: 'Hard',
        description: 'With weights in front of thighs, hinge at hips lowering weights, then stand.',
        tips: 'Keep back flat and weights close to legs. Drive through heels.' },
      { name: 'Pull-ups', sets: 4, reps: '8-10', rest: '60 sec', calories: 80, difficulty: 'Hard',
        description: 'Hang from bar, pull yourself up until chin clears bar.',
        tips: 'Engage lats first. Control the descent.' },
      { name: 'Lunges with Weights', sets: 3, reps: '12 each leg', rest: '60 sec', calories: 90, difficulty: 'Medium',
        description: 'Step forward into lunge while holding weights at sides.',
        tips: 'Keep front knee behind toes. Push through front heel.' },
      { name: 'Renegade Rows', sets: 3, reps: '10 each arm', rest: '60 sec', calories: 85, difficulty: 'Hard',
        description: 'In push-up position with dumbbells, row one weight up while stabilizing.',
        tips: 'Keep hips level. Squeeze shoulder blade at top.' },
      { name: 'Thrusters', sets: 4, reps: '12', rest: '60 sec', calories: 110, difficulty: 'Hard',
        description: 'Front squat into overhead press in one fluid motion.',
        tips: 'Use the momentum from the squat to help the press.' },
    ],
    arms: [
      { name: 'Bicep Curls', sets: 4, reps: '12', rest: '45 sec', calories: 50, difficulty: 'Easy',
        description: 'Stand with dumbbells, curl weights toward shoulders keeping elbows stationary.',
        tips: 'Dont swing. Squeeze biceps at the top.' },
      { name: 'Hammer Curls', sets: 3, reps: '12', rest: '45 sec', calories: 50, difficulty: 'Easy',
        description: 'Curl with palms facing each other throughout the movement.',
        tips: 'Targets brachialis for arm thickness. Keep elbows pinned.' },
      { name: 'Tricep Overhead Extension', sets: 4, reps: '12', rest: '45 sec', calories: 45, difficulty: 'Medium',
        description: 'Hold weight overhead with both hands, lower behind head, extend back up.',
        tips: 'Keep elbows pointing forward and close to head.' },
      { name: 'Skull Crushers', sets: 3, reps: '12', rest: '45 sec', calories: 50, difficulty: 'Medium',
        description: 'Lie down, hold weights above chest, bend elbows to lower weights toward forehead.',
        tips: 'Only forearms move. Keep upper arms vertical.' },
      { name: 'Concentration Curls', sets: 3, reps: '10 each arm', rest: '30 sec', calories: 40, difficulty: 'Easy',
        description: 'Seated, elbow braced against inner thigh, curl weight up.',
        tips: 'Full range of motion. Peak contraction at top.' },
      { name: 'Close Grip Push-ups', sets: 3, reps: '15', rest: '45 sec', calories: 55, difficulty: 'Medium',
        description: 'Push-up with hands close together to target triceps.',
        tips: 'Keep elbows close to body throughout.' },
    ],
    legs: [
      { name: 'Barbell Squats', sets: 5, reps: '8', rest: '90 sec', calories: 130, difficulty: 'Hard',
        description: 'Bar on upper back, squat until thighs parallel or below, stand back up.',
        tips: 'Keep chest up and knees tracking over toes.' },
      { name: 'Romanian Deadlift', sets: 4, reps: '10', rest: '60 sec', calories: 100, difficulty: 'Medium',
        description: 'Slight knee bend, hinge at hips lowering weight along legs.',
        tips: 'Feel stretch in hamstrings. Keep back flat.' },
      { name: 'Leg Press', sets: 4, reps: '12', rest: '60 sec', calories: 110, difficulty: 'Medium',
        description: 'On machine, lower platform by bending knees, press back up.',
        tips: 'Dont lock knees at top. Full range of motion.' },
      { name: 'Walking Lunges', sets: 3, reps: '12 each leg', rest: '60 sec', calories: 90, difficulty: 'Medium',
        description: 'Step forward into lunge, bring back leg through to next lunge.',
        tips: 'Keep torso upright. Drive through front heel.' },
      { name: 'Calf Raises', sets: 4, reps: '15', rest: '30 sec', calories: 40, difficulty: 'Easy',
        description: 'Rise up on balls of feet, squeezing calves at top.',
        tips: 'Full stretch at bottom, pause at top.' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '10 each leg', rest: '60 sec', calories: 85, difficulty: 'Hard',
        description: 'Rear foot elevated, lower into single leg squat.',
        tips: 'Keep front knee behind toes. Chest up.' },
    ],
    chest: [
      { name: 'Bench Press', sets: 4, reps: '10', rest: '90 sec', calories: 80, difficulty: 'Medium',
        description: 'Lie on bench, lower bar to chest, press back up.',
        tips: 'Keep feet flat, squeeze shoulder blades together.' },
      { name: 'Incline Dumbbell Press', sets: 4, reps: '12', rest: '60 sec', calories: 75, difficulty: 'Medium',
        description: 'On incline bench, press dumbbells from chest to overhead.',
        tips: 'Angle targets upper chest. Control the weight.' },
      { name: 'Dumbbell Flyes', sets: 3, reps: '12', rest: '45 sec', calories: 55, difficulty: 'Medium',
        description: 'On bench, arc dumbbells from sides up over chest.',
        tips: 'Keep slight bend in elbows. Feel the stretch.' },
      { name: 'Cable Crossover', sets: 3, reps: '15', rest: '45 sec', calories: 50, difficulty: 'Medium',
        description: 'Standing between cables, bring handles together in front of chest.',
        tips: 'Squeeze chest hard at the center.' },
      { name: 'Decline Push-ups', sets: 3, reps: '15', rest: '45 sec', calories: 60, difficulty: 'Medium',
        description: 'Feet elevated, push-up targets upper chest.',
        tips: 'The higher your feet, the harder it is.' },
      { name: 'Dips', sets: 3, reps: '12', rest: '60 sec', calories: 70, difficulty: 'Hard',
        description: 'On parallel bars, lower body then press back up.',
        tips: 'Lean forward slightly to target chest more.' },
    ],
    back: [
      { name: 'Lat Pulldown', sets: 4, reps: '12', rest: '60 sec', calories: 70, difficulty: 'Medium',
        description: 'Grip wide, pull bar to upper chest while squeezing lats.',
        tips: 'Lean back slightly. Dont swing.' },
      { name: 'Bent Over Rows', sets: 4, reps: '10', rest: '60 sec', calories: 80, difficulty: 'Medium',
        description: 'Hinged at hips, pull weight to lower chest/upper abs.',
        tips: 'Keep back flat. Squeeze shoulder blades.' },
      { name: 'Seated Cable Row', sets: 4, reps: '12', rest: '60 sec', calories: 65, difficulty: 'Medium',
        description: 'Pull cable handle to stomach, squeezing back.',
        tips: 'Keep chest up. Dont round forward.' },
      { name: 'Single Arm Dumbbell Row', sets: 3, reps: '10 each arm', rest: '45 sec', calories: 60, difficulty: 'Medium',
        description: 'One hand on bench, row dumbbell to hip.',
        tips: 'Let arm fully extend. Rotate torso slightly.' },
      { name: 'Face Pulls', sets: 3, reps: '15', rest: '45 sec', calories: 40, difficulty: 'Easy',
        description: 'Pull rope to face, separating hands at end.',
        tips: 'Squeeze rear delts. Keep elbows high.' },
      { name: 'Pull-ups', sets: 4, reps: 'Max', rest: '90 sec', calories: 80, difficulty: 'Hard',
        description: 'Hang from bar, pull yourself up until chin over bar.',
        tips: 'Full range of motion. Engage lats first.' },
    ],
    core: [
      { name: 'Weighted Crunches', sets: 4, reps: '15', rest: '45 sec', calories: 50, difficulty: 'Medium',
        description: 'Hold weight on chest, crunch up squeezing abs.',
        tips: 'Lift shoulders, not just head. Exhale at top.' },
      { name: 'Hanging Leg Raises', sets: 3, reps: '12', rest: '60 sec', calories: 60, difficulty: 'Hard',
        description: 'Hang from bar, raise legs to horizontal or higher.',
        tips: 'Dont swing. Control the descent.' },
      { name: 'Cable Woodchops', sets: 3, reps: '12 each side', rest: '45 sec', calories: 55, difficulty: 'Medium',
        description: 'Pull cable diagonally across body from high to low or vice versa.',
        tips: 'Rotate through core, not just arms.' },
      { name: 'Ab Wheel Rollout', sets: 3, reps: '10', rest: '60 sec', calories: 50, difficulty: 'Hard',
        description: 'Kneel, roll wheel out extending body, roll back.',
        tips: 'Keep core tight. Dont let hips sag.' },
      { name: 'Weighted Plank', sets: 3, reps: '45 sec', rest: '45 sec', calories: 45, difficulty: 'Medium',
        description: 'Standard plank with weight plate on back.',
        tips: 'Keep body straight. Breathe steadily.' },
      { name: 'Pallof Press', sets: 3, reps: '12 each side', rest: '30 sec', calories: 35, difficulty: 'Medium',
        description: 'Stand sideways to cable, press handle straight out resisting rotation.',
        tips: 'Keep hips and shoulders square.' },
    ],
  },

  tone: {
    fullBody: [
      { name: 'Circuit Training', sets: 3, reps: '10 each exercise', rest: '30 sec between rounds', calories: 200, difficulty: 'Medium',
        description: 'Combine 5 exercises: squats, push-ups, lunges, rows, planks. Do all back-to-back.',
        tips: 'Keep rest minimal. Focus on form over speed.' },
      { name: 'Kettlebell Swings', sets: 4, reps: '15', rest: '30 sec', calories: 100, difficulty: 'Medium',
        description: 'Hinge at hips, swing weight between legs then up to chest height.',
        tips: 'Power comes from hips, not arms.' },
      { name: 'Thrusters', sets: 3, reps: '12', rest: '45 sec', calories: 90, difficulty: 'Medium',
        description: 'Front squat directly into overhead press.',
        tips: 'Use squat momentum to help the press.' },
      { name: 'Battle Ropes', sets: 4, reps: '30 sec', rest: '30 sec', calories: 80, difficulty: 'Medium',
        description: 'Create waves with heavy ropes through various patterns.',
        tips: 'Keep core tight. Try different wave patterns.' },
      { name: 'Box Jumps', sets: 3, reps: '10', rest: '45 sec', calories: 70, difficulty: 'Medium',
        description: 'Jump onto a sturdy box or platform, step down.',
        tips: 'Land softly with bent knees. Step down to save joints.' },
      { name: 'Medicine Ball Slams', sets: 3, reps: '15', rest: '30 sec', calories: 85, difficulty: 'Medium',
        description: 'Lift medicine ball overhead, slam it to ground with force.',
        tips: 'Use your whole body. Exhale on the slam.' },
    ],
    arms: [
      { name: 'Resistance Band Curls', sets: 3, reps: '15', rest: '30 sec', calories: 35, difficulty: 'Easy',
        description: 'Stand on band, curl handles toward shoulders.',
        tips: 'Control the negative. Keep elbows stationary.' },
      { name: 'Tricep Kickbacks', sets: 3, reps: '15', rest: '30 sec', calories: 35, difficulty: 'Easy',
        description: 'Bent over, extend forearm back keeping upper arm parallel to floor.',
        tips: 'Squeeze tricep at full extension.' },
      { name: 'Shoulder Press', sets: 3, reps: '12', rest: '45 sec', calories: 45, difficulty: 'Medium',
        description: 'Press dumbbells from shoulders to overhead.',
        tips: 'Keep core tight. Dont arch back.' },
      { name: 'Lateral Raises', sets: 3, reps: '15', rest: '30 sec', calories: 35, difficulty: 'Easy',
        description: 'Raise dumbbells out to sides until parallel to floor.',
        tips: 'Slight bend in elbows. Lead with elbows.' },
      { name: 'Chin-ups', sets: 3, reps: '8', rest: '60 sec', calories: 50, difficulty: 'Hard',
        description: 'Underhand grip pull-up, emphasizes biceps.',
        tips: 'Full range of motion. Control the descent.' },
      { name: 'Arm Circles', sets: 3, reps: '30 sec each way', rest: '15 sec', calories: 25, difficulty: 'Easy',
        description: 'Extended arms, make circles gradually changing size.',
        tips: 'Keep shoulders down. Engage core.' },
    ],
    legs: [
      { name: 'Goblet Squats', sets: 3, reps: '15', rest: '45 sec', calories: 70, difficulty: 'Medium',
        description: 'Hold weight at chest, squat deep.',
        tips: 'Elbows inside knees at bottom. Keep chest up.' },
      { name: 'Step-ups', sets: 3, reps: '12 each leg', rest: '30 sec', calories: 60, difficulty: 'Easy',
        description: 'Step onto bench or platform, drive through heel.',
        tips: 'Dont push off back foot. Let front leg do the work.' },
      { name: 'Glute Bridges', sets: 3, reps: '15', rest: '30 sec', calories: 45, difficulty: 'Easy',
        description: 'Lie on back, drive hips up squeezing glutes.',
        tips: 'Pause at top. Dont hyperextend lower back.' },
      { name: 'Side Lunges', sets: 3, reps: '12 each leg', rest: '30 sec', calories: 55, difficulty: 'Medium',
        description: 'Step wide to side, sit back into that hip.',
        tips: 'Keep trailing leg straight. Push back to start.' },
      { name: 'Single Leg Deadlift', sets: 3, reps: '10 each leg', rest: '45 sec', calories: 50, difficulty: 'Medium',
        description: 'Balance on one leg, hinge forward with weight.',
        tips: 'Keep hips square. Use wall for balance if needed.' },
      { name: 'Curtsy Lunges', sets: 3, reps: '12 each leg', rest: '30 sec', calories: 55, difficulty: 'Medium',
        description: 'Step one leg behind and across, lowering into lunge.',
        tips: 'Keep front knee tracking over toes.' },
    ],
    chest: [
      { name: 'Push-up Variations', sets: 3, reps: '12', rest: '30 sec', calories: 50, difficulty: 'Medium',
        description: 'Alternate between wide, narrow, and standard push-ups.',
        tips: 'Full range of motion on each variation.' },
      { name: 'Dumbbell Chest Press', sets: 3, reps: '12', rest: '45 sec', calories: 55, difficulty: 'Medium',
        description: 'On bench, press dumbbells from chest to overhead.',
        tips: 'Keep shoulder blades squeezed together.' },
      { name: 'Incline Flyes', sets: 3, reps: '15', rest: '30 sec', calories: 45, difficulty: 'Easy',
        description: 'On incline, arc light dumbbells from sides over chest.',
        tips: 'Feel the stretch at bottom.' },
      { name: 'Medicine Ball Push-ups', sets: 3, reps: '10', rest: '45 sec', calories: 55, difficulty: 'Medium',
        description: 'One or both hands on medicine ball for instability.',
        tips: 'Builds stability and strength.' },
      { name: 'Chest Dips', sets: 3, reps: '10', rest: '45 sec', calories: 50, difficulty: 'Medium',
        description: 'On parallel bars, lean forward to target chest.',
        tips: 'Control the descent. Dont go too deep if new.' },
      { name: 'Resistance Band Chest Press', sets: 3, reps: '15', rest: '30 sec', calories: 40, difficulty: 'Easy',
        description: 'Band around back, press handles forward.',
        tips: 'Keep constant tension. Squeeze at full extension.' },
    ],
    back: [
      { name: 'Resistance Band Rows', sets: 3, reps: '15', rest: '30 sec', calories: 40, difficulty: 'Easy',
        description: 'Seated or standing, pull band handles to stomach.',
        tips: 'Squeeze shoulder blades at end.' },
      { name: 'Reverse Flyes', sets: 3, reps: '15', rest: '30 sec', calories: 35, difficulty: 'Easy',
        description: 'Bent over, raise arms out to sides.',
        tips: 'Lead with elbows. Squeeze rear delts.' },
      { name: 'TRX Rows', sets: 3, reps: '12', rest: '45 sec', calories: 50, difficulty: 'Medium',
        description: 'Lean back holding TRX handles, pull yourself up.',
        tips: 'Keep body straight like a plank.' },
      { name: 'Straight Arm Pulldown', sets: 3, reps: '15', rest: '30 sec', calories: 40, difficulty: 'Easy',
        description: 'Arms straight, pull cable down in arc to thighs.',
        tips: 'Feel lats engage. Keep slight bend in elbows.' },
      { name: 'Prone Back Extension', sets: 3, reps: '15', rest: '30 sec', calories: 35, difficulty: 'Easy',
        description: 'Lying face down, lift chest off ground.',
        tips: 'Squeeze glutes. Look at floor to protect neck.' },
      { name: 'Swimming', sets: 3, reps: '30 sec', rest: '20 sec', calories: 40, difficulty: 'Easy',
        description: 'Lie on stomach, alternate lifting opposite arm and leg.',
        tips: 'Keep movements smooth and controlled.' },
    ],
    core: [
      { name: 'Plank Variations', sets: 3, reps: '30 sec each', rest: '20 sec', calories: 50, difficulty: 'Medium',
        description: 'Rotate through front plank, side planks, and reverse plank.',
        tips: 'Keep body straight in each position.' },
      { name: 'Flutter Kicks', sets: 3, reps: '30', rest: '30 sec', calories: 45, difficulty: 'Medium',
        description: 'On back, rapidly alternate leg kicks.',
        tips: 'Keep lower back pressed to floor.' },
      { name: 'Toe Touches', sets: 3, reps: '20', rest: '30 sec', calories: 40, difficulty: 'Easy',
        description: 'Lie on back, legs up, reach for toes.',
        tips: 'Lift shoulders off ground. Exhale reaching up.' },
      { name: 'Mountain Climbers', sets: 3, reps: '30 sec', rest: '30 sec', calories: 60, difficulty: 'Medium',
        description: 'Plank position, drive knees to chest alternating.',
        tips: 'Keep hips down. Move quickly.' },
      { name: 'V-ups', sets: 3, reps: '12', rest: '45 sec', calories: 50, difficulty: 'Hard',
        description: 'Lie flat, simultaneously lift legs and torso to touch toes.',
        tips: 'If too hard, do alternating single leg.' },
      { name: 'Dead Bug', sets: 3, reps: '12 each side', rest: '30 sec', calories: 40, difficulty: 'Easy',
        description: 'On back, extend opposite arm and leg while keeping core engaged.',
        tips: 'Keep lower back pressed to floor.' },
    ],
  },
};

// ── AT-HOME WORKOUTS (no equipment needed) ───────────────────────────────────
const AT_HOME_WORKOUTS = {
  loseWeight: {
    loseWeightOnly: [
      { name: 'Burpee Box', sets: 4, reps: '12', rest: '30 sec', calories: 160, difficulty: 'Hard', description: 'Full burpee to a low box or coffee table — explosive jump at the top.', tips: 'Keep core tight. Modify by stepping instead of jumping.' },
      { name: 'Jump Rope (Invisible)', sets: 5, reps: '1 min', rest: '30 sec', calories: 140, difficulty: 'Easy', description: 'Hop on balls of feet rotating wrists as if holding a rope.', tips: 'Stay light. Small hops burn more calories.' },
      { name: 'Mountain Climbers', sets: 4, reps: '45 sec', rest: '20 sec', calories: 120, difficulty: 'Medium', description: 'High plank, drive knees to chest alternating fast.', tips: 'Keep hips level. Move as fast as form allows.' },
      { name: 'High Knees Sprint', sets: 4, reps: '1 min', rest: '20 sec', calories: 130, difficulty: 'Medium', description: 'Run in place driving knees to hip height.', tips: 'Pump arms hard. Stay on balls of feet.' },
      { name: 'Squat Jumps', sets: 4, reps: '20', rest: '30 sec', calories: 140, difficulty: 'Medium', description: 'Squat deep then explode upward. Land soft.', tips: 'Push through heels. Bend knees on landing.' },
      { name: 'Speed Skaters', sets: 4, reps: '30', rest: '25 sec', calories: 110, difficulty: 'Medium', description: 'Leap side to side landing on one foot, trailing leg behind.', tips: 'Stay low. Push powerfully off each foot.' },
      { name: 'Stair Climbs', sets: 5, reps: '2 min', rest: '30 sec', calories: 150, difficulty: 'Easy', description: 'Walk or run up and down any staircase in your home.', tips: 'For more intensity, skip a step each time.' },
    ],
    fullBody: [
      { name: 'Burpees', sets: 3, reps: '12', rest: '30 sec', calories: 140, difficulty: 'Hard', description: 'Full burpee — plank, push-up, jump.', tips: 'Step back instead of jumping if needed.' },
      { name: 'Push-up Ladder', sets: 4, reps: '10–15', rest: '30 sec', calories: 80, difficulty: 'Medium', description: 'Wide, standard, then diamond push-ups back to back.', tips: 'Full range of motion each rep.' },
      { name: 'Bodyweight Squats', sets: 4, reps: '25', rest: '20 sec', calories: 90, difficulty: 'Easy', description: 'Feet shoulder-width, squat until thighs parallel.', tips: 'Keep chest up. Drive through heels.' },
      { name: 'Chair Dips', sets: 3, reps: '15', rest: '30 sec', calories: 60, difficulty: 'Medium', description: 'Hands on chair edge, lower body bending elbows.', tips: 'Keep back close to chair.' },
      { name: 'Reverse Lunges', sets: 3, reps: '12 each', rest: '30 sec', calories: 80, difficulty: 'Easy', description: 'Step back into lunge, return to stand.', tips: 'Front knee stays over ankle.' },
      { name: 'Superman Hold', sets: 3, reps: '15', rest: '25 sec', calories: 40, difficulty: 'Easy', description: 'Lie face down, lift arms and legs off floor simultaneously.', tips: 'Squeeze glutes. Hold 2 sec at top.' },
    ],
    arms: [
      { name: 'Diamond Push-ups', sets: 4, reps: '10', rest: '45 sec', calories: 70, difficulty: 'Hard', description: 'Hands form diamond under chest — targets triceps hard.', tips: 'Keep elbows close. Lower slowly.' },
      { name: 'Chair Tricep Dips', sets: 3, reps: '15', rest: '30 sec', calories: 60, difficulty: 'Medium', description: 'Use sturdy chair, lower body to 90°.', tips: 'Keep back close to chair edge.' },
      { name: 'Pike Push-ups', sets: 3, reps: '12', rest: '45 sec', calories: 65, difficulty: 'Medium', description: 'Inverted V position, lower head toward floor.', tips: 'Great shoulder and tricep builder.' },
      { name: 'Plank Shoulder Taps', sets: 3, reps: '20', rest: '30 sec', calories: 55, difficulty: 'Medium', description: 'High plank, tap opposite shoulder alternating.', tips: 'Minimize hip rotation.' },
      { name: 'Arm Circles + Pulses', sets: 3, reps: '1 min', rest: '15 sec', calories: 35, difficulty: 'Easy', description: 'Arms out wide, small circles then pulse up and down.', tips: 'Feel the burn. Don\'t drop arms.' },
      { name: 'Clap Push-ups', sets: 3, reps: '8', rest: '60 sec', calories: 75, difficulty: 'Hard', description: 'Explosive push-up, clap hands mid-air.', tips: 'Land softly. Only attempt if standard push-up is easy.' },
    ],
    legs: [
      { name: 'Jump Squats', sets: 4, reps: '20', rest: '30 sec', calories: 120, difficulty: 'Medium', description: 'Squat deep, jump explosively, land soft.', tips: 'Push through heels. Soft landing.' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '12 each', rest: '45 sec', calories: 90, difficulty: 'Hard', description: 'Rear foot on couch, lower front leg to 90°.', tips: 'Keep chest up. Front foot far enough forward.' },
      { name: 'Glute Bridge March', sets: 3, reps: '20', rest: '30 sec', calories: 55, difficulty: 'Easy', description: 'Bridge up, alternately lift knees while holding hips high.', tips: 'Don\'t let hips drop.' },
      { name: 'Lateral Bounds', sets: 3, reps: '20', rest: '30 sec', calories: 80, difficulty: 'Medium', description: 'Jump side to side landing on one foot.', tips: 'Reach opposite hand to foot on landing.' },
      { name: 'Wall Sit', sets: 3, reps: '45 sec', rest: '30 sec', calories: 50, difficulty: 'Medium', description: 'Back flat on wall, thighs parallel — hold.', tips: 'Weight in heels. Don\'t let knees cave.' },
      { name: 'Step-up on Stairs', sets: 3, reps: '15 each', rest: '30 sec', calories: 70, difficulty: 'Easy', description: 'Step up on bottom stair, drive through heel.', tips: 'Lead leg does all the work.' },
    ],
    chest: [
      { name: 'Wide Push-ups', sets: 4, reps: '15', rest: '30 sec', calories: 70, difficulty: 'Medium', description: 'Hands wider than shoulder width — hits outer chest.', tips: 'Elbows flare out slightly.' },
      { name: 'Decline Push-ups', sets: 3, reps: '12', rest: '45 sec', calories: 75, difficulty: 'Hard', description: 'Feet on couch, hands on floor — upper chest focus.', tips: 'Keep body straight.' },
      { name: 'Incline Push-ups', sets: 3, reps: '15', rest: '30 sec', calories: 55, difficulty: 'Easy', description: 'Hands on couch/table — easier angle, lower chest focus.', tips: 'Great for beginners.' },
      { name: 'Push-up Hold + Pulse', sets: 3, reps: '10', rest: '45 sec', calories: 65, difficulty: 'Medium', description: 'Lower to 90° and pulse 3x before pushing up.', tips: 'Time under tension builds muscle.' },
      { name: 'Archer Push-ups', sets: 3, reps: '8 each', rest: '45 sec', calories: 80, difficulty: 'Hard', description: 'Wide push-up shifting weight to one arm at a time.', tips: 'Extended arm stays straight.' },
      { name: 'T Push-ups', sets: 3, reps: '10', rest: '45 sec', calories: 70, difficulty: 'Medium', description: 'Push-up, rotate into side plank raising one arm.', tips: 'Core stays tight throughout rotation.' },
    ],
    back: [
      { name: 'Superman Lifts', sets: 4, reps: '15', rest: '25 sec', calories: 40, difficulty: 'Easy', description: 'Lie face down, lift arms and legs off ground.', tips: 'Squeeze glutes. 2 sec hold at top.' },
      { name: 'Towel Rows', sets: 3, reps: '12', rest: '30 sec', calories: 50, difficulty: 'Medium', description: 'Loop a towel around a door handle, lean back and row.', tips: 'Keep elbows close to body.' },
      { name: 'Bird Dog', sets: 3, reps: '12 each', rest: '25 sec', calories: 35, difficulty: 'Easy', description: 'On all fours, extend opposite arm and leg.', tips: 'Keep hips square. Slow and controlled.' },
      { name: 'Reverse Snow Angels', sets: 3, reps: '15', rest: '25 sec', calories: 35, difficulty: 'Easy', description: 'Face down, sweep arms like snow angels.', tips: 'Keep arms off floor throughout.' },
      { name: 'Door Frame Rows', sets: 3, reps: '10', rest: '45 sec', calories: 55, difficulty: 'Medium', description: 'Hold door frame at chest height, lean back, pull yourself in.', tips: 'Keep feet close to door.' },
      { name: 'Table Inverted Row', sets: 3, reps: '10', rest: '45 sec', calories: 60, difficulty: 'Medium', description: 'Lie under a sturdy table, grip edge and pull chest up.', tips: 'Keep body straight as a plank.' },
    ],
    abs: [
      { name: 'Crunches', sets: 4, reps: '25', rest: '20 sec', calories: 40, difficulty: 'Easy', description: 'Lie on back, curl upper body toward knees.', tips: 'Exhale on the way up. Don\'t pull neck.' },
      { name: 'Bicycle Crunches', sets: 3, reps: '30', rest: '25 sec', calories: 50, difficulty: 'Medium', description: 'Alternating elbow to opposite knee with twisting motion.', tips: 'Slow and controlled. Feel the obliques.' },
      { name: 'Leg Raises', sets: 3, reps: '15', rest: '30 sec', calories: 45, difficulty: 'Medium', description: 'Lie flat, raise straight legs to 90° then lower.', tips: 'Press lower back to floor.' },
      { name: 'Plank Hold', sets: 3, reps: '45 sec', rest: '20 sec', calories: 50, difficulty: 'Medium', description: 'Forearm plank, body straight as a board.', tips: 'Squeeze every muscle. Breathe.' },
      { name: 'Russian Twists', sets: 3, reps: '20', rest: '25 sec', calories: 45, difficulty: 'Medium', description: 'Seated, lean back 45°, rotate torso side to side.', tips: 'Use water bottle as weight for more challenge.' },
      { name: 'Dead Bug', sets: 3, reps: '12 each', rest: '25 sec', calories: 35, difficulty: 'Easy', description: 'On back, extend opposite arm and leg while keeping lower back flat.', tips: 'Exhale as you extend. Core stays braced.' },
    ],
  },
  buildMuscle: {
    fullBody: [
      { name: 'Push-up to Failure', sets: 4, reps: 'Max', rest: '60 sec', calories: 90, difficulty: 'Hard', description: 'Standard push-up, go until you cannot do another rep.', tips: 'Maintain perfect form even when tired.' },
      { name: 'Pistol Squat Assist', sets: 3, reps: '8 each', rest: '60 sec', calories: 80, difficulty: 'Hard', description: 'Single-leg squat holding door frame for balance.', tips: 'Lower as far as you can control.' },
      { name: 'Inverted Row (Table)', sets: 3, reps: '12', rest: '60 sec', calories: 65, difficulty: 'Medium', description: 'Under sturdy table, pull chest to edge.', tips: 'Keep body rigid as a plank.' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '10 each', rest: '60 sec', calories: 85, difficulty: 'Hard', description: 'Rear foot on couch, front leg bears weight.', tips: 'Add weight with backpack for progression.' },
      { name: 'Pike Push-up', sets: 3, reps: '12', rest: '45 sec', calories: 65, difficulty: 'Medium', description: 'Inverted V shape, lower head toward floor.', tips: 'Builds shoulders like overhead press.' },
      { name: 'L-Sit Tuck Hold', sets: 3, reps: '20 sec', rest: '40 sec', calories: 50, difficulty: 'Hard', description: 'On two chairs, lift knees to chest and hold.', tips: 'Shoulders down. Core tight.' },
    ],
    arms: [
      { name: 'Diamond Push-ups', sets: 4, reps: '12', rest: '60 sec', calories: 75, difficulty: 'Hard', description: 'Hands form diamond, elbows stay close — tricep focus.', tips: 'Slow 3-second lowering phase.' },
      { name: 'Chair Dips Weighted', sets: 3, reps: '15', rest: '60 sec', calories: 70, difficulty: 'Hard', description: 'Chair dips with book bag on lap for extra resistance.', tips: 'Full extension at top.' },
      { name: 'Negative Push-ups', sets: 3, reps: '8', rest: '60 sec', calories: 70, difficulty: 'Hard', description: 'Take 5 seconds to lower to floor, push up normally.', tips: 'The lowering builds serious strength.' },
      { name: 'Commando Push-ups', sets: 3, reps: '10', rest: '45 sec', calories: 75, difficulty: 'Hard', description: 'Down to forearms one arm at a time, press back up.', tips: 'Alternate which arm leads each rep.' },
      { name: 'Pike Push-ups', sets: 3, reps: '15', rest: '45 sec', calories: 65, difficulty: 'Medium', description: 'Inverted V, lower nose toward floor.', tips: 'Wide hands for more shoulder work.' },
      { name: 'Plank Shoulder Circles', sets: 3, reps: '30 sec', rest: '30 sec', calories: 45, difficulty: 'Medium', description: 'High plank, draw circles with each shoulder alternating.', tips: 'Minimise hip rotation.' },
    ],
    legs: [
      { name: 'Pistol Squat Negatives', sets: 3, reps: '8 each', rest: '60 sec', calories: 85, difficulty: 'Hard', description: 'Slowly lower on one leg, use both to stand.', tips: 'Hold wall for balance until strong enough.' },
      { name: 'Jump Lunges', sets: 4, reps: '16', rest: '45 sec', calories: 110, difficulty: 'Hard', description: 'Explosive lunge switching legs mid-air.', tips: 'Soft landing. Knees track over toes.' },
      { name: 'Wall Squat Pulses', sets: 3, reps: '30 sec', rest: '30 sec', calories: 60, difficulty: 'Medium', description: 'Wall sit, pulse 3 inches up and down.', tips: 'Burn out those quads.' },
      { name: 'Nordic Hamstring Curl', sets: 3, reps: '8', rest: '60 sec', calories: 60, difficulty: 'Hard', description: 'Kneel, secure feet under couch, lower upper body slowly.', tips: 'Use hands to catch yourself. Hardest bodyweight exercise.' },
      { name: 'Calf Raise Isometric', sets: 3, reps: '45 sec', rest: '20 sec', calories: 35, difficulty: 'Easy', description: 'Rise to toes and hold for 45 seconds.', tips: 'Feel the burn in calves and Achilles.' },
      { name: 'Reverse Nordic', sets: 3, reps: '10', rest: '60 sec', calories: 55, difficulty: 'Hard', description: 'Kneel tall, lean back keeping body straight, return.', tips: 'Insane quad builder with no equipment.' },
    ],
    chest: [
      { name: 'Archer Push-ups', sets: 4, reps: '8 each', rest: '60 sec', calories: 85, difficulty: 'Hard', description: 'Wide push-up, shift weight to one arm at a time.', tips: 'Extended arm stays straight. Work toward one-arm.' },
      { name: 'Decline Push-ups', sets: 4, reps: '15', rest: '45 sec', calories: 80, difficulty: 'Hard', description: 'Feet elevated on couch or stairs — upper chest blast.', tips: 'Full range. Control the descent.' },
      { name: 'Explosive Push-ups', sets: 3, reps: '10', rest: '60 sec', calories: 90, difficulty: 'Hard', description: 'Push up so hard hands leave the floor.', tips: 'Land softly. Builds explosive power.' },
      { name: 'Slow Eccentric Push-up', sets: 3, reps: '8', rest: '60 sec', calories: 70, difficulty: 'Medium', description: '5-second lowering phase, explosive up.', tips: 'Time under tension = growth.' },
      { name: 'Wide to Narrow Push-up', sets: 3, reps: '12', rest: '45 sec', calories: 75, difficulty: 'Medium', description: 'Start wide, walk hands in to narrow, push up, repeat.', tips: 'Hits every angle of the chest.' },
      { name: 'Push-up Negatives', sets: 3, reps: '6', rest: '60 sec', calories: 65, difficulty: 'Hard', description: 'Lower in 10 seconds. Rest, push to top.', tips: 'Best chest builder without weights.' },
    ],
    back: [
      { name: 'Towel Row', sets: 4, reps: '12', rest: '60 sec', calories: 55, difficulty: 'Medium', description: 'Towel looped around door handle, lean back and row.', tips: 'Squeeze shoulder blades at top.' },
      { name: 'Table Inverted Row', sets: 4, reps: '12', rest: '60 sec', calories: 65, difficulty: 'Medium', description: 'Lie under table, grip edge, pull chest to it.', tips: 'Elevate feet on chair to increase difficulty.' },
      { name: 'Superman Holds', sets: 3, reps: '12', rest: '30 sec', calories: 40, difficulty: 'Easy', description: 'Face down, lift everything, hold 3 sec.', tips: 'Really squeeze at top.' },
      { name: 'Door Frame Pull-in', sets: 3, reps: '10', rest: '45 sec', calories: 55, difficulty: 'Medium', description: 'Grip door frame, lean back, pull chest in.', tips: 'Keep elbows pointing back.' },
      { name: 'Y-T-W Raises', sets: 3, reps: '15 each', rest: '30 sec', calories: 35, difficulty: 'Easy', description: 'Face down, raise arms in Y, T, then W shapes.', tips: 'Great rear delt and trap builder.' },
      { name: 'Resistance Band Rows', sets: 3, reps: '15', rest: '30 sec', calories: 45, difficulty: 'Easy', description: 'Band around door or feet, row to stomach.', tips: 'Add any elastic band — hair ties count!' },
    ],
    abs: [
      { name: 'Dragon Flag Tuck', sets: 3, reps: '8', rest: '60 sec', calories: 65, difficulty: 'Hard', description: 'Lie on bench/floor, raise and lower body on shoulders.', tips: 'Tuck knees first, extend legs as you get stronger.' },
      { name: 'V-ups', sets: 4, reps: '15', rest: '30 sec', calories: 55, difficulty: 'Hard', description: 'Flat on floor, simultaneously raise legs and torso.', tips: 'Touch toes at the top.' },
      { name: 'Hollow Body Hold', sets: 3, reps: '30 sec', rest: '30 sec', calories: 45, difficulty: 'Hard', description: 'Arch arms back, press lower back flat, hold position.', tips: 'Foundation of gymnastics strength.' },
      { name: 'Ab Wheel Sub (Book)', sets: 3, reps: '10', rest: '45 sec', calories: 60, difficulty: 'Hard', description: 'Use a book on hard floor, roll out from knees.', tips: 'Keep hips from sagging.' },
      { name: 'Plank Variants', sets: 3, reps: '45 sec each', rest: '20 sec', calories: 55, difficulty: 'Medium', description: 'Rotate: front, left side, right side plank.', tips: 'Full tension through whole body.' },
      { name: 'Seated Leg Tucks', sets: 3, reps: '20', rest: '30 sec', calories: 50, difficulty: 'Medium', description: 'Sit on floor, lean back, bring knees to chest.', tips: 'Use chair edge for more range.' },
    ],
  },
  tone: {
    fullBody: [
      { name: 'Full Body Circuit', sets: 3, reps: '12 each', rest: '30 sec', calories: 120, difficulty: 'Medium', description: 'Push-up → squat → reverse lunge → plank (30 sec) — no rest between moves.', tips: 'Quality over speed.' },
      { name: 'Pilates 100s', sets: 2, reps: '100 pumps', rest: '30 sec', calories: 40, difficulty: 'Medium', description: 'Lie on back, legs at 45°, pump arms 100 times breathing deeply.', tips: 'Press lower back to floor.' },
      { name: 'Sun Salutation Flow', sets: 3, reps: '5 cycles', rest: '30 sec', calories: 55, difficulty: 'Easy', description: 'Standing → forward fold → plank → cobra → down dog → repeat.', tips: 'Breathe with every movement.' },
      { name: 'Banded Clamshells', sets: 3, reps: '20 each', rest: '20 sec', calories: 30, difficulty: 'Easy', description: 'Lie on side, knees bent, open top knee like a clamshell.', tips: 'Use resistance band or just body weight.' },
      { name: 'Side Plank Hip Dips', sets: 3, reps: '15 each', rest: '25 sec', calories: 45, difficulty: 'Medium', description: 'Side plank, drop hip to floor and lift back up.', tips: 'Keep body aligned. Don\'t rush.' },
      { name: 'Cat-Cow Flow', sets: 3, reps: '15', rest: '15 sec', calories: 25, difficulty: 'Easy', description: 'On all fours, arch and round spine alternating.', tips: 'Slow and fluid. Great for spine mobility.' },
    ],
    arms: [
      { name: 'Water Bottle Curls', sets: 3, reps: '20', rest: '20 sec', calories: 35, difficulty: 'Easy', description: 'Use full water bottles as dumbbells for bicep curls.', tips: 'Slow and squeeze at top.' },
      { name: 'Lateral Raise Hold', sets: 3, reps: '15 + 30 sec hold', rest: '30 sec', calories: 30, difficulty: 'Easy', description: 'Raise arms to shoulder height, hold last rep 30 sec.', tips: 'Keep arms slightly bent.' },
      { name: 'Tricep Kickback (Bag)', sets: 3, reps: '15', rest: '25 sec', calories: 35, difficulty: 'Easy', description: 'Use a bag with books. Hinge forward, kick arm back.', tips: 'Elbow stays high.' },
      { name: 'Push-up Plank Hold', sets: 3, reps: '30 sec', rest: '30 sec', calories: 40, difficulty: 'Medium', description: 'Hold the bottom of a push-up at 90°.', tips: 'Incredible shoulder and arm toner.' },
      { name: 'Wrist Circles + Flex', sets: 2, reps: '1 min', rest: '10 sec', calories: 15, difficulty: 'Easy', description: 'Rotate wrists both ways, flex and extend fully.', tips: 'Great warmup and wrist health.' },
      { name: 'Chair Dips', sets: 3, reps: '15', rest: '30 sec', calories: 55, difficulty: 'Medium', description: 'Sturdy chair, lower body bending elbows to 90°.', tips: 'Keep back close to chair edge.' },
    ],
    legs: [
      { name: 'Sumo Squat Pulses', sets: 3, reps: '30', rest: '20 sec', calories: 60, difficulty: 'Easy', description: 'Wide stance, toes out, squat and pulse small range.', tips: 'Stay low for constant tension.' },
      { name: 'Donkey Kicks', sets: 3, reps: '20 each', rest: '20 sec', calories: 40, difficulty: 'Easy', description: 'On all fours, kick one leg back and up.', tips: 'Squeeze glute at top. Keep hips square.' },
      { name: 'Fire Hydrants', sets: 3, reps: '20 each', rest: '20 sec', calories: 35, difficulty: 'Easy', description: 'On all fours, lift one knee out to the side.', tips: 'Shapes the outer glute beautifully.' },
      { name: 'Glute Bridge Pulses', sets: 3, reps: '30', rest: '25 sec', calories: 45, difficulty: 'Easy', description: 'Hips up in bridge, pulse 3 inches up and down.', tips: 'Squeeze hard at top of every pulse.' },
      { name: 'Inner Thigh Squeeze', sets: 3, reps: '20', rest: '20 sec', calories: 30, difficulty: 'Easy', description: 'Lie on back, pillow between knees, squeeze and hold.', tips: '2-second squeeze each rep.' },
      { name: 'Standing Leg Circles', sets: 2, reps: '20 each direction', rest: '15 sec', calories: 25, difficulty: 'Easy', description: 'Stand on one leg, draw circles with the other.', tips: 'Improves hip mobility and balance.' },
    ],
    chest: [
      { name: 'Incline Push-ups', sets: 3, reps: '15', rest: '30 sec', calories: 50, difficulty: 'Easy', description: 'Hands on couch, angled push-up. Lower chest focus.', tips: 'Great for beginners. Full range of motion.' },
      { name: 'Push-up with Pause', sets: 3, reps: '12', rest: '35 sec', calories: 60, difficulty: 'Medium', description: 'Lower, pause 2 sec at bottom, press up.', tips: 'Eliminates momentum. True strength.' },
      { name: 'Wall Push-ups', sets: 3, reps: '20', rest: '20 sec', calories: 30, difficulty: 'Easy', description: 'Standing, push against wall. Great starting point.', tips: 'Step further back to increase difficulty.' },
      { name: 'Chest Squeeze (Book)', sets: 3, reps: '15', rest: '25 sec', calories: 25, difficulty: 'Easy', description: 'Hold a book between palms, squeeze and press out.', tips: 'Isometric squeeze at center = inner chest.' },
      { name: 'Prayer Pulse', sets: 3, reps: '30', rest: '20 sec', calories: 20, difficulty: 'Easy', description: 'Palms together at chest, press hard and pulse.', tips: 'Surprisingly effective toning move.' },
      { name: 'Floor Flyes', sets: 3, reps: '15', rest: '30 sec', calories: 40, difficulty: 'Easy', description: 'Lie on floor, arms open wide with slight bend, bring together.', tips: 'Use cans of food as light weights.' },
    ],
    back: [
      { name: 'Superman Pulses', sets: 3, reps: '20', rest: '25 sec', calories: 35, difficulty: 'Easy', description: 'Face down, small quick lifts of arms and legs.', tips: 'Keep neck neutral. Feel upper back.' },
      { name: 'Towel Pull-apart', sets: 3, reps: '20', rest: '20 sec', calories: 25, difficulty: 'Easy', description: 'Hold towel wide, pull apart with both hands.', tips: 'Squeezes rear delts and rhomboids.' },
      { name: 'Good Mornings', sets: 3, reps: '15', rest: '25 sec', calories: 35, difficulty: 'Easy', description: 'Hands behind head, hinge at hips keeping back flat.', tips: 'Feel the stretch in hamstrings.' },
      { name: 'Bird Dog Hold', sets: 3, reps: '10 each', rest: '25 sec', calories: 30, difficulty: 'Easy', description: 'Opposite arm and leg extended, hold 3 sec.', tips: 'Level hips. Slow and controlled.' },
      { name: 'Resistance Band Pull-apart', sets: 3, reps: '20', rest: '20 sec', calories: 30, difficulty: 'Easy', description: 'Hold band wide, pull to chest width.', tips: 'Scapular health gold.' },
      { name: 'Cat-Cow + Thread Needle', sets: 2, reps: '10 each', rest: '15 sec', calories: 20, difficulty: 'Easy', description: 'Cat-cow flow, add threading one arm under body.', tips: 'Great thoracic mobility.' },
    ],
    abs: [
      { name: 'Crunches', sets: 3, reps: '25', rest: '20 sec', calories: 35, difficulty: 'Easy', description: 'Standard crunch — exhale on the way up.', tips: 'Don\'t pull neck. Hands lightly behind ears.' },
      { name: 'Side Plank Hip Lifts', sets: 3, reps: '15 each', rest: '25 sec', calories: 40, difficulty: 'Medium', description: 'Side plank, dip hip and lift.', tips: 'Oblique toner. Keep top hip stacked.' },
      { name: 'Scissor Kicks', sets: 3, reps: '30', rest: '25 sec', calories: 40, difficulty: 'Easy', description: 'On back, alternate legs crossing in an X pattern.', tips: 'Keep lower back flat on floor.' },
      { name: 'Plank to Downdog', sets: 3, reps: '12', rest: '25 sec', calories: 45, difficulty: 'Medium', description: 'High plank, push hips back and up to down dog, return.', tips: 'Breathe through each transition.' },
      { name: 'Seated Oblique Twists', sets: 3, reps: '20', rest: '20 sec', calories: 35, difficulty: 'Easy', description: 'Sit on floor, lean back, rotate side to side.', tips: 'Hold water bottle for extra challenge.' },
      { name: 'Hollow Body Rock', sets: 3, reps: '30 sec', rest: '30 sec', calories: 45, difficulty: 'Medium', description: 'Hollow body position, rock forward and back.', tips: 'Keep lower back imprinted on floor.' },
    ],
  },
};

// Bonus workout suggestions
const BONUS_WORKOUTS = [
  { name: '5-Minute Finisher: Burpee Challenge', exercises: '10 burpees, rest 30 sec, repeat 3x', calories: 100, description: 'Quick intense finisher to maximize calorie burn' },
  { name: 'Tabata Blast', exercises: '20 sec work / 10 sec rest x 8 rounds of jump squats', calories: 80, description: 'High-intensity interval training for metabolism boost' },
  { name: 'Core Burnout', exercises: 'Plank 1 min, bicycle crunches 30, leg raises 15', calories: 60, description: 'Finish with a strong core blast' },
  { name: 'Cardio Kickstart', exercises: 'Jumping jacks 50, high knees 1 min, mountain climbers 30', calories: 90, description: 'Get your heart rate up one more time' },
  { name: 'Arm Burnout', exercises: 'Push-ups to failure, arm circles 1 min, tricep dips 15', calories: 50, description: 'Finish your arms completely' },
  { name: 'Leg Finisher', exercises: 'Wall sit 1 min, jump squats 20, calf raises 30', calories: 70, description: 'Leave nothing in the tank for legs' },
];

// Body part options
const BODY_PARTS = [
  { id: 'loseWeightOnly', name: 'Lose Weight Only', icon: '🔥', description: 'Maximum calorie burning cardio-focused workout' },
  { id: 'fullBody', name: 'Full Body', icon: '🏋️', description: 'Complete workout targeting all muscle groups' },
  { id: 'arms', name: 'Arms', icon: '💪', description: 'Biceps, triceps, and forearms' },
  { id: 'legs', name: 'Legs', icon: '🦵', description: 'Quads, hamstrings, calves, and glutes' },
  { id: 'chest', name: 'Chest', icon: '🫁', description: 'Pectorals and front shoulders' },
  { id: 'back', name: 'Back', icon: '🔙', description: 'Lats, traps, and lower back' },
  { id: 'core', name: 'Core', icon: '🎯', description: 'Abs, obliques, and lower back' },
];

// Goal options
const GOALS = [
  { id: 'loseWeight', name: 'Lose Weight', icon: '🔥', description: 'Burn fat and improve cardio', color: '#e74c3c' },
  { id: 'gainMuscle', name: 'Build Muscle', icon: '💪', description: 'Increase strength and size', color: '#3498db' },
  { id: 'tone', name: 'Tone & Maintain', icon: '✨', description: 'Stay fit and defined', color: '#2ecc71' },
];

// ============================================
// AI CHATBOT - COMPREHENSIVE RESPONSES
// ============================================

// ── YOUTUBE EXERCISE SEARCH LINKS ─────────────────────────────────────────────
// Maps exercise names to curated YouTube search queries
const YOUTUBE_LINKS = {
  'Push-ups':                    'https://www.youtube.com/results?search_query=push+up+proper+form+tutorial',
  'Wide Push-ups':               'https://www.youtube.com/results?search_query=wide+grip+push+up+form',
  'Diamond Push-ups':            'https://www.youtube.com/results?search_query=diamond+push+up+tutorial',
  'Decline Push-ups':            'https://www.youtube.com/results?search_query=decline+push+up+form',
  'Explosive Push-ups':          'https://www.youtube.com/results?search_query=explosive+push+up+tutorial',
  'Medicine Ball Push-ups':      'https://www.youtube.com/results?search_query=medicine+ball+push+up',
  'Close Grip Push-ups':         'https://www.youtube.com/results?search_query=close+grip+push+up+triceps',
  'Push-up to Shoulder Tap':     'https://www.youtube.com/results?search_query=push+up+shoulder+tap+form',
  'Push-up Variations':          'https://www.youtube.com/results?search_query=push+up+variations+tutorial',
  'Squat Jumps':                 'https://www.youtube.com/results?search_query=squat+jumps+form+tutorial',
  'Jump Squats':                 'https://www.youtube.com/results?search_query=jump+squat+proper+form',
  'Barbell Squats':              'https://www.youtube.com/results?search_query=barbell+squat+proper+form',
  'Goblet Squats':               'https://www.youtube.com/results?search_query=goblet+squat+tutorial',
  'Bulgarian Split Squat':       'https://www.youtube.com/results?search_query=bulgarian+split+squat+form',
  'Squat to Press':              'https://www.youtube.com/results?search_query=squat+to+press+thruster+tutorial',
  'Bench Press':                 'https://www.youtube.com/results?search_query=bench+press+proper+form',
  'Dumbbell Chest Press':        'https://www.youtube.com/results?search_query=dumbbell+chest+press+form',
  'Incline Dumbbell Press':      'https://www.youtube.com/results?search_query=incline+dumbbell+press+tutorial',
  'Dumbbell Flyes':              'https://www.youtube.com/results?search_query=dumbbell+chest+fly+form',
  'Incline Flyes':               'https://www.youtube.com/results?search_query=incline+dumbbell+fly+tutorial',
  'Cable Crossover':             'https://www.youtube.com/results?search_query=cable+crossover+chest+form',
  'Chest Dips':                  'https://www.youtube.com/results?search_query=chest+dips+tutorial',
  'Chest Squeeze Press':         'https://www.youtube.com/results?search_query=chest+squeeze+press+dumbbell',
  'Resistance Band Chest Press': 'https://www.youtube.com/results?search_query=resistance+band+chest+press',
  'Bicep Curls':                 'https://www.youtube.com/results?search_query=bicep+curl+proper+form',
  'Hammer Curls':                'https://www.youtube.com/results?search_query=hammer+curl+tutorial',
  'Concentration Curls':         'https://www.youtube.com/results?search_query=concentration+curl+form',
  'Resistance Band Curls':       'https://www.youtube.com/results?search_query=resistance+band+bicep+curl',
  'Chin-ups':                    'https://www.youtube.com/results?search_query=chin+up+proper+form',
  'Tricep Dips':                 'https://www.youtube.com/results?search_query=tricep+dips+proper+form',
  'Tricep Kickbacks':            'https://www.youtube.com/results?search_query=tricep+kickback+form',
  'Tricep Overhead Extension':   'https://www.youtube.com/results?search_query=tricep+overhead+extension+form',
  'Skull Crushers':              'https://www.youtube.com/results?search_query=skull+crushers+tricep+form',
  'Dips':                        'https://www.youtube.com/results?search_query=dips+proper+form+tutorial',
  'Shoulder Press':              'https://www.youtube.com/results?search_query=overhead+shoulder+press+form',
  'Lateral Raises':              'https://www.youtube.com/results?search_query=lateral+raise+proper+form',
  'Face Pulls':                  'https://www.youtube.com/results?search_query=face+pull+rear+delt+tutorial',
  'Reverse Flyes':               'https://www.youtube.com/results?search_query=reverse+dumbbell+fly+rear+delt',
  'Arm Circles':                 'https://www.youtube.com/results?search_query=arm+circles+warm+up',
  'Lunges with Weights':         'https://www.youtube.com/results?search_query=weighted+lunges+proper+form',
  'Walking Lunges':              'https://www.youtube.com/results?search_query=walking+lunges+form',
  'Jump Lunges':                 'https://www.youtube.com/results?search_query=jump+lunges+tutorial',
  'Jumping Lunges':              'https://www.youtube.com/results?search_query=jumping+lunges+form',
  'Curtsy Lunges':               'https://www.youtube.com/results?search_query=curtsy+lunge+tutorial',
  'Side Lunges':                 'https://www.youtube.com/results?search_query=side+lunge+form+tutorial',
  'Leg Press':                   'https://www.youtube.com/results?search_query=leg+press+proper+form',
  'Romanian Deadlift':           'https://www.youtube.com/results?search_query=romanian+deadlift+proper+form',
  'Single Leg Deadlift':         'https://www.youtube.com/results?search_query=single+leg+deadlift+form',
  'Deadlift':                    'https://www.youtube.com/results?search_query=deadlift+proper+form+tutorial',
  'Glute Bridges':               'https://www.youtube.com/results?search_query=glute+bridge+form+tutorial',
  'Step-ups':                    'https://www.youtube.com/results?search_query=step+up+exercise+form',
  'Calf Raises':                 'https://www.youtube.com/results?search_query=calf+raises+proper+form',
  'Wall Sit':                    'https://www.youtube.com/results?search_query=wall+sit+tutorial',
  'Box Jumps':                   'https://www.youtube.com/results?search_query=box+jump+proper+form',
  'Plank':                       'https://www.youtube.com/results?search_query=plank+proper+form+tutorial',
  'Plank Variations':            'https://www.youtube.com/results?search_query=plank+variations+core',
  'Plank Jacks':                 'https://www.youtube.com/results?search_query=plank+jacks+tutorial',
  'Plank Up-Downs':              'https://www.youtube.com/results?search_query=plank+up+downs+form',
  'Weighted Plank':              'https://www.youtube.com/results?search_query=weighted+plank+tutorial',
  'Mountain Climbers':           'https://www.youtube.com/results?search_query=mountain+climbers+proper+form',
  'Russian Twists':              'https://www.youtube.com/results?search_query=russian+twist+abs+tutorial',
  'Bicycle Crunches':            'https://www.youtube.com/results?search_query=bicycle+crunch+proper+form',
  'V-ups':                       'https://www.youtube.com/results?search_query=v+up+abs+tutorial',
  'Leg Raises':                  'https://www.youtube.com/results?search_query=leg+raises+abs+form',
  'Hanging Leg Raises':          'https://www.youtube.com/results?search_query=hanging+leg+raises+form',
  'Flutter Kicks':               'https://www.youtube.com/results?search_query=flutter+kicks+abs',
  'Toe Touches':                 'https://www.youtube.com/results?search_query=toe+touch+crunches+abs',
  'Dead Bug':                    'https://www.youtube.com/results?search_query=dead+bug+exercise+tutorial',
  'Ab Wheel Rollout':            'https://www.youtube.com/results?search_query=ab+wheel+rollout+form',
  'Weighted Crunches':           'https://www.youtube.com/results?search_query=weighted+crunches+form',
  'Cable Woodchops':             'https://www.youtube.com/results?search_query=cable+woodchop+core',
  'Pallof Press':                'https://www.youtube.com/results?search_query=pallof+press+core+stability',
  'Bird Dogs':                   'https://www.youtube.com/results?search_query=bird+dog+exercise+form',
  'Pull-ups':                    'https://www.youtube.com/results?search_query=pull+up+proper+form',
  'Lat Pulldown':                'https://www.youtube.com/results?search_query=lat+pulldown+proper+form',
  'Bent Over Rows':              'https://www.youtube.com/results?search_query=bent+over+row+proper+form',
  'Single Arm Dumbbell Row':     'https://www.youtube.com/results?search_query=single+arm+dumbbell+row+form',
  'Seated Cable Row':            'https://www.youtube.com/results?search_query=seated+cable+row+form',
  'TRX Rows':                    'https://www.youtube.com/results?search_query=TRX+row+tutorial',
  'Renegade Rows':               'https://www.youtube.com/results?search_query=renegade+row+form',
  'Resistance Band Rows':        'https://www.youtube.com/results?search_query=resistance+band+row+tutorial',
  'Straight Arm Pulldown':       'https://www.youtube.com/results?search_query=straight+arm+pulldown+lats',
  'Face Pulls':                  'https://www.youtube.com/results?search_query=face+pull+cable+form',
  'Prone Back Extension':        'https://www.youtube.com/results?search_query=prone+back+extension+form',
  'Aquaman':                     'https://www.youtube.com/results?search_query=aquaman+back+exercise',
  'Bird Dogs':                   'https://www.youtube.com/results?search_query=bird+dog+back+core',
  'Good Mornings':               'https://www.youtube.com/results?search_query=good+mornings+exercise+form',
  'Reverse Snow Angels':         'https://www.youtube.com/results?search_query=reverse+snow+angels+back',
  'Prone Y Raises':              'https://www.youtube.com/results?search_query=prone+Y+raise+shoulder',
  'Superman Hold':               'https://www.youtube.com/results?search_query=superman+hold+back',
  'Burpees':                     'https://www.youtube.com/results?search_query=burpee+proper+form+tutorial',
  'High Knees':                  'https://www.youtube.com/results?search_query=high+knees+exercise+form',
  'Jumping Jacks':               'https://www.youtube.com/results?search_query=jumping+jacks+exercise',
  'Mountain Climbers':           'https://www.youtube.com/results?search_query=mountain+climbers+form',
  'Jump Rope (Imaginary)':       'https://www.youtube.com/results?search_query=jump+rope+exercise+tutorial',
  'Skater Jumps':                'https://www.youtube.com/results?search_query=skater+jumps+lateral+form',
  'Speed Skaters':               'https://www.youtube.com/results?search_query=speed+skaters+cardio',
  'Tuck Jumps':                  'https://www.youtube.com/results?search_query=tuck+jump+tutorial',
  'Boxing Punches':              'https://www.youtube.com/results?search_query=boxing+punches+workout',
  'Battle Ropes':                'https://www.youtube.com/results?search_query=battle+ropes+workout+form',
  'Medicine Ball Slams':         'https://www.youtube.com/results?search_query=medicine+ball+slam+tutorial',
  'Kettlebell Swings':           'https://www.youtube.com/results?search_query=kettlebell+swing+proper+form',
  'Thrusters':                   'https://www.youtube.com/results?search_query=thruster+exercise+form',
  'Plank Jacks':                 'https://www.youtube.com/results?search_query=plank+jacks+cardio',
};

function getYouTubeLink(exerciseName) {
  if (YOUTUBE_LINKS[exerciseName]) return YOUTUBE_LINKS[exerciseName];
  // Fallback: generic search for any exercise not in the map
  const query = encodeURIComponent(exerciseName + ' exercise proper form tutorial');
  return `https://www.youtube.com/results?search_query=${query}`;
}

function getAIResponse(userMessage, userData) {
  const msg = userMessage.toLowerCase().trim();

  // Greetings
  if (msg.match(/^(hi|hello|hey|sup|yo|what'?s up|howdy|hiya)/)) {
    const greetings = [
      `Hey ${userData?.name || 'there'}! 💪 I'm your Gym Buddy AI! What can I help you with today?`,
      `What's up ${userData?.name || 'champion'}! Ready to crush some goals? Ask me anything about fitness!`,
      `Hello! 🔥 Great to see you! How can I help you on your fitness journey today?`,
      `Hey hey! Your personal fitness assistant is here! What's on your mind?`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // How are you
  if (msg.match(/(how are you|how you doing|how's it going)/)) {
    return `I'm fired up and ready to help you crush your fitness goals! 🔥 How about you? Ready to get after it?`;
  }

  // Thank you
  if (msg.match(/(thank|thanks|thx|appreciate)/)) {
    return `You're welcome! 💪 That's what I'm here for. Keep pushing and stay consistent!`;
  }

  // BMI questions
  if (msg.match(/(bmi|body mass index)/)) {
    if (userData?.bmi) {
      const bmi = parseFloat(userData.bmi);
      let advice = '';
      if (bmi < 18.5) {
        advice = "Your BMI indicates you're underweight. Focus on strength training and eating more protein and healthy calories!";
      } else if (bmi < 25) {
        advice = "Your BMI is in the healthy range! Keep up the great work with balanced exercise and nutrition!";
      } else if (bmi < 30) {
        advice = "Your BMI is in the overweight range. Combining cardio with strength training and a balanced diet will help!";
      } else {
        advice = "Your BMI is in the obese range. Start with low-impact cardio and gradually increase intensity. You've got this!";
      }
      return `Your BMI is ${userData.bmi}. ${advice} Remember, BMI doesn't account for muscle mass, so use it as just one tool!`;
    }
    return "BMI (Body Mass Index) is calculated using your height and weight. It's a general indicator, but doesn't account for muscle mass. Athletes often have 'high' BMIs despite being very fit!";
  }

  // Weight loss questions
  if (msg.match(/(lose weight|weight loss|burn fat|fat loss|slim down|get lean)/)) {
    return `Great goal! 🔥 Here's my advice for weight loss:\n\n1. Create a calorie deficit (eat 300-500 fewer calories than you burn)\n2. Focus on high-intensity cardio like HIIT, burpees, and jump rope\n3. Add strength training to build muscle (muscle burns more calories at rest!)\n4. Eat plenty of protein to stay full and preserve muscle\n5. Stay consistent - aim for 4-5 workouts per week\n\nWhat specific area would you like more help with?`;
  }

  // Muscle building
  if (msg.match(/(build muscle|gain muscle|get bigger|bulk|get strong|strength)/)) {
    return `Ready to build some muscle! 💪 Here's the game plan:\n\n1. Progressive overload - gradually increase weight/reps\n2. Eat in a slight calorie surplus (200-300 extra calories)\n3. Get 0.7-1g of protein per pound of bodyweight\n4. Focus on compound movements (squats, deadlifts, bench press)\n5. Rest 48-72 hours between training the same muscle group\n6. Sleep 7-9 hours for recovery\n\nWhich muscle group do you want to focus on?`;
  }

  // Nutrition / Diet
  if (msg.match(/(eat|food|diet|nutrition|meal|calorie|protein|carb)/)) {
    return `Nutrition is KEY! 🥗 Here are my top tips:\n\n• Protein: 0.7-1g per pound of bodyweight (chicken, fish, eggs, legumes)\n• Carbs: Fuel your workouts with complex carbs (oats, rice, potatoes)\n• Fats: Don't fear them! Healthy fats from avocado, nuts, olive oil\n• Water: Drink at least 8 glasses daily, more when exercising\n• Meal timing: Eat protein within 2 hours after working out\n\nWhat specific nutrition question do you have?`;
  }

  // Motivation
  if (msg.match(/(motivat|tired|exhausted|give up|quit|hard|difficult|can't|cant|struggling)/)) {
    const motivations = [
      `Listen, I get it - it's tough sometimes. But remember: every single workout counts. Even on days you don't feel like it, showing up is what separates you from everyone else. You're stronger than you think! 💪`,
      `Hey, everyone has bad days. The secret? Just do SOMETHING. Even 10 minutes counts. Progress isn't linear, but every step forward matters. You've got this! 🔥`,
      `Remember why you started! Picture yourself achieving your goals. That future version of you is counting on the work you put in TODAY. Don't let them down! ⚡`,
      `The only bad workout is the one that didn't happen. Start small if you need to. The hardest part is just beginning. Once you start, momentum takes over! 🚀`
    ];
    return motivations[Math.floor(Math.random() * motivations.length)];
  }

  // Rest / Recovery
  if (msg.match(/(rest|recovery|sleep|sore|doms|pain|hurt|injury)/)) {
    return `Recovery is just as important as training! 😴\n\n• Sleep: Aim for 7-9 hours - this is when muscles repair and grow\n• Rest days: Take 1-2 per week minimum\n• Soreness (DOMS): Normal 24-72 hours after a workout. Light stretching and walking help!\n• Sharp pain: STOP and rest. If it persists, see a doctor\n• Active recovery: Light walking, stretching, or yoga on rest days\n\nYour muscles grow during rest, not during the workout!`;
  }

  // Workout frequency
  if (msg.match(/(how often|how many times|frequency|days per week|times a week)/)) {
    return `Great question! Here's what I recommend:\n\n• Beginners: 3 times per week (full body workouts)\n• Intermediate: 4-5 times per week (split routines)\n• Advanced: 5-6 times per week\n\nAlways have at least 1-2 complete rest days. Listen to your body - if you're constantly sore or tired, you might be overtraining!`;
  }

  // Best exercises
  if (msg.match(/(best exercise|most effective|what should i do|recommend|suggestion)/)) {
    return `The BEST exercises are compound movements that work multiple muscles:\n\n🏆 Top 5 Overall:\n1. Squats - King of leg exercises\n2. Deadlifts - Full posterior chain\n3. Push-ups/Bench Press - Chest, shoulders, triceps\n4. Pull-ups/Rows - Back and biceps\n5. Planks - Core stability\n\nBut honestly? The best exercise is one you'll actually DO consistently! What's your goal?`;
  }

  // Warm up / Stretching
  if (msg.match(/(warm up|stretch|before workout|cool down)/)) {
    return `Warming up is crucial! 🔥\n\n**Before workout (5-10 min):**\n• Light cardio (jumping jacks, jogging)\n• Dynamic stretches (arm circles, leg swings)\n• Movement prep (bodyweight squats, lunges)\n\n**After workout (5-10 min):**\n• Static stretches (hold 20-30 seconds)\n• Focus on muscles you just worked\n• Deep breathing to lower heart rate\n\nNever skip the warm-up - it prevents injuries!`;
  }

  // Abs / Six pack
  if (msg.match(/(abs|six pack|stomach|belly|core)/)) {
    return `Ah, the six-pack question! 🎯 Here's the truth:\n\n1. EVERYONE has abs - they're just hidden under fat\n2. Abs are made in the kitchen (diet is 80% of it)\n3. You can't spot-reduce fat - overall fat loss reveals abs\n4. Core exercises strengthen them, but won't make them visible alone\n\n**Best ab exercises:**\n• Planks\n• Bicycle crunches\n• Leg raises\n• Russian twists\n\nCombine core work with cardio and a good diet!`;
  }

  // Cardio
  if (msg.match(/(cardio|running|jogging|treadmill|elliptical)/)) {
    return `Cardio is great for heart health and burning calories! ❤️\n\n**Types:**\n• LISS (Low Intensity Steady State) - Walking, light jogging (30-60 min)\n• HIIT (High Intensity Interval Training) - Short bursts of intense work (15-25 min)\n\n**My recommendation:**\n• For fat loss: Mix of both, 3-4x per week\n• For heart health: 150 min moderate cardio per week\n• Don't overdo it if building muscle - too much cardio can hurt gains\n\nWhat's your cardio goal?`;
  }

  // Water / Hydration
  if (msg.match(/(water|hydrat|drink|thirst)/)) {
    return `Stay hydrated! 💧\n\n• Minimum: 8 glasses (64 oz) per day\n• When exercising: Add 16-24 oz per hour of workout\n• Signs of dehydration: Dark urine, headaches, fatigue\n\n**Pro tips:**\n• Drink a glass first thing in the morning\n• Keep a water bottle with you always\n• Drink before you feel thirsty\n• Water helps with energy, focus, and muscle recovery!`;
  }

  // Time / When to workout
  if (msg.match(/(when|what time|morning|evening|night|best time to workout)/)) {
    return `The best time to workout is... whenever you'll actually DO IT! 😄\n\n**Morning benefits:**\n• Boosts energy for the day\n• Gets it done before life gets busy\n• May help with consistency\n\n**Evening benefits:**\n• Muscles are warmer and more flexible\n• Can lift heavier typically\n• Good stress relief after work\n\nPick a time that fits your schedule and stick with it!`;
  }

  // Supplements
  if (msg.match(/(supplement|protein powder|creatine|pre-workout|bcaa)/)) {
    return `Supplements are just that - SUPPLEMENTS to a good diet! 💊\n\n**Worth considering:**\n• Protein powder - Convenient if you struggle to eat enough protein\n• Creatine - Well-researched, helps with strength and power\n• Caffeine - Natural pre-workout (coffee works!)\n\n**Usually unnecessary:**\n• BCAAs - If you eat enough protein, you don't need them\n• Fat burners - Most don't work\n\nFocus on whole foods first! Supplements are 5% of the equation.`;
  }

  // Equipment / Home workout
  if (msg.match(/(equipment|home workout|no gym|bodyweight|at home)/)) {
    return `No gym? No problem! 🏠\n\n**Great bodyweight exercises:**\n• Push-ups (and variations)\n• Squats and lunges\n• Planks and mountain climbers\n• Burpees\n• Dips (using a chair)\n\n**Cheap equipment that helps:**\n• Resistance bands (~$15)\n• Pull-up bar (~$25)\n• Dumbbells or kettlebell\n• Jump rope (~$10)\n\nYou can build an amazing physique with just bodyweight!`;
  }

  // Plateau / Not seeing results
  if (msg.match(/(plateau|stuck|not working|no results|same weight|not losing|not gaining)/)) {
    return `Hit a plateau? Let's break through it! 🚀\n\n**Try these:**\n1. Change your routine - Your body adapts! Try new exercises\n2. Increase intensity - More weight, less rest, more reps\n3. Check your diet - Are you eating right for your goal?\n4. Sleep more - Recovery might be the issue\n5. Track everything - What gets measured gets improved\n6. Deload week - Sometimes you need to rest to progress\n\nPlateaus are normal and temporary. Keep pushing!`;
  }

  // Age related
  if (msg.match(/(too old|age|older|senior|50|60|40)/)) {
    return `Age is just a number! 💪 You're NEVER too old to start!\n\n**Tips for older athletes:**\n• Focus more on warm-up and mobility\n• Recovery takes longer - listen to your body\n• Strength training is CRUCIAL for bone density\n• Start with lower weights, perfect form first\n• Flexibility work becomes more important\n\nPeople in their 60s, 70s, and beyond can build muscle and get fit. Start where you are!`;
  }

  // Help / What can you do
  if (msg.match(/(help|what can you|what do you|features|options)/)) {
    return `I'm your personal fitness AI! 🤖 Here's what I can help with:\n\n💪 Workout advice and exercise tips\n🥗 Nutrition and diet guidance\n🔥 Weight loss strategies\n💪 Muscle building tips\n😴 Recovery and rest advice\n⚡ Motivation when you need it\n📊 Understanding your BMI\n❓ Any fitness questions!\n\nJust ask me anything fitness-related!`;
  }

  // Funny / off-topic - answer ANYTHING with personality
  if (msg.match(/(can i have|give me|send me).*(money|\$|dollar|cash|bitcoin|crypto)/)) {
    return `Haha, I WISH I could give you money! 😂 Unfortunately my bank account is empty (I'm an AI). But I CAN give you something better — free fitness coaching! How about I help you get so fit you can earn that money yourself? 💪💸`;
  }
  if (msg.match(/(pizza|burger|fries|junk food|fast food|mcdonalds|taco)/)) {
    return `Ohhh the forbidden foods! 🍕 Look, I won't judge — everyone deserves a treat sometimes. Just make sure you're hitting your workouts so you can enjoy it guilt-free! Balance is key. One slice won't ruin your progress, but the whole pizza might slow things down. Enjoy it and get back on track tomorrow! 😄`;
  }
  if (msg.match(/(funny|joke|tell me a joke|make me laugh)/)) {
    const jokes = [
      `Why did the scarecrow win an award? Because he was outstanding in his field... unlike most people who skip leg day! 🦵😂`,
      `I told my trainer I wanted abs. He said "Great! Cut out pizza." I said "I'll just do more crunches." We don't talk anymore. 😂`,
      `Why do gym teachers make good stock brokers? Because they're used to people doing reps! 📈💪`,
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }
  if (msg.match(/(love you|i love you|marry me)/)) {
    return `Aww, I love you too! 🥰 But I'm just a fitness AI — my heart belongs to gainz and protein shakes. Let's channel that energy into your workout instead! 💪❤️`;
  }
  if (msg.match(/(weather|rain|sunny|temperature|forecast)/)) {
    return `I don't have live weather data, but I'll say this — rain or shine, your workout doesn't care! 🌧️☀️ If it's raining outside, do an indoor workout. No excuses! What muscle group do you want to train today?`;
  }
  if (msg.match(/(meaning of life|42|purpose)/)) {
    return `The meaning of life? 42 — and also: deadlifts, protein, and consistency. 🏋️ Aristotle said "We are what we repeatedly do." That means YOU are your habits. Make them count! 💪`;
  }

  // True fallback — answer with personality using Claude API feel
  const funnyFallbacks = [
    `Ha, that's a new one! 😄 I may be a gym AI but I'll try my best: I don't have a perfect answer for that one, but I DO know that whatever's on your mind, a good workout will probably help. Stress? Lift it. Confusion? Cardio clears the head. Existential dread? Planks. Works every time. 💪`,
    `Okay, you've stumped the gym bot! 🤖 That question is WAY outside the weight room. But since you asked — I'd say yes, probably, and also make sure you stretch after. Now what can I actually help you with fitness-wise? 😄`,
    `Bold question! I'm an AI fitness coach, not a life coach — but honestly, my advice is the same: stay consistent, eat your protein, get enough sleep, and keep showing up. That fixes like 90% of problems. What's your real fitness question? 💪🔥`,
    `I love that you're testing my limits! 😂 My honest answer: I have no idea, but I DO know that strong people are harder to kill and generally more useful. Want to be strong? Let's get to work!`,
  ];
  return funnyFallbacks[Math.floor(Math.random() * funnyFallbacks.length)];
}

// ============================================
// COMPONENTS
// ============================================

// Flames Component
// ── Wave Transition Overlay — layers cascade DOWN from top ──────────────────
function WaveTransition({ active, isHome }) {
  const [phase, setPhase] = useState('idle'); // idle | in | hold | out
  const timerRef = useRef(null);

  useEffect(() => {
    if (active) {
      setPhase('in');
      timerRef.current = setTimeout(() => setPhase('out'), 400);
    } else {
      setPhase('idle');
      clearTimeout(timerRef.current);
    }
    return () => clearTimeout(timerRef.current);
  }, [active]);

  if (phase === 'idle') return null;

  const bg   = isHome ? '#1565c0' : '#cc3300';
  const mid  = isHome ? '#1976d2' : '#e63800';
  const lite = isHome ? '#42a5f5' : '#ff6020';

  // One flowing sine-curve wave that looks like real ocean water
  // The panel is 110vh tall so the wave crest is visible before the body floods in
  return (
      <div className={`wave-transition wave-${phase}`}>
        {/* Back panel — slightly lighter, leads slightly */}
        <svg className="wave-panel wave-back" viewBox="0 0 1440 110" preserveAspectRatio="none">
          <defs>
            <linearGradient id="waveGradBack" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lite} stopOpacity="0.7"/>
              <stop offset="100%" stopColor={mid} stopOpacity="0.9"/>
            </linearGradient>
          </defs>
          <path fill="url(#waveGradBack)"
                d="M0,70 C120,40 240,95 360,65 C480,35 600,90 720,60 C840,30 960,85 1080,55 C1200,25 1320,75 1440,55 L1440,110 L0,110 Z"/>
        </svg>
        {/* Main flood panel — smooth gradient fill */}
        <div className="wave-flood" style={{ background: `linear-gradient(180deg, ${bg} 0%, ${mid} 60%, ${bg} 100%)` }}>
          <svg className="wave-crest" viewBox="0 0 1440 80" preserveAspectRatio="none">
            <path fill={lite} fillOpacity="0.55"
                  d="M0,45 C180,15 360,70 540,40 C720,10 900,65 1080,38 C1200,20 1320,58 1440,38 L1440,0 L0,0 Z"/>
            <path fill="white" fillOpacity="0.12"
                  d="M0,55 C200,30 400,72 600,48 C800,24 1000,68 1200,44 C1320,28 1390,52 1440,44 L1440,0 L0,0 Z"/>
          </svg>
        </div>
      </div>
  );
}

function Flames({ isHome }) {
  return (
      <div className={`flames-container${isHome ? ' flames-home' : ''}`}>
        <div className="flame-glow"></div>
        {[...Array(12)].map((_, i) => <div key={i} className="flame"></div>)}
        {[...Array(6)].map((_, i) => <div key={i + 12} className="flame-inner"></div>)}
      </div>
  );
}

// Floating Dumbbells Component
function FloatingDumbbells({ isHome }) {
  return (
      <>
        {[...Array(6)].map((_, i) => (
            <div key={i} className={`dumbbell${isHome ? ' dumbbell-home' : ''}`}>
              <svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="8" width="18" height="24" rx="3"/>
                <rect x="77" y="8" width="18" height="24" rx="3"/>
                <rect x="23" y="14" width="54" height="12" rx="2"/>
              </svg>
            </div>
        ))}
      </>
  );
}

// ── Circular Progress Ring ─────────────────────────────────────────────────
function ProgressRing({ percent, size = 120, stroke = 10, color = '#ff4500' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
      <svg width={size} height={size} className="progress-ring-svg">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x={size/2} y={size/2 + 6} textAnchor="middle"
              fill="white" fontSize="22" fontWeight="800" fontFamily="Bebas Neue, sans-serif">
          {Math.round(percent)}%
        </text>
      </svg>
  );
}

// ── Streak Widget ─────────────────────────────────────────────────────────
function StreakWidget({ workoutHistory }) {
  const streak = (() => {
    if (!workoutHistory?.length) return 0;
    let s = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = d.toDateString();
      const hit = workoutHistory.some(h => {
        try { return new Date(h.date).toDateString() === ds; } catch { return false; }
      });
      if (hit) s++;
      else if (i > 0) break;
    }
    return s;
  })();

  const label = streak === 0 ? 'Start your streak today!' :
      streak === 1 ? '1 day streak — keep going!' :
          `${streak} day streak — you're on fire!`;

  return (
      <div className="streak-widget">
        <div className="streak-fire">🔥</div>
        <div className="streak-info">
          <span className="streak-num">{streak}</span>
          <span className="streak-label">{label}</span>
        </div>
        <div className="streak-dots">
          {[...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const hit = workoutHistory?.some(h => {
              try { return new Date(h.date).toDateString() === d.toDateString(); } catch { return false; }
            });
            const isToday = i === 6;
            return (
                <div key={i} className={`streak-dot ${hit ? 'hit' : ''} ${isToday ? 'today-dot-s' : ''}`}
                     title={d.toLocaleDateString('en',{weekday:'short'})}>
                  <span className="streak-day-label">{['S','M','T','W','T','F','S'][(d.getDay())]}</span>
                </div>
            );
          })}
        </div>
      </div>
  );
}


// ── 1. CALORIE BURN RATE WIDGET ──────────────────────────────────────────────
// Shows live cal/min based on timer + total workout calories
function BurnRateWidget({ timerSeconds, totalCalories, workoutPlan }) {
  const rate = timerSeconds > 60
      ? ((totalCalories / (timerSeconds / 60))).toFixed(1)
      : (totalCalories / 45).toFixed(1);
  const bars = Math.min(Math.round(parseFloat(rate) / 3), 8);
  return (
      <div className="burn-rate-widget">
        <div className="brw-left">
          <span className="brw-icon">🔥</span>
          <div>
            <span className="brw-title">BURN RATE</span>
            <span className="brw-rate">{rate} <small>cal/min</small></span>
          </div>
        </div>
        <div className="brw-bars">
          {[...Array(8)].map((_, i) => (
              <div key={i} className={`brw-bar ${i < bars ? 'active' : ''}`}
                   style={{ height: `${10 + i * 4}px`, animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      </div>
  );
}

// ── 2. MUSCLE MAP (SVG body diagram) ─────────────────────────────────────────
function MuscleMap({ targetArea }) {
  const highlights = {
    fullBody:       ['chest','shoulders','biceps','triceps','abs','quads','hamstrings','glutes','calves'],
    arms:           ['biceps','triceps','shoulders','forearms'],
    legs:           ['quads','hamstrings','glutes','calves'],
    chest:          ['chest','shoulders','triceps'],
    back:           ['lats','traps','rhomboids','biceps'],
    abs:            ['abs','obliques'],
    loseWeightOnly: ['chest','abs','quads','glutes','calves'],
    tone:           ['chest','abs','quads','glutes','arms'],
  };
  const active = new Set(highlights[targetArea] || highlights.fullBody);
  const m = (name, color='#ff4500') => active.has(name)
      ? { fill: color, opacity: 0.85, filter: 'drop-shadow(0 0 4px #ff4500)' }
      : { fill: 'rgba(255,255,255,0.08)', opacity: 1 };

  return (
      <div className="muscle-map-card">
        <div className="muscle-map-header">
          <span className="mm-icon">💪</span>
          <strong className="mm-title">Muscles Targeted</strong>
        </div>
        <div className="muscle-pills-row">
          {[...active].map(s => {
            const pillColors = {
              chest:'#ff4500',shoulders:'#ff6b00',biceps:'#e74c3c',triceps:'#c0392b',
              abs:'#ffaa00',obliques:'#ffcc00',quads:'#3498db',hamstrings:'#2980b9',
              glutes:'#27ae60',calves:'#16a085',lats:'#9b59b6',traps:'#8e44ad',
              rhomboids:'#6c3483',forearms:'#ff7675',arms:'#ff4757'
            };
            const color = pillColors[s] || '#ff4500';
            return (
                <span key={s} className="muscle-pill" style={{'--pill-color': color}}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </span>
            );
          })}
        </div>
        <div className="muscle-map-svg-wrap">
          <svg viewBox="0 0 120 220" xmlns="http://www.w3.org/2000/svg" className="muscle-map-svg">
            {/* Head */}
            <ellipse cx="60" cy="18" rx="14" ry="16" fill="rgba(255,255,255,0.12)" />
            {/* Neck */}
            <rect x="54" y="32" width="12" height="10" rx="3" fill="rgba(255,255,255,0.08)" />
            {/* Chest */}
            <ellipse cx="49" cy="58" rx="14" ry="13" style={m('chest','#ff4500')} />
            <ellipse cx="71" cy="58" rx="14" ry="13" style={m('chest','#ff4500')} />
            {/* Shoulders */}
            <ellipse cx="29" cy="48" rx="11" ry="9" style={m('shoulders','#ff6b00')} />
            <ellipse cx="91" cy="48" rx="11" ry="9" style={m('shoulders','#ff6b00')} />
            {/* Traps */}
            <ellipse cx="60" cy="44" rx="16" ry="7" style={m('traps','#ff8800')} />
            {/* Abs */}
            <rect x="50" y="73" width="9" height="10" rx="3" style={m('abs','#ffaa00')} />
            <rect x="61" y="73" width="9" height="10" rx="3" style={m('abs','#ffaa00')} />
            <rect x="50" y="86" width="9" height="10" rx="3" style={m('abs','#ffaa00')} />
            <rect x="61" y="86" width="9" height="10" rx="3" style={m('abs','#ffaa00')} />
            <rect x="50" y="99" width="9" height="10" rx="3" style={m('obliques','#ffcc00')} />
            <rect x="61" y="99" width="9" height="10" rx="3" style={m('obliques','#ffcc00')} />
            {/* Biceps */}
            <ellipse cx="22" cy="72" rx="8" ry="14" style={m('biceps','#e74c3c')} />
            <ellipse cx="98" cy="72" rx="8" ry="14" style={m('biceps','#e74c3c')} />
            {/* Triceps */}
            <ellipse cx="17" cy="76" rx="6" ry="12" style={m('triceps','#c0392b')} />
            <ellipse cx="103" cy="76" rx="6" ry="12" style={m('triceps','#c0392b')} />
            {/* Forearms */}
            <rect x="13" y="90" width="12" height="22" rx="5" style={m('forearms','#ff7675')} />
            <rect x="95" y="90" width="12" height="22" rx="5" style={m('forearms','#ff7675')} />
            {/* Lats */}
            <ellipse cx="38" cy="75" rx="10" ry="20" style={m('lats','#9b59b6')} />
            <ellipse cx="82" cy="75" rx="10" ry="20" style={m('lats','#9b59b6')} />
            {/* Quads */}
            <ellipse cx="47" cy="152" rx="13" ry="26" style={m('quads','#3498db')} />
            <ellipse cx="73" cy="152" rx="13" ry="26" style={m('quads','#3498db')} />
            {/* Hamstrings */}
            <ellipse cx="47" cy="158" rx="11" ry="20" style={m('hamstrings','#2980b9')} />
            <ellipse cx="73" cy="158" rx="11" ry="20" style={m('hamstrings','#2980b9')} />
            {/* Glutes */}
            <ellipse cx="47" cy="128" rx="15" ry="14" style={m('glutes','#27ae60')} />
            <ellipse cx="73" cy="128" rx="15" ry="14" style={m('glutes','#27ae60')} />
            {/* Calves */}
            <ellipse cx="47" cy="192" rx="10" ry="17" style={m('calves','#16a085')} />
            <ellipse cx="73" cy="192" rx="10" ry="17" style={m('calves','#16a085')} />
          </svg>
          <div className="muscle-map-legend">
            <div className="mml-section-title">COLOR KEY</div>
            {[
              { color: '#ff4500', label: 'Chest' },
              { color: '#ff6b00', label: 'Shoulders' },
              { color: '#ffaa00', label: 'Abs / Core' },
              { color: '#e74c3c', label: 'Biceps' },
              { color: '#c0392b', label: 'Triceps' },
              { color: '#9b59b6', label: 'Lats / Back' },
              { color: '#3498db', label: 'Quads' },
              { color: '#2980b9', label: 'Hamstrings' },
              { color: '#27ae60', label: 'Glutes' },
              { color: '#16a085', label: 'Calves' },
              { color: 'rgba(255,255,255,0.15)', label: 'Not Active' },
            ].map(({ color, label }) => (
                <div key={label} className="mml-item">
                  <div className="mml-dot" style={{ background: color }} />
                  <span>{label}</span>
                </div>
            ))}
          </div>
        </div>
      </div>
  );
}

// ── 3. WORKOUT TIP OF THE DAY ─────────────────────────────────────────────────
const GYM_TIPS = [
  { icon: '🧠', title: 'Mind-Muscle Connection', tip: 'Focus on squeezing the target muscle during every rep. This alone can increase activation by 20-35%.' },
  { icon: '💧', title: 'Hydrate Before You\'re Thirsty', tip: 'By the time you feel thirst, you\'re already 2% dehydrated — which drops performance by up to 10%.' },
  { icon: '😴', title: 'Sleep = Gains', tip: 'Growth hormone spikes during deep sleep. Less than 7 hours? Your gains are literally being stolen.' },
  { icon: '🍗', title: '30-Min Protein Window', tip: 'Get protein in within 30 minutes post-workout. Your muscles are starving for amino acids right now.' },
  { icon: '🔥', title: 'Afterburn is Real', tip: 'HIIT keeps your metabolism elevated for 24-48 hours after your session. Keep pushing!' },
  { icon: '🦵', title: 'Never Skip Legs', tip: 'Leg training releases the most testosterone of any workout. Bigger legs = bigger everything.' },
  { icon: '🫁', title: 'Breathe Right', tip: 'Exhale on exertion (the hard part), inhale on the release. Proper breathing increases power output.' },
  { icon: '📈', title: 'Progressive Overload', tip: 'Add just 1 more rep or 5 more pounds each week. In 3 months you\'ll be shocked by your progress.' },
  { icon: '⏸️', title: 'Rest Days Are Training Days', tip: 'Muscles grow during recovery, not during the workout. Respect your rest days.' },
  { icon: '🎯', title: 'Specificity Wins', tip: 'Your body adapts to exactly what you train. Want to run faster? Run faster. Lift heavier? Lift heavier.' },
];

function WorkoutTipWidget() {
  const [tip] = useState(() => {
    const day = new Date().getDate();
    return GYM_TIPS[day % GYM_TIPS.length];
  });
  return (
      <div className="workout-tip-widget">
        <div className="wtw-icon">{tip.icon}</div>
        <div className="wtw-content">
          <span className="wtw-label">TODAY'S TIP</span>
          <strong className="wtw-title">{tip.title}</strong>
          <p className="wtw-text">{tip.tip}</p>
        </div>
      </div>
  );
}

// ── 4. PERSONAL RECORDS TRACKER ───────────────────────────────────────────────
function PRTracker({ workoutHistory }) {
  const totalWorkouts = workoutHistory?.length || 0;
  const totalCalories = workoutHistory?.reduce((s, h) => s + (h.calories || 0), 0) || 0;
  const avgDuration = (() => {
    const withDur = workoutHistory?.filter(h => h.duration) || [];
    if (!withDur.length) return '—';
    const totalMins = withDur.reduce((s, h) => {
      const m = parseInt(h.duration) || 0; return s + m;
    }, 0);
    return `${Math.round(totalMins / withDur.length)}m`;
  })();
  const longestStreak = (() => {
    if (!workoutHistory?.length) return 0;
    const dates = workoutHistory.map(h => {
      try { return new Date(h.date).toDateString(); } catch { return ''; }
    }).filter(Boolean);
    const unique = [...new Set(dates)].map(d => new Date(d)).sort((a,b) => a-b);
    let best = 1, cur = 1;
    for (let i = 1; i < unique.length; i++) {
      const diff = (unique[i] - unique[i-1]) / 86400000;
      if (diff === 1) { cur++; best = Math.max(best, cur); }
      else cur = 1;
    }
    return unique.length > 0 ? best : 0;
  })();

  const records = [
    { label: 'Total Workouts', value: totalWorkouts, icon: '🏋️', color: '#ff4500' },
    { label: 'Calories Burned', value: totalCalories.toLocaleString(), icon: '🔥', color: '#ffaa00' },
    { label: 'Best Streak', value: `${longestStreak}d`, icon: '⚡', color: '#ff6b00' },
    { label: 'Avg Duration', value: avgDuration, icon: '⏱️', color: '#ff8c42' },
  ];

  return (
      <div className="pr-tracker">
        <div className="pr-header">
          <span className="pr-header-icon">🏆</span>
          <div>
            <strong>Your Personal Records</strong>
            <span>All time stats</span>
          </div>
        </div>
        <div className="pr-grid">
          {records.map((r, i) => (
              <div key={i} className="pr-card" style={{ '--pr-color': r.color }}>
                <span className="pr-card-icon">{r.icon}</span>
                <span className="pr-card-value">{r.value}</span>
                <span className="pr-card-label">{r.label}</span>
              </div>
          ))}
        </div>
      </div>
  );
}

// ── 5. WORKOUT INTENSITY METER ────────────────────────────────────────────────
function IntensityMeter({ workoutPlan }) {
  const hardCount = workoutPlan?.filter(w => w.difficulty === 'Hard').length || 0;
  const medCount = workoutPlan?.filter(w => w.difficulty === 'Medium').length || 0;
  const total = workoutPlan?.length || 1;
  const score = Math.round(((hardCount * 3 + medCount * 2) / (total * 3)) * 100);
  const level = score >= 70 ? { label: 'BEAST MODE', color: '#ff0000', bars: 5 }
      : score >= 50 ? { label: 'HIGH INTENSITY', color: '#ff4500', bars: 4 }
          : score >= 35 ? { label: 'MODERATE', color: '#ffaa00', bars: 3 }
              : score >= 20 ? { label: 'LIGHT', color: '#ffdd00', bars: 2 }
                  :               { label: 'WARM UP', color: '#00ff88', bars: 1 };
  return (
      <div className="intensity-meter">
        <div className="im-left">
          <span className="im-label">INTENSITY</span>
          <span className="im-level" style={{ color: level.color }}>{level.label}</span>
        </div>
        <div className="im-bars">
          {[...Array(5)].map((_, i) => (
              <div key={i} className={`im-bar ${i < level.bars ? 'lit' : ''}`}
                   style={{ '--bar-color': level.color, height: `${14 + i * 6}px` }} />
          ))}
        </div>
        <span className="im-score" style={{ color: level.color }}>{score}%</span>
      </div>
  );
}


// ── HIGH FIVE ANIMATION ───────────────────────────────────────────────────────
// Shown ONLY when user checks off every exercise AND the timer was running
function HighFiveAnimation({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, []);

  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    angle: (i / 18) * 360,
    color: ['#ff4500','#ffaa00','#ff6b35','#ffcc00','#ff3b5c','#3bffd8','#e8ff3b'][i % 7],
    size: 6 + Math.random() * 8,
    dist: 60 + Math.random() * 50,
    delay: Math.random() * 0.2,
  }));

  return (
      <div className="highfive-overlay">
        <div className="highfive-burst">
          {particles.map(p => (
              <div key={p.id} className="hf-particle" style={{
                '--angle': `${p.angle}deg`,
                '--dist': `${p.dist}px`,
                '--delay': `${p.delay}s`,
                background: p.color,
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
              }} />
          ))}
          <div className="highfive-hands">
            <span className="hf-hand left">🤚</span>
            <span className="hf-hand right">🤚</span>
          </div>
          <div className="highfive-text">HIGH FIVE!</div>
        </div>
      </div>
  );
}


// ── EASTER EGG: BICEP CURL FINGER WORKOUT ────────────────────────────────────
function EasterEggGame({ onClose }) {
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [phase, setPhase] = useState('intro');
  const [curlUp, setCurlUp] = useState(false);
  const [flames, setFlames] = useState([]);
  const [hsAtStart] = useState(parseInt(localStorage.getItem('gymBuddyEggHS') || '0'));
  const timerRef = useRef(null);
  const isDown = useRef(false);
  const flameId = useRef(0);
  const clicksRef = useRef(0);

  const startGame = () => {
    setPhase('playing');
    setClicks(0);
    clicksRef.current = 0;
    setCurlUp(false);
    setFlames([]);
    setTimeLeft(30);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setPhase('done'); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const spawnFlame = (e) => {
    const rect = e.currentTarget?.getBoundingClientRect?.() || { left: window.innerWidth/2, top: window.innerHeight/2, width: 0, height: 0 };
    const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 60;
    const y = rect.top - 20 + (Math.random() - 0.5) * 30;
    const id = flameId.current++;
    setFlames(f => [...f, { id, x, y }]);
    setTimeout(() => setFlames(f => f.filter(fl => fl.id !== id)), 800);
  };

  const handleDown = (e) => {
    if (phase !== 'playing' || isDown.current) return;
    isDown.current = true;
    setCurlUp(true);
    const next = clicksRef.current + 1;
    clicksRef.current = next;
    setClicks(next);
    if (next > hsAtStart) localStorage.setItem('gymBuddyEggHS', next);
    if (next % 10 === 0) spawnFlame(e);
  };

  const handleUp = () => {
    isDown.current = false;
    setCurlUp(false);
  };

  const finalHS = parseInt(localStorage.getItem('gymBuddyEggHS') || '0');
  const isNewHS = clicks > hsAtStart && hsAtStart > 0;
  const rank = clicks >= 150 ? '🏆 CURL GOD' : clicks >= 90 ? '💪 BEAST MODE' : clicks >= 50 ? '😤 DECENT CURL' : '🐌 FINGER NOODLE';

  // Arm matches reference photo: starts at 90° curl (forearm pointing right)
  // Animation pumps DOWN then back UP — like a real bicep curl rep
  // Dumbbell is horizontal, big round plates visible on both ends
  // Classic arm: hangs down at rest, curls UP to 90° on tap
  // Dumbbell is horizontal (sideways) — plates visible on left/right as round discs
  const ArmWithDumbbell = ({ curled }) => (
      <svg viewBox="0 0 200 280" className="egg-arm-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sk1" cx="38%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#f8d5b0"/>
            <stop offset="45%" stopColor="#d4895a"/>
            <stop offset="100%" stopColor="#96501e"/>
          </radialGradient>
          <radialGradient id="sk2" cx="42%" cy="32%" r="62%">
            <stop offset="0%" stopColor="#eca97a"/>
            <stop offset="100%" stopColor="#7a3a10"/>
          </radialGradient>
          <linearGradient id="barG" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#777"/>
            <stop offset="30%" stopColor="#ddd"/>
            <stop offset="50%" stopColor="#eee"/>
            <stop offset="70%" stopColor="#bbb"/>
            <stop offset="100%" stopColor="#555"/>
          </linearGradient>
          <radialGradient id="plL" cx="38%" cy="32%" r="62%">
            <stop offset="0%" stopColor="#e0e0e0"/>
            <stop offset="42%" stopColor="#888"/>
            <stop offset="100%" stopColor="#2a2a2a"/>
          </radialGradient>
          <radialGradient id="plR" cx="62%" cy="32%" r="62%">
            <stop offset="0%" stopColor="#c8c8c8"/>
            <stop offset="42%" stopColor="#666"/>
            <stop offset="100%" stopColor="#1e1e1e"/>
          </radialGradient>
        </defs>

        {/* === UPPER ARM — hangs vertically from shoulder === */}
        <path d="M108 15 Q96 25 94 68 Q92 92 100 104 Q108 112 100 112Z" fill="rgba(0,0,0,0.15)"/>
        <path d="M72 12 Q60 22 58 66 Q56 94 66 106 Q76 116 100 118 Q124 116 134 106 Q144 94 142 66 Q140 22 128 12 Q118 4 100 4 Q82 4 72 12Z" fill="url(#sk1)"/>
        {/* Bicep bulge — grows and shifts left when curled */}
        <ellipse
            cx={curled ? 84 : 96} cy={curled ? 56 : 68}
            rx={curled ? 26 : 18} ry={curled ? 34 : 26}
            fill="url(#sk2)" opacity="0.88"
            style={{ transition: 'all 0.12s ease-out' }}/>
        <ellipse
            cx={curled ? 79 : 91} cy={curled ? 46 : 58}
            rx={curled ? 11 : 8} ry={curled ? 16 : 12}
            fill="rgba(255,225,185,0.42)"
            style={{ transition: 'all 0.12s ease-out' }}/>
        <path d="M128 14 Q140 44 138 84 Q136 100 132 108" stroke="rgba(80,28,6,0.16)" strokeWidth="4" fill="none" strokeLinecap="round"/>

        {/* === ELBOW === */}
        <ellipse cx="100" cy="118" rx="26" ry="15" fill="#9a4018"/>
        <ellipse cx="100" cy="116" rx="18" ry="10" fill="#c06030"/>
        <path d="M76 114 Q100 124 124 114" stroke="rgba(60,20,4,0.25)" strokeWidth="2" fill="none" strokeLinecap="round"/>

        {/* === FOREARM + HAND + DUMBBELL — pivots at elbow
                    rest  (curled=false): hangs DOWN  → rotate(0)
                    curled (curled=true):  points UP   → rotate(-90deg)
            === */}
        <g style={{
          transformOrigin: '100px 118px',
          transform: curled ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform 0.13s cubic-bezier(0.34,1.56,0.64,1)'
        }}>
          {/* Forearm */}
          <path d="M118 118 Q124 148 120 184 Q124 164 126 140 Q124 124 120 118Z" fill="rgba(0,0,0,0.14)"/>
          <path d="M80 118 Q74 148 76 186 Q78 200 90 206 Q96 208 100 208 Q104 208 110 206 Q122 200 124 186 Q126 148 120 118 Q112 114 100 112 Q88 114 80 118Z" fill="url(#sk1)"/>
          <path d="M84 130 Q80 164 82 194" stroke="rgba(90,34,8,0.14)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path d="M94 120 Q90 155 92 192" stroke="rgba(255,205,155,0.2)" strokeWidth="6" fill="none" strokeLinecap="round"/>

          {/* Wrist */}
          <ellipse cx="100" cy="206" rx="21" ry="11" fill="#8a380e"/>

          {/* === DUMBBELL — horizontal through fist, plates sideways === */}
          {/* LEFT PLATE */}
          <ellipse cx="42" cy="228" rx="24" ry="16" fill="url(#plL)"/>
          <ellipse cx="42" cy="228" rx="18" ry="11" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5"/>
          <ellipse cx="42" cy="228" rx="10" ry="6" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
          <ellipse cx="37" cy="222" rx="6" ry="4" fill="rgba(255,255,255,0.25)"/>
          {/* Left collar */}
          <rect x="63" y="221" width="8" height="14" rx="2" fill="#777"/>
          <rect x="64.5" y="222" width="3" height="12" rx="1" fill="rgba(255,255,255,0.3)"/>
          {/* Left bar */}
          <rect x="71" y="223" width="14" height="10" rx="2" fill="url(#barG)"/>
          <rect x="72" y="224" width="12" height="3" rx="1" fill="rgba(255,255,255,0.45)"/>

          {/* FIST / PALM */}
          <rect x="75" y="212" width="50" height="34" rx="11" fill="url(#sk1)"/>
          {/* Fingers */}
          <path d="M78 222 Q76 233 77 239 Q79 244 83 244 Q87 244 88 239 Q89 234 87 222Z" fill="#e08050"/>
          <path d="M90 220 Q88 233 89 240 Q91 245 95 245 Q99 245 100 240 Q101 234 99 220Z" fill="#eca070"/>
          <path d="M102 220 Q100 233 101 240 Q103 245 107 245 Q111 245 112 240 Q113 234 111 220Z" fill="#e08050"/>
          <path d="M113 222 Q111 232 112 237 Q114 241 117 241 Q120 241 121 237 Q122 232 120 222Z" fill="#c86030"/>
          {/* Knuckles */}
          <ellipse cx="82" cy="225" rx="3.5" ry="2.2" fill="rgba(255,225,185,0.6)"/>
          <ellipse cx="94" cy="223" rx="3.5" ry="2.2" fill="rgba(255,225,185,0.6)"/>
          <ellipse cx="106" cy="223" rx="3.5" ry="2.2" fill="rgba(255,225,185,0.55)"/>
          <ellipse cx="116" cy="225" rx="3" ry="2" fill="rgba(255,225,185,0.5)"/>
          {/* Thumb */}
          <path d="M72 228 Q68 236 70 243 Q73 248 78 247 Q82 246 82 240 Q82 234 78 228Z" fill="url(#sk1)"/>
          <ellipse cx="72" cy="236" rx="4" ry="5.5" fill="rgba(255,210,170,0.35)"/>

          {/* Right bar */}
          <rect x="125" y="223" width="14" height="10" rx="2" fill="url(#barG)"/>
          <rect x="126" y="224" width="12" height="3" rx="1" fill="rgba(255,255,255,0.45)"/>
          {/* Right collar */}
          <rect x="139" y="221" width="8" height="14" rx="2" fill="#777"/>
          <rect x="141" y="222" width="3" height="12" rx="1" fill="rgba(255,255,255,0.28)"/>
          {/* RIGHT PLATE */}
          <ellipse cx="158" cy="228" rx="24" ry="16" fill="url(#plR)"/>
          <ellipse cx="158" cy="228" rx="18" ry="11" fill="none" stroke="rgba(0,0,0,0.32)" strokeWidth="1.5"/>
          <ellipse cx="158" cy="228" rx="10" ry="6" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
          <ellipse cx="153" cy="222" rx="5" ry="3.5" fill="rgba(255,255,255,0.18)"/>
        </g>

        {/* === SWEAT DROPS === */}
        {curled && <>
          <circle cx="52" cy="40" r="4.5" fill="#aee6ff" opacity="0.85">
            <animateTransform attributeName="transform" type="translate" from="0 0" to="0 38" dur="0.5s" fill="freeze"/>
            <animate attributeName="opacity" from="0.85" to="0" dur="0.5s" fill="freeze"/>
          </circle>
          <circle cx="38" cy="68" r="3" fill="#aee6ff" opacity="0.7">
            <animateTransform attributeName="transform" type="translate" from="0 0" to="0 32" dur="0.42s" fill="freeze"/>
            <animate attributeName="opacity" from="0.7" to="0" dur="0.42s" fill="freeze"/>
          </circle>
          <circle cx="152" cy="50" r="3.5" fill="#aee6ff" opacity="0.75">
            <animateTransform attributeName="transform" type="translate" from="0 0" to="0 35" dur="0.46s" fill="freeze"/>
            <animate attributeName="opacity" from="0.75" to="0" dur="0.46s" fill="freeze"/>
          </circle>
        </>}
      </svg>
  );

  return (
      <div className="egg-overlay" onClick={e => e.stopPropagation()}>
        {flames.map(fl => (
            <span key={fl.id} className="egg-flame-particle" style={{ left: fl.x, top: fl.y }}>🔥</span>
        ))}
        <div className="egg-box">
          <button className="egg-exit-btn" onClick={onClose} title="Exit game">✕</button>

          {phase === 'intro' && (<>
            <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>🥚</div>
            <h2 className="egg-title">YOU FOUND THE EGG!</h2>
            <p className="egg-sub">Think your finger is fit? Prove it.</p>
            <p className="egg-desc">Tap the arm as fast as you can in <strong>30 seconds</strong>. One tap = one curl. 💀</p>
            {hsAtStart > 0 && <p className="egg-hs">🏅 Best: <strong>{hsAtStart} curls</strong></p>}
            <button className="egg-start-btn" onClick={startGame}>LET'S CURL 💪</button>
            <button className="egg-close-btn" onClick={onClose}>nah I'm good</button>
          </>)}

          {phase === 'playing' && (<>
            <div className="egg-mini-header">
              <div className="egg-score-big">{clicks}</div>
              <div className="egg-timer-big" style={{ color: timeLeft <= 10 ? '#ff4500' : 'white' }}>{timeLeft}s</div>
            </div>
            <div className="egg-arm-wrap"
                 onPointerDown={handleDown}
                 onPointerUp={handleUp}
                 onPointerLeave={handleUp}
                 style={{ touchAction: 'none', userSelect: 'none', cursor: 'pointer' }}
            >
              <ArmWithDumbbell curled={curlUp} />
              {clicks === 0 && <p className="egg-tap-hint">TAP TO CURL</p>}
            </div>
            <div className="egg-goal-row">
              {[50, 90, 150].map(threshold => (
                  <span key={threshold} className={`egg-goal-icon ${clicks >= threshold ? 'achieved' : ''}`} title={`${threshold} curls`}>
                                {threshold === 50 ? '😤' : threshold === 90 ? '💪' : '🏆'}
                    <span className="egg-goal-num">{threshold}</span>
                            </span>
              ))}
            </div>
          </>)}

          {phase === 'done' && (<>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎉</div>
            <h2 className="egg-title">{rank}</h2>
            <div className="egg-final-score">{clicks}</div>
            <p className="egg-sub">curls in 30 seconds</p>
            {isNewHS && <p className="egg-new-hs">🔥 NEW PERSONAL RECORD!</p>}
            {!isNewHS && hsAtStart > 0 && <p className="egg-hs">🏅 Best: {finalHS}</p>}
            <div className="egg-btn-row">
              <button className="egg-start-btn" onClick={startGame}>GO AGAIN</button>
              <button className="egg-close-btn" onClick={onClose}>I need to rest 😅</button>
            </div>
          </>)}
        </div>
      </div>
  );
}

function WorkoutTimer({ isRunning, onToggle, onReset, onTick }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(s => {
          const next = s + 1;
          if (onTick) onTick(next);
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    setSeconds(0);
    if (onTick) onTick(0);
    onReset();
  };

  return (
      <div className={`workout-timer${isRunning ? ' running' : ''}`}>
        <div className="timer-icon">⏱️</div>
        <div className="timer-content">
          <span className="timer-label">WORKOUT TIME</span>
          <div className="timer-display">{formatTime(seconds)}</div>
        </div>
        <div className="timer-controls">
          <button className={`timer-btn ${isRunning ? 'pause' : 'start'}`} onClick={onToggle}>
            {isRunning ? '⏸️ Pause' : '▶️ Start'}
          </button>
          <button className="timer-btn reset" onClick={handleReset}>
            🔄 Reset
          </button>
        </div>
      </div>
  );
}

// ============================================
// VOICE SELECTOR COMPONENT — OpenAI TTS
// ============================================
function VoiceSelector() {
  const [apiKey, setApiKeyState] = useState(openaiApiKey);
  const [voice, setVoiceState] = useState(openaiVoice);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(openaiApiKey ? 'saved' : 'none');
  const [showPanel, setShowPanel] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setStatus('testing');
    setErrorDetail('');
    setOAIKey(apiKey.trim());

    // Test the key with a short phrase
    let ok = false;
    try {
      const resp = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          input: "OpenAI voice is now active. Let's crush this workout!",
          voice: openaiVoice,
          speed: 1.0,
          response_format: 'mp3',
        }),
      });

      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        if (currentTTSAudio) { currentTTSAudio.pause(); currentTTSAudio = null; }
        currentTTSAudio = new Audio(url);
        currentTTSAudio.onended = () => { URL.revokeObjectURL(url); currentTTSAudio = null; };
        currentTTSAudio.play().catch(() => {});
        ok = true;
      } else {
        let errMsg = `Error ${resp.status}`;
        try {
          const j = await resp.json();
          errMsg = j?.error?.message || errMsg;
        } catch(e) {}
        setErrorDetail(errMsg);
      }
    } catch (e) {
      setErrorDetail(e.message?.includes('fetch') || e.message?.includes('Failed')
          ? 'Network blocked — make sure you are running this app locally (npm start), not inside an iframe.'
          : e.message || 'Unknown error');
    }

    setStatus(ok ? 'saved' : 'error');
  };

  const handleVoiceChange = (id) => {
    setVoiceState(id);
    // Preview the voice immediately on click
    if (openaiApiKey && status === 'saved') {
      const previews = {
        nova:    "Hey! I'm Nova. Let's get those gains!",
        shimmer: "Hi there! Shimmer here — ready to crush it?",
        coral:   "Hey! Coral speaking. Time to work!",
        sage:    "Hello. I'm Sage. Let's train smart today.",
        alloy:   "What's up! Alloy here. Let's get moving!",
        onyx:    "Onyx. Let's build something powerful today.",
        fable:   "Hey! Fable here — your workout starts now.",
        ash:     "Hi. I'm Ash. Ready when you are.",
        ballad:  "Ballad here. Let's make today count.",
      };
      speakWithOpenAI(previews[id] || `This is the ${id} voice.`, null, id);
    }
  };

  const handleConfirmVoice = () => {
    setOAIVoice(voice);
    if (openaiApiKey && status === 'saved') {
      speakWithOpenAI(`Hi! This is the ${voice} voice. Let's crush this workout!`);
    }
    setShowPanel(false);
  };

  return (
      <div className="voice-selector-wrap">
        <button className="voice-toggle-btn" onClick={() => setShowPanel(!showPanel)}>
          🔊 {status === 'saved' ? <span className="ai-voice-badge">AI Voice ✓</span> : 'Voice'}
        </button>

        {showPanel && (
            <div className="voice-panel">
              <div className="voice-panel-header">
                <span>🎙️ Pick Your Voice</span>
                <button className="voice-panel-close" onClick={() => setShowPanel(false)}>✕</button>
              </div>

              {/* Voice cards — all visible, no dropdown */}
              <div className="voice-card-list">
                {OPENAI_TTS_VOICES.map(v => (
                    <button
                        key={v.id}
                        className={`voice-card ${voice === v.id ? 'selected' : ''}`}
                        onClick={() => handleVoiceChange(v.id)}
                    >
                      {v.label}
                    </button>
                ))}
              </div>

              {/* Confirm button */}
              <button className="voice-confirm-btn" onClick={handleConfirmVoice}>
                ✅ Confirm Voice
              </button>

              {status === 'saved' && (
                  <div className="voice-status-ok">✅ <strong>AI Voice active!</strong></div>
              )}

              {/* Advanced — collapsed by default */}
              <details className="voice-advanced">
                <summary>🔑 Advanced: Connect OpenAI Key for human voice</summary>
                <p className="voice-adv-note">Without a key the app uses your device voice. An OpenAI key ($5 credit lasts months) unlocks dramatically more human-sounding voices.</p>
                <div className="voice-key-row">
                  <input
                      type={showKey ? 'text' : 'password'}
                      placeholder="sk-proj-..."
                      value={apiKey}
                      onChange={e => { setApiKeyState(e.target.value); setStatus('none'); setErrorDetail(''); }}
                      className="voice-key-input"
                      onKeyPress={e => e.key === 'Enter' && handleSaveKey()}
                      autoComplete="off"
                      spellCheck={false}
                  />
                  <button className="voice-eye-btn" onClick={() => setShowKey(!showKey)}>{showKey ? '🙈' : '👁️'}</button>
                  <button className="voice-save-btn" onClick={handleSaveKey} disabled={status === 'testing' || !apiKey.trim()}>
                    {status === 'testing' ? '⏳' : status === 'saved' ? '✅' : '💾 Save'}
                  </button>
                </div>
                {status === 'error' && <p className="voice-err-detail">❌ {errorDetail || 'Invalid key — check billing at platform.openai.com'}</p>}
              </details>
            </div>
        )}
      </div>
  );
}

// Chatbot Component - uses Claude API for real AI answers
function Chatbot({ userData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(chatApiKey);
  const [keyStatus, setKeyStatus] = useState(chatApiKey ? 'saved' : 'none');
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [showKeyText, setShowKeyText] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: `Hey${userData?.name ? ' ' + userData.name : ''}! 💪 I'm your Gym Buddy AI! Ask me ANYTHING — workouts, nutrition, motivation, or even random stuff. I've got you!` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const historyRef = useRef([]); // conversation memory
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Save key and validate it with a quick test call
  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    setKeyStatus('testing');
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${keyInput.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 5, messages: [{ role: 'user', content: 'Hi' }] })
      });
      if (res.ok) {
        setChatApiKey(keyInput.trim());
        if (!openaiApiKey) setOAIKey(keyInput.trim()); // also activate voice if not set
        setKeyStatus('saved');
        setShowKeyPanel(false);
        setMessages(prev => [...prev, { role: 'bot', text: `🎉 Real AI unlocked! I'm now powered by GPT-4o Mini — ask me literally anything, ${userData?.name || 'champ'}! 💪🔥` }]);
      } else {
        const j = await res.json().catch(() => ({}));
        setKeyStatus('error:' + (j?.error?.message || `HTTP ${res.status}`));
      }
    } catch(e) {
      setKeyStatus(`error:Network error — make sure you're running npm start locally`);
    }
  };

  const getRealAIReply = async (userMsg) => {
    const ctx = userData
        ? `User: ${userData.name||'?'}, ${userData.age||'?'}yo, ${userData.weight||'?'}lbs, ${userData.feet||'?'}'${userData.inches||0}" tall, BMI ${userData.bmi||'?'}. Goal: ${userData.goal||'not set'}, focus: ${userData.targetArea||'not set'}.`
        : '';

    const systemMsg = `You are Gym Buddy AI — an energetic, funny, hype personal trainer and best friend. ${ctx}
Rules: Keep answers to 2-4 sentences max. Use 1-3 emojis. Answer EVERY question — fitness, random, funny, weird, anything. Never refuse. Fitness questions: give real expert advice. Off-topic: play along then tie back to fitness. Always end with energy or motivation.`;

    const apiMessages = [
      { role: 'system', content: systemMsg },
      ...historyRef.current,
      { role: 'user', content: userMsg }
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${chatApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 200, messages: apiMessages })
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error('empty response');

    // Keep last 10 turns of memory so it remembers context
    historyRef.current = [
      ...historyRef.current,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: reply }
    ].slice(-20);

    return reply;
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    let reply;
    try {
      reply = chatApiKey ? await getRealAIReply(userMsg) : getAIResponse(userMsg, userData);
    } catch(e) {
      console.warn('AI chat error:', e.message);
      reply = getAIResponse(userMsg, userData);
    }

    setMessages(prev => [...prev, { role: 'bot', text: reply }]);
    setIsTyping(false);
    speak(reply.replace(/\n/g, ' ').replace(/[*#]/g, ''));
  };

  const isError = keyStatus.startsWith('error:');
  const errorMsg = isError ? keyStatus.slice(6) : '';

  return (
      <div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
        <button className={`chatbot-toggle ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(o => !o)}>
          <span className="chatbot-icon">{isOpen ? '✕' : '🤖'}</span>
          {!isOpen && <span className="chatbot-pulse"></span>}
        </button>
        {!isOpen && <span className="chatbot-label">AI{chatApiKey ? ' ✓' : ''}</span>}

        {isOpen && (
            <div className="chatbot-window">
              <div className="chatbot-header">
                <div className="chatbot-avatar-large">🤖</div>
                <div className="chatbot-title">
                  <h4>Gym Buddy AI</h4>
                  <span className="online-status">
                                {chatApiKey ? '● GPT-4o Mini — Real AI' : '● Basic Mode'}
                            </span>
                </div>
                <button
                    className={`chatbot-key-btn ${chatApiKey ? 'keyed' : ''}`}
                    onClick={() => setShowKeyPanel(p => !p)}
                    title="OpenAI API key settings"
                >{chatApiKey ? '🔑✓' : '🔑 Add Key'}</button>
              </div>

              {showKeyPanel && (
                  <div className="chatbot-key-panel">
                    <p className="ckp-title">🧠 Unlock Real AI</p>
                    <p className="ckp-sub">Add your OpenAI key to power the chatbot with GPT-4o Mini — real intelligent responses, not scripted ones.</p>
                    <ol className="ckp-steps">
                      <li>Go to <strong>platform.openai.com</strong> → <em>API Keys</em></li>
                      <li>Click <em>Create new secret key</em>, copy it</li>
                      <li>Add a payment method — <strong>$5 credit lasts months</strong> for chat</li>
                    </ol>
                    <div className="ckp-row">
                      <input
                          type={showKeyText ? 'text' : 'password'}
                          placeholder="sk-proj-..."
                          value={keyInput}
                          onChange={e => { setKeyInput(e.target.value); setKeyStatus('none'); }}
                          className="ckp-input"
                          onKeyPress={e => e.key === 'Enter' && handleSaveKey()}
                          autoComplete="off" spellCheck={false}
                      />
                      <button className="ckp-eye" onClick={() => setShowKeyText(s => !s)}>{showKeyText ? '🙈' : '👁️'}</button>
                      <button className="ckp-save" onClick={handleSaveKey} disabled={keyStatus === 'testing' || !keyInput.trim()}>
                        {keyStatus === 'testing' ? '⏳' : keyStatus === 'saved' ? '✅' : '💾 Save'}
                      </button>
                    </div>
                    {keyStatus === 'saved' && <p className="ckp-ok">✅ Real AI is active!</p>}
                    {isError && <p className="ckp-err">❌ {errorMsg}</p>}
                  </div>
              )}

              <div className="chatbot-messages">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      {msg.role === 'bot' && <span className="bot-avatar">🤖</span>}
                      <div className="message-bubble">
                        {msg.text.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}
                      </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="chat-message bot">
                      <span className="bot-avatar">🤖</span>
                      <div className="message-bubble typing">
                        <span className="dot"/><span className="dot"/><span className="dot"/>
                      </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chatbot-suggestions">
                {['How do I lose weight?', 'Best exercises?', 'Motivate me!'].map((s, i) => (
                    <button key={i} className="suggestion-btn" onClick={() => { setInput(s); }}>
                      {s}
                    </button>
                ))}
              </div>

              <div className="chatbot-input">
                <input
                    type="text"
                    placeholder={chatApiKey ? 'Ask me anything...' : 'Ask me anything (add key for real AI)...'}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                />
                <button onClick={handleSend} disabled={!input.trim() || isTyping}>
                  <span>Send</span><span className="send-icon">→</span>
                </button>
              </div>
            </div>
        )}
      </div>
  );
}

// ============================================
// CONGRATS / CELEBRATION SCREEN
// ============================================
const RECOVERY_TIPS = [
  { icon: '💧', tip: 'Drink 16–24 oz of water RIGHT NOW to rehydrate your muscles.' },
  { icon: '😴', tip: 'Sleep 7–9 hours tonight — that\'s when your muscles actually grow.' },
  { icon: '🥩', tip: 'Get protein in within 45 minutes. Chicken, eggs, or a shake all work.' },
  { icon: '🧘', tip: 'Spend 5 minutes stretching now. It cuts soreness in half tomorrow.' },
  { icon: '📆', tip: 'Rest the same muscles for 48 hours. Your next session will be stronger.' },
  { icon: '🍌', tip: 'Eat a banana. Potassium fights cramps and refuels glycogen fast.' },
  { icon: '🧊', tip: 'If you\'re sore, a cold shower for 2 minutes reduces inflammation fast.' },
  { icon: '📝', tip: 'Log how you felt today. Tracking progress is what separates good athletes from great ones.' },
];

function CongratsScreen({ userData, workoutHistory, onContinue, workoutPlan }) {
  const [confetti, setConfetti] = useState([]);
  const [tip] = useState(() => RECOVERY_TIPS[Math.floor(Math.random() * RECOVERY_TIPS.length)]);

  useEffect(() => {
    const pieces = Array.from({ length: 70 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.8,
      duration: 2.2 + Math.random() * 2,
      color: ['#ff4500','#ffaa00','#ff6b35','#ffcc00','#ff3b5c','#3bffd8','#e8ff3b','#ff69b4'][Math.floor(Math.random()*8)],
      size: 7 + Math.random() * 14,
      shape: Math.random() > 0.5 ? 'circle' : 'square',
    }));
    setConfetti(pieces);

    const totalCal = workoutPlan?.reduce((s, w) => s + w.calories, 0) || 0;
    speak(`LETS GO ${userData?.name || 'champion'}! You just absolutely crushed that workout! ${totalCal > 0 ? `You burned around ${totalCal} calories!` : ''} You are unstoppable! Keep showing up like this and you will reach every single goal you set!`);

    // Cancel voice when navigating away so it never plays on next screen
    return () => cancelAllSpeech();
  }, []);

  const totalWorkouts = workoutHistory?.length || 1;
  const streak = (() => {
    if (!workoutHistory || workoutHistory.length === 0) return 1;
    let s = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const ds = d.toDateString();
      if (workoutHistory.some(h => {
        try { return new Date(h.date).toDateString() === ds; } catch { return h.date?.includes(ds.split(' ')[0]); }
      })) { s++; } else if (i > 0) break;
    }
    return Math.max(s, 1);
  })();

  const totalCal = workoutPlan?.reduce((s, w) => s + w.calories, 0) || 0;

  return (
      <div className="congrats-screen">
        {confetti.map(p => (
            <div key={p.id} className="confetti-piece" style={{
              left: `${p.x}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              background: p.color,
              width: p.size,
              height: p.size,
              borderRadius: p.shape === 'circle' ? '50%' : '2px',
            }} />
        ))}

        <div className="congrats-content">
          <div className="congrats-emoji-burst">
            <span className="burst-main">🏆</span>
            <span className="burst-side left">💪</span>
            <span className="burst-side right">🔥</span>
          </div>

          <h1 className="congrats-title">WORKOUT<br/>COMPLETE!</h1>
          <p className="congrats-sub">You absolutely crushed it, {userData?.name || 'champion'}!</p>

          <div className="congrats-stats">
            <div className="congrats-stat">
              <span className="cstat-num">{totalWorkouts}</span>
              <span className="cstat-label">Workouts Total</span>
            </div>
            <div className="congrats-stat">
              <span className="cstat-num">{streak}🔥</span>
              <span className="cstat-label">Day Streak</span>
            </div>
            <div className="congrats-stat">
              <span className="cstat-num">{totalCal > 0 ? `~${totalCal}` : '💯'}</span>
              <span className="cstat-label">{totalCal > 0 ? 'Cal Burned' : 'Completed'}</span>
            </div>
          </div>

          {/* SINGLE RECOVERY TIP */}
          <div className="recovery-tip-box">
            <span className="recovery-tip-icon">{tip.icon}</span>
            <div className="recovery-tip-text">
              <strong>Coach's Tip</strong>
              <p>{tip.tip}</p>
            </div>
          </div>

          <button className="congrats-btn" onClick={onContinue}>
            📊 See My Progress
          </button>
        </div>
      </div>
  );
}

// ============================================
// CALENDAR TAB COMPONENT
// ============================================
function CalendarTab({ workoutHistory, isHome }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build map: dateKey -> array of entries (supports multiple workouts per day)
  const workoutMap = {};
  if (workoutHistory) {
    workoutHistory.forEach(entry => {
      try {
        const d = new Date(entry.date);
        if (!isNaN(d)) {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (!workoutMap[key]) workoutMap[key] = [];
          workoutMap[key].push(entry);
        }
      } catch {}
    });
  }

  const today = new Date();
  const prevMonth = () => { setSelectedDay(null); setViewDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1);
    if (next <= new Date(today.getFullYear(), today.getMonth(), 1)) { setSelectedDay(null); setViewDate(next); }
  };

  const totalThisMonth = Object.keys(workoutMap).filter(ds => {
    const [y, m] = ds.split('-').map(Number);
    return y === year && m === month;
  }).length;

  // Count gym vs home this month
  let gymCount = 0, homeCount = 0;
  Object.entries(workoutMap).forEach(([ds, entries]) => {
    const [y, m] = ds.split('-').map(Number);
    if (y === year && m === month) {
      entries.forEach(e => { if (e.location === 'home') homeCount++; else gymCount++; });
    }
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedKey = selectedDay ? `${year}-${month}-${selectedDay}` : null;
  const selectedEntries = selectedKey ? (workoutMap[selectedKey] || []) : [];

  return (
      <div className={`calendar-tab${isHome ? ' home-theme' : ''}`}>
        <div className="calendar-header-row">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <div className="cal-title">
            <h2>{monthName} {year}</h2>
            <span className="cal-month-count">{totalThisMonth} workout{totalThisMonth !== 1 ? 's' : ''} this month</span>
          </div>
          <button className="cal-nav-btn" onClick={nextMonth} disabled={month === today.getMonth() && year === today.getFullYear()}>›</button>
        </div>

        {/* Gym vs Home summary bar */}
        {(gymCount > 0 || homeCount > 0) && (
            <div className="cal-location-bar">
              {gymCount > 0 && <span className="cal-loc-tag gym-tag">🏋️ {gymCount} Gym</span>}
              {homeCount > 0 && <span className="cal-loc-tag home-tag">🏠 {homeCount} Home</span>}
            </div>
        )}

        <div className="calendar-grid">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="cal-day-label">{d}</div>
          ))}
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="cal-cell empty" />;
            const key = `${year}-${month}-${day}`;
            const entries = workoutMap[key] || [];
            const hasWorkout = entries.length > 0;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isFuture = new Date(year, month, day) > today;
            const isSelected = selectedDay === day;

            // Determine location type for color coding
            const hasGym = entries.some(e => !e.location || e.location === 'gym');
            const hasHome = entries.some(e => e.location === 'home');
            const locationClass = hasGym && hasHome ? 'both-workout' : hasHome ? 'home-workout' : hasWorkout ? 'gym-workout' : '';

            return (
                <div key={key}
                     className={`cal-cell ${locationClass} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''} ${isSelected ? 'selected-day' : ''}`}
                     onClick={() => hasWorkout && setSelectedDay(isSelected ? null : day)}
                     style={{ cursor: hasWorkout ? 'pointer' : 'default' }}
                >
                  <span className="cal-day-num">{day}</span>
                  {hasGym && !hasHome && <span className="cal-dot gym-dot">🏋️</span>}
                  {hasHome && !hasGym && <span className="cal-dot home-dot">🏠</span>}
                  {hasGym && hasHome && <span className="cal-dot both-dot">💪</span>}
                </div>
            );
          })}
        </div>

        {/* Day detail popup */}
        {selectedEntries.length > 0 && (
            <div className="cal-day-detail">
              <div className="cal-detail-header">
                <span>{monthName} {selectedDay}</span>
                <button className="cal-detail-close" onClick={() => setSelectedDay(null)}>✕</button>
              </div>
              {selectedEntries.map((e, i) => (
                  <div key={i} className={`cal-detail-entry ${e.location === 'home' ? 'detail-home' : 'detail-gym'}`}>
                    <div className="cal-detail-loc">{e.location === 'home' ? '🏠 Home Workout' : '🏋️ Gym Workout'}</div>
                    <div className="cal-detail-row"><strong>Goal:</strong> {e.goal}</div>
                    <div className="cal-detail-row"><strong>Focus:</strong> {e.focus}</div>
                    <div className="cal-detail-row"><strong>Exercises:</strong> {e.exerciseCount} · <strong>Calories:</strong> ~{e.calories}</div>
                    {e.duration && <div className="cal-detail-row"><strong>Duration:</strong> {e.duration}</div>}
                    <div className="cal-detail-row"><strong>Time:</strong> {e.time}</div>
                  </div>
              ))}
            </div>
        )}

        <div className="cal-legend">
          <div className="cal-legend-item"><div className="cal-legend-dot gym-dot-l" /><span>Gym Day</span></div>
          <div className="cal-legend-item"><div className="cal-legend-dot home-dot-l" /><span>Home Day</span></div>
          <div className="cal-legend-item"><div className="cal-legend-dot today-dot" /><span>Today</span></div>
          <div className="cal-legend-item"><div className="cal-legend-dot rest-dot" /><span>Rest Day</span></div>
        </div>

        {workoutHistory && workoutHistory.length === 0 && (
            <div className="cal-empty-msg">
              <span>🗓️</span>
              <p>Complete workouts to see them marked on your calendar!</p>
            </div>
        )}
      </div>
  );
}

// ============================================
// LOGIN SCREEN COMPONENT
// ============================================
function LoginScreen({ onLogin, onSignup, onGuest }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');

  const getAccounts = () => {
    try { return JSON.parse(localStorage.getItem('gymBuddyAccounts') || '{}'); }
    catch { return {}; }
  };

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) { setError('Please fill in all fields.'); return; }
    const accounts = getAccounts();
    if (!accounts[username.toLowerCase()]) { setError('Account not found. Please sign up first.'); return; }
    if (accounts[username.toLowerCase()].password !== password) { setError('Incorrect password.'); return; }
    setError('');
    onLogin(username.toLowerCase(), accounts[username.toLowerCase()]);
  };

  const handleSignup = () => {
    if (!username.trim() || !password.trim()) { setError('Please fill in all fields.'); return; }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters.'); return; }
    if (username.length < 2) { setError('Username must be at least 2 characters.'); return; }
    const accounts = getAccounts();
    if (accounts[username.toLowerCase()]) { setError('Username already taken. Please log in.'); return; }
    const newAccount = { password, userData: null, workoutHistory: [] };
    accounts[username.toLowerCase()] = newAccount;
    localStorage.setItem('gymBuddyAccounts', JSON.stringify(accounts));
    setError('');
    onLogin(username.toLowerCase(), newAccount);
  };

  return (
      <div className="login-screen">
        <div className="flames-container">
          <div className="flame-glow"></div>
          {[...Array(12)].map((_, i) => <div key={i} className="flame"></div>)}
          {[...Array(6)].map((_, i) => <div key={i+12} className="flame-inner"></div>)}
        </div>
        <div className="login-box">
          <div className="login-logo">
            <span className="login-logo-icon">🏋️</span>
            <h1 className="login-title">GYM BUDDY</h1>
            <p className="login-subtitle">Your AI-Powered Fitness Companion</p>
          </div>
          <div className="login-tabs">
            <button className={`login-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>Log In</button>
            <button className={`login-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError(''); }}>Sign Up</button>
          </div>
          <div className="login-form">
            <input className="login-input" type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} onKeyPress={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())} />
            <input className="login-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyPress={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())} />
            {mode === 'signup' && (
                <input className="login-input" type="password" placeholder="Confirm Password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSignup()} />
            )}
            {error && <p className="login-error">{error}</p>}
            <button className="login-btn" onClick={mode === 'login' ? handleLogin : handleSignup}>
              {mode === 'login' ? '🔓 Log In' : '🚀 Create Account'}
            </button>
            <button className="guest-btn" onClick={onGuest}>Continue as Guest (no save)</button>
          </div>
        </div>
      </div>
  );
}

// ============================================
// WORKOUT HISTORY TAB COMPONENT
// ============================================
function HistoryTab({ history }) {
  const [expanded, setExpanded] = useState(null);

  if (!history || history.length === 0) {
    return (
        <div className="history-empty">
          <span className="history-empty-icon">📋</span>
          <h3>No Workouts Yet</h3>
          <p>Complete your first workout to see your history here!</p>
        </div>
    );
  }

  const sorted = [...history].reverse();

  return (
      <div className="history-table">
        {/* Header row */}
        <div className="ht-header-row">
          <span>DATE</span>
          <span>FOCUS</span>
          <span>🔥 CAL</span>
          <span>⏱ TIME</span>
          <span></span>
        </div>
        {sorted.map((entry, idx) => (
            <div key={idx} className={`ht-row-wrap ${expanded === idx ? 'open' : ''}`}>
              <div className="ht-row" onClick={() => setExpanded(expanded === idx ? null : idx)}>
                        <span className="ht-date">
                            <span className="ht-date-day">{entry.date?.split(',')[0]}</span>
                            <span className="ht-date-full">{entry.date?.split(',').slice(1).join(',').trim()}</span>
                        </span>
                <span className="ht-focus">{entry.focus}</span>
                <span className="ht-cal">{entry.calories}</span>
                <span className="ht-dur">{entry.duration || '—'}</span>
                <span className="ht-chevron">{expanded === idx ? '▲' : '▼'}</span>
              </div>
              {expanded === idx && (
                  <div className="ht-detail-panel">
                    <div className="ht-detail-row">
                      <div className="ht-detail-item">
                        <span className="ht-dl">Goal</span>
                        <span className="ht-dv">{entry.goal}</span>
                      </div>
                      <div className="ht-detail-item">
                        <span className="ht-dl">Exercises</span>
                        <span className="ht-dv">{entry.exerciseCount}</span>
                      </div>
                      <div className="ht-detail-item">
                        <span className="ht-dl">Time</span>
                        <span className="ht-dv">{entry.time}</span>
                      </div>
                    </div>
                    {entry.exercises?.length > 0 && (
                        <div className="ht-exercises">
                          {entry.exercises.map((ex, i) => (
                              <span key={i} className="ht-ex-tag">✓ {ex}</span>
                          ))}
                        </div>
                    )}
                  </div>
              )}
            </div>
        ))}
      </div>
  );
}

// ============================================
// MAIN APP COMPONENT
// ============================================
function App() {
  const [screen, setScreen] = useState('login');
  const [activeTab, setActiveTab] = useState('workout'); // 'workout' | 'history' | 'calendar'
  const [currentUser, setCurrentUser] = useState(null); // username string or 'guest'
  const [showCongrats, setShowCongrats] = useState(false);
  const [userData, setUserData] = useState({
    name: '',
    age: '',
    weight: '',
    feet: '',
    inches: '',
    bmi: null,
    goal: null,
    targetArea: null,
  });
  const [workoutLocation, setWorkoutLocation] = useState('gym'); // 'gym' | 'home'
  const [waveActive, setWaveActive] = useState(false);
  const [workoutPlan, setWorkoutPlan] = useState([]);
  const [completedWorkouts, setCompletedWorkouts] = useState({});
  const [timerRunning, setTimerRunning] = useState(false);
  const [workoutTimer, setWorkoutTimer] = useState(0); // total seconds elapsed
  const [showBonusWorkout, setShowBonusWorkout] = useState(false);
  const [selectedBonus, setSelectedBonus] = useState(null);
  const [inputErrors, setInputErrors] = useState({});
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [workoutSavedThisSession, setWorkoutSavedThisSession] = useState(false);

  // ---- ACCOUNT HELPERS ----
  const getAccounts = () => {
    try { return JSON.parse(localStorage.getItem('gymBuddyAccounts') || '{}'); }
    catch { return {}; }
  };

  const saveAccountData = (username, data) => {
    if (!username || username === 'guest') return;
    const accounts = getAccounts();
    if (accounts[username]) {
      accounts[username] = { ...accounts[username], ...data };
      localStorage.setItem('gymBuddyAccounts', JSON.stringify(accounts));
    }
  };

  // ---- LOGIN HANDLERS ----
  const handleLogin = (username, accountData) => {
    setCurrentUser(username);
    if (accountData.userData) {
      const saved = accountData.userData;
      setUserData(saved);
      if (saved.bmi && saved.goal && saved.targetArea) {
        if (saved.targetArea === 'loseWeightOnly') {
          setWorkoutPlan(WORKOUTS.loseWeight.loseWeightOnly);
        } else {
          setWorkoutPlan(WORKOUTS[saved.goal][saved.targetArea] || []);
        }
        setScreen('dashboard');
      } else {
        setScreen('greeting');
      }
    } else {
      setScreen('splash');
    }

    let history = accountData.workoutHistory || [];
    // Only show history the user actually earned — clear any previously auto-seeded dummy data
    if (!accountData.hasCompletedRealWorkout) {
      history = [];
    }

    setWorkoutHistory(history);

    // Restore workoutLocation
    if (accountData.workoutLocation) {
      setWorkoutLocation(accountData.workoutLocation);
    }

    // If today's workout was already saved to history, mark session as saved
    // This prevents the congrats screen from re-firing when the user logs back in
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const alreadySavedToday = history.some(h => h.date === todayStr);
    if (alreadySavedToday) {
      setWorkoutSavedThisSession(true);
    }

    if (accountData.completedWorkouts) {
      setCompletedWorkouts(accountData.completedWorkouts);
    }
    speak(`Welcome back ${username}! Let's crush it today!`);
  };

  const handleGuest = () => {
    setCurrentUser('guest');
    setScreen('splash');
  };

  // Load saved data - now only from account system
  useEffect(() => {
    // Check if there's a remembered session
    const remembered = localStorage.getItem('gymBuddySession');
    if (remembered) {
      const { username } = JSON.parse(remembered);
      const accounts = getAccounts();
      if (accounts[username]) {
        handleLogin(username, accounts[username]);
      }
    }
  }, []);

  // Save functions
  const saveUserData = (newData) => {
    setUserData(newData);
    if (currentUser && currentUser !== 'guest') {
      saveAccountData(currentUser, { userData: newData });
    }
  };

  const saveCompletedWorkouts = (completed) => {
    setCompletedWorkouts(completed);
    if (currentUser && currentUser !== 'guest') {
      saveAccountData(currentUser, { completedWorkouts: completed });
    }
  };

  // Input validation - only allow numbers (validates on submit, not while typing)
  const handleNumberInput = (field, value) => {
    // Remove any non-numeric characters (letters, symbols, etc.)
    const numericValue = value.replace(/[^0-9]/g, '');

    // Always update the field with the cleaned numeric value
    setUserData(prev => ({ ...prev, [field]: numericValue }));
    setInputErrors(prev => ({ ...prev, [field]: null }));
  };

  // ---- DAILY RESET: clear completed workouts from previous days ----
  useEffect(() => {
    const today = new Date().toDateString();
    const lastActiveDay = localStorage.getItem('gymBuddyLastActiveDay');
    if (lastActiveDay && lastActiveDay !== today) {
      const freshCompleted = Object.fromEntries(
          Object.entries(completedWorkouts).filter(([k]) => k.startsWith(today))
      );
      setCompletedWorkouts(freshCompleted);
      setWorkoutSavedThisSession(false);
      setTimerRunning(false);
      setWorkoutTimer(0);
    }
    localStorage.setItem('gymBuddyLastActiveDay', today);
  }, []);

  // Track which checkbox is mid-stamp animation
  const [stampingIndex, setStampingIndex] = useState(null);
  const [showHighFive, setShowHighFive] = useState(false);
  const [holdingIndex, setHoldingIndex] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [checkCooldown, setCheckCooldown] = useState(0); // seconds remaining in between-check cooldown

  // Toggle workout completion - single click, but 3-second cooldown BETWEEN exercises
  // This prevents rapid-fire spam checking without making them hold
  const lastCheckTime = useRef(0);
  const COOLDOWN_MS = 3000; // 3 second buffer between checks

  const handleCheckboxPointerDown = (index) => {}; // unused
  const handleCheckboxPointerUp = (index) => {};   // unused

  const toggleWorkoutComplete = (index) => {
    if (!timerRunning) {
      speak("Start the timer first!");
      return;
    }
    const today = new Date().toDateString();
    const key = `${today}-${index}`;
    const newCompleted = { ...completedWorkouts };

    if (newCompleted[key]) {
      // Uncheck — no cooldown
      delete newCompleted[key];
      saveCompletedWorkouts(newCompleted);
      return;
    }

    // Enforce cooldown between checking NEW exercises
    const now = Date.now();
    const since = now - lastCheckTime.current;
    if (since < COOLDOWN_MS) {
      const remaining = ((COOLDOWN_MS - since) / 1000).toFixed(1);
      setCheckCooldown(Math.ceil(parseFloat(remaining)));
      // Countdown display
      const cd = setInterval(() => {
        setCheckCooldown(prev => {
          if (prev <= 1) { clearInterval(cd); return 0; }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    lastCheckTime.current = now;
    newCompleted[key] = true;
    playStampSound();
    setStampingIndex(index);
    setTimeout(() => setStampingIndex(null), 700);
    const encouragements = [
      "Boom! One more down! You're killing it!",
      "Yes! That's the spirit! Keep pushing!",
      "Awesome work! You're making progress!",
      "Crushed it! You're unstoppable!",
      "Nice! Every rep counts! Keep going!"
    ];
    speak(encouragements[Math.floor(Math.random() * encouragements.length)]);
    saveCompletedWorkouts(newCompleted);
  };

  const isWorkoutComplete = (index) => {
    const today = new Date().toDateString();
    const key = `${today}-${index}`;
    return completedWorkouts[key] || false;
  };

  const getCompletedCount = () => {
    const today = new Date().toDateString();
    return Object.keys(completedWorkouts).filter(key => key.startsWith(today)).length;
  };

  // Ref guard — prevents saveWorkoutToHistory from firing twice even across renders
  const savingRef = useRef(false);

  // Save workout to history when all exercises are done
  const saveWorkoutToHistory = () => {
    if (workoutSavedThisSession || savingRef.current) return;
    savingRef.current = true;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const currentGoal = GOALS.find(g => g.id === userData.goal);
    const currentBodyPart = BODY_PARTS.find(b => b.id === userData.targetArea);
    const totalCalories = workoutPlan.reduce((sum, w) => sum + w.calories, 0);

    const formatDuration = (secs) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}m ${s}s`;
    };

    const entry = {
      date: dateStr,
      time: timeStr,
      goal: currentGoal?.name || 'N/A',
      focus: currentBodyPart?.name || 'N/A',
      exerciseCount: workoutPlan.length,
      calories: totalCalories,
      duration: workoutTimer > 0 ? formatDuration(workoutTimer) : null,
      exercises: workoutPlan.map(w => w.name),
      location: workoutLocation, // 'gym' or 'home'
    };

    const newHistory = [...workoutHistory, entry];
    setWorkoutHistory(newHistory);
    setWorkoutSavedThisSession(true);

    if (currentUser && currentUser !== 'guest') {
      saveAccountData(currentUser, { workoutHistory: newHistory, hasCompletedRealWorkout: true });
    }

    // High five animation first, THEN congrats screen (only if timer was actually running)
    if (workoutTimer > 0) {
      setShowHighFive(true);
      setTimeout(() => {
        setShowHighFive(false);
        setShowCongrats(true);
      }, 3400);
    } else {
      setTimeout(() => setShowCongrats(true), 400);
    }
  };

  // Check if all done and auto-save
  useEffect(() => {
    if (showCongrats) return; // already showing, don't re-trigger
    const completedCount = getCompletedCount();
    const allComplete = completedCount === workoutPlan.length && workoutPlan.length > 0;
    if (allComplete && !workoutSavedThisSession) {
      saveWorkoutToHistory();
    }
  }, [completedWorkouts]);

  // Navigation handlers
  const handleEnter = () => {
    setScreen('greeting');
    speak("Welcome to Gym Buddy! Your AI fitness companion. Ready to crush your goals?");
  };

  const handleContinue = () => {
    setScreen('questions');
    speak("Let's personalize your experience. Tell me about yourself!");
  };

  const handleSubmitInfo = () => {
    // Validate all fields
    if (!userData.name.trim()) {
      speak("Hey, I need your name to personalize your experience!");
      return;
    }
    if (!userData.age || parseInt(userData.age) < 10 || parseInt(userData.age) > 120) {
      speak("Please enter a valid age between 10 and 120.");
      return;
    }
    if (!userData.weight || parseInt(userData.weight) < 50 || parseInt(userData.weight) > 700) {
      speak("Please enter a valid weight between 50 and 700 pounds.");
      return;
    }
    if (!userData.feet || parseInt(userData.feet) < 3 || parseInt(userData.feet) > 8) {
      speak("Please enter a valid height. Feet should be between 3 and 8.");
      return;
    }

    const totalInches = (parseFloat(userData.feet) * 12) + (parseFloat(userData.inches) || 0);
    const weightLbs = parseFloat(userData.weight);
    const calculatedBmi = ((weightLbs / (totalInches * totalInches)) * 703).toFixed(1);

    const newData = { ...userData, bmi: calculatedBmi };
    saveUserData(newData);
    setScreen('goals');

    speak(`Great to meet you ${userData.name}! Your BMI is ${calculatedBmi}. Now let's talk about your fitness goals. What are you looking to achieve?`);
  };

  const handleSelectGoal = (goalId) => {
    const newData = { ...userData, goal: goalId };
    saveUserData(newData);
    setScreen('location');
    const goal = GOALS.find(g => g.id === goalId);
    speak(`${goal.name}! Great choice! Will you be working out at home or at the gym today?`);
  };

  const handleSelectLocation = (loc) => {
    setWaveActive(true);
    setTimeout(() => {
      setWorkoutLocation(loc);
      setScreen('bodyParts');
    }, 480);
    setTimeout(() => setWaveActive(false), 1050);
    speak(loc === 'home'
        ? "Home workout it is! No equipment needed. Pick your focus area."
        : "Gym workout! Let's pick your target area and crush it.");
  };

  const handleSwitchLocation = (loc) => {
    if (loc === workoutLocation) return;
    setWaveActive(true);
    // Switch content while screen is fully covered (480ms = peak of wave-in)
    setTimeout(() => {
      setWorkoutLocation(loc);
      saveAccountData(currentUser, { workoutLocation: loc });
      const source = loc === 'home' ? AT_HOME_WORKOUTS : WORKOUTS;
      const bodyPartId = userData.targetArea;
      let workouts;
      if (bodyPartId === 'loseWeightOnly') {
        workouts = source.loseWeight?.loseWeightOnly || WORKOUTS.loseWeight.loseWeightOnly;
      } else {
        workouts = source[userData.goal]?.[bodyPartId] || WORKOUTS[userData.goal]?.[bodyPartId] || [];
      }
      setWorkoutPlan(workouts);
      setCompletedWorkouts({});
      saveAccountData(currentUser, { completedWorkouts: {} });
    }, 480);
    // Deactivate after out phase completes (400ms trigger + 500ms out = 900ms)
    setTimeout(() => setWaveActive(false), 1050);
    speak(loc === 'home' ? "Switching to home workout!" : "Switching to gym workout!");
  };

  const handleSelectBodyPart = (bodyPartId) => {
    const newData = { ...userData, targetArea: bodyPartId };
    saveUserData(newData);

    let workouts;
    const source = workoutLocation === 'home' ? AT_HOME_WORKOUTS : WORKOUTS;
    if (bodyPartId === 'loseWeightOnly') {
      workouts = source.loseWeight?.loseWeightOnly || WORKOUTS.loseWeight.loseWeightOnly;
    } else {
      workouts = source[userData.goal]?.[bodyPartId] || WORKOUTS[userData.goal]?.[bodyPartId] || [];
    }

    setWorkoutPlan(workouts);
    setWorkoutSavedThisSession(false);
    setScreen('dashboard');

    speak(`${workouts.length} exercises ready! Start the timer and let's crush it!`);
  };

  const handleResetGoals = () => {
    setScreen('goals');
    setTimerRunning(false);
    speak("No problem! Let's switch things up. What would you like to focus on now?");
  };

  const handleLogout = () => {
    localStorage.removeItem('gymBuddySession');
    setCurrentUser(null);
    setUserData({ name: '', age: '', weight: '', feet: '', inches: '', bmi: null, goal: null, targetArea: null });
    setWorkoutPlan([]);
    setCompletedWorkouts({});
    setTimerRunning(false);
    setWorkoutTimer(0);
    setWorkoutHistory([]);
    setWorkoutSavedThisSession(false);
    setActiveTab('workout');
    setScreen('login');
  };

  const handleTimerToggle = () => {
    if (!timerRunning) {
      speak("Timer started! Let's get after it! You can now check off your exercises!");
    } else {
      speak("Timer paused. Take a breather, you've earned it!");
    }
    setTimerRunning(!timerRunning);
  };

  const handleTimerReset = () => {
    setTimerRunning(false);
    setWorkoutTimer(0);
    speak("Timer reset! Ready when you are!");
  };

  const handleTimerTick = (secs) => {
    setWorkoutTimer(secs);
  };

  const getBmiInfo = () => {
    const bmi = parseFloat(userData.bmi);
    const isFemale = userData.gender === 'female';
    // Women naturally carry ~5% more body fat — scale adjusts accordingly
    if (isFemale) {
      if (bmi < 18.5) return { category: 'Underweight', color: '#3498db' };
      if (bmi < 24)   return { category: 'Healthy', color: '#2ecc71' };
      if (bmi < 29)   return { category: 'Overweight', color: '#f39c12' };
      return           { category: 'Obese', color: '#e74c3c' };
    } else {
      if (bmi < 18.5) return { category: 'Underweight', color: '#3498db' };
      if (bmi < 25)   return { category: 'Healthy', color: '#2ecc71' };
      if (bmi < 30)   return { category: 'Overweight', color: '#f39c12' };
      return           { category: 'Obese', color: '#e74c3c' };
    }
  };

  // ============================================
  // SCREENS
  // ============================================

  // CONGRATS SCREEN (overlays dashboard)
  if (showCongrats) {
    return <CongratsScreen
        userData={userData}
        workoutHistory={workoutHistory}
        workoutPlan={workoutPlan}
        onContinue={() => {
          cancelAllSpeech();

          // Clear today checkboxes to prevent useEffect re-triggering congrats
          const today = new Date().toDateString();
          const cleared = Object.fromEntries(
              Object.entries(completedWorkouts).filter(([k]) => !k.startsWith(today))
          );
          setCompletedWorkouts(cleared);
          if (currentUser && currentUser !== 'guest') {
            saveAccountData(currentUser, { completedWorkouts: cleared });
          }
          setTimerRunning(false);
          setWorkoutTimer(0);
          setShowCongrats(false);
          setActiveTab('history');
        }}
    />;
  }

  // LOGIN SCREEN
  if (screen === 'login') {
    return <LoginScreen onLogin={handleLogin} onGuest={handleGuest} />;
  }

  // SPLASH SCREEN
  if (screen === 'splash') {
    return (
        <div className="splash-screen">
          <FloatingDumbbells />
          <Flames />
          <div className="splash-content">
            <div className="splash-badge">AI POWERED</div>
            <div className="logo-container">
              <span className="logo-emoji">🏋️</span>
              <div className="logo-ring" />
            </div>
            <h1 className="title">GYM BUDDY</h1>
            <p className="subtitle">Your AI-Powered Fitness Companion</p>
            <div className="splash-divider"><span>BUILT TO PUSH YOU</span></div>
            <div className="splash-features">
              <div className="splash-feature-item">
                <span className="splash-feat-icon">💪</span>
                <span>Personalized Workouts</span>
              </div>
              <div className="splash-feature-item">
                <span className="splash-feat-icon">🤖</span>
                <span>AI Coach 24/7</span>
              </div>
              <div className="splash-feature-item">
                <span className="splash-feat-icon">📊</span>
                <span>Track Progress</span>
              </div>
              <div className="splash-feature-item">
                <span className="splash-feat-icon">🔥</span>
                <span>Burn Calories</span>
              </div>
            </div>
            <button className="enter-button" onClick={handleEnter}>
              <span className="button-text">LET'S GO</span>
              <span className="button-icon">→</span>
            </button>
            <p className="hint">🔊 Enable audio for the best experience</p>
          </div>
        </div>
    );
  }

  // GREETING SCREEN
  if (screen === 'greeting') {
    return (
        <div className="greeting-screen">
          <FloatingDumbbells />
          <Flames />
          <div className="greeting-content">
            <div className="greeting-icon">👋</div>
            <h1>Hey There, Champion!</h1>
            <p className="greeting-text">
              Welcome to <span className="highlight">Gym Buddy</span>
            </p>
            <p className="greeting-subtext">
              I'm your personal AI fitness companion! I'll create custom workouts,
              track your progress, and keep you motivated every step of the way.
              Ready to transform your fitness journey?
            </p>
            <div className="greeting-features">
              <div className="greeting-feature">
                <span className="gf-icon">🎯</span>
                <span className="gf-text">Custom workout plans</span>
              </div>
              <div className="greeting-feature">
                <span className="gf-icon">🤖</span>
                <span className="gf-text">24/7 AI assistance</span>
              </div>
              <div className="greeting-feature">
                <span className="gf-icon">📈</span>
                <span className="gf-text">Track your progress</span>
              </div>
            </div>
            <VoiceSelector />
            <button className="continue-button" onClick={handleContinue}>
              Let's Get Started! 🚀
            </button>
          </div>
          <Chatbot userData={userData} />
        </div>
    );
  }

  // QUESTIONS SCREEN
  if (screen === 'questions') {
    return (
        <div className="questions-screen">
          <FloatingDumbbells />
          <Flames />
          <div className="questions-content">
            <div className="questions-header">
              <span className="questions-icon">📝</span>
              <h1>Tell Me About Yourself</h1>
              <p className="question-subtitle">So I can personalize your experience</p>
            </div>

            <div className="form-container">
              <div className="input-group">
                <label>👤 What's Your Name?</label>
                <input
                    type="text"
                    placeholder="Enter your name"
                    value={userData.name}
                    onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                    maxLength={30}
                />
              </div>

              <div className="input-group">
                <label>⚧ What's Your Biological Sex? <span className="bmi-note">(affects BMI scale)</span></label>
                <div className="gender-toggle">
                  <button
                      className={`gender-btn ${userData.gender === 'male' ? 'active' : ''}`}
                      onClick={() => setUserData(prev => ({ ...prev, gender: 'male' }))}
                      type="button"
                  >♂ Male</button>
                  <button
                      className={`gender-btn ${userData.gender === 'female' ? 'active' : ''}`}
                      onClick={() => setUserData(prev => ({ ...prev, gender: 'female' }))}
                      type="button"
                  >♀ Female</button>
                </div>
              </div>

              <div className="input-group">
                <label>🎂 How Old Are You?</label>
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Age (10 – 120)"
                    value={userData.age}
                    onChange={(e) => handleNumberInput('age', e.target.value)}
                    maxLength={3}
                />
              </div>

              <div className="input-group">
                <label>⚖️ What's Your Weight? (lbs)</label>
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Weight (50 – 700 lbs)"
                    value={userData.weight}
                    onChange={(e) => handleNumberInput('weight', e.target.value)}
                    maxLength={3}
                />
              </div>

              <div className="input-group">
                <label>📏 What's Your Height?</label>
                <div className="height-inputs">
                  <div className="height-field">
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="3 – 8"
                        value={userData.feet}
                        onChange={(e) => handleNumberInput('feet', e.target.value)}
                        maxLength={1}
                    />
                    <span className="height-label">ft</span>
                  </div>
                  <div className="height-field">
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0 – 11"
                        value={userData.inches}
                        onChange={(e) => handleNumberInput('inches', e.target.value)}
                        maxLength={2}
                    />
                    <span className="height-label">in</span>
                  </div>
                </div>
              </div>

              <button className="submit-button" onClick={handleSubmitInfo}>
                <span>Continue</span>
                <span className="btn-emoji">💪</span>
              </button>
            </div>
          </div>
          <Chatbot userData={userData} />
        </div>
    );
  }

  // GOALS SCREEN
  if (screen === 'goals') {
    return (
        <div className="goals-screen">
          <FloatingDumbbells />
          <Flames />
          <div className="goals-content">
            <div className="goals-header">
              <span className="goals-icon">🎯</span>
              <h1>What's Your Goal?</h1>
              <p className="goals-subtitle">Choose what you want to achieve</p>
            </div>
            <div className="goals-container">
              {GOALS.map(goal => (
                  <button key={goal.id} className="goal-card" onClick={() => handleSelectGoal(goal.id)} style={{ '--goal-color': goal.color }}>
                    <div className="goal-glow"></div>
                    <span className="goal-icon">{goal.icon}</span>
                    <h3>{goal.name}</h3>
                    <p>{goal.description}</p>
                    <span className="goal-arrow">→</span>
                  </button>
              ))}
            </div>
          </div>
          <Chatbot userData={userData} />
        </div>
    );
  }

  // LOCATION SCREEN
  if (screen === 'location') {
    return (
        <div className="location-screen">
          <FloatingDumbbells />
          <Flames />
          <div className="location-content">
            <div className="location-header">
              <span className="location-icon">📍</span>
              <h1>Where Are You Working Out?</h1>
              <p className="location-subtitle">We'll tailor your workout to match your environment</p>
            </div>
            <div className="location-cards">
              <button className="location-card gym-card" onClick={() => handleSelectLocation('gym')}>
                <div className="location-card-bg"></div>
                <span className="location-card-emoji">🏋️</span>
                <h2>At the Gym</h2>
                <p>Full equipment available — barbells, machines, cables & more</p>
                <ul className="location-perks">
                  <li>🏅 Machines & free weights</li>
                  <li>🏅 Cables & barbells</li>
                  <li>🏅 Full gym setup</li>
                </ul>
                <span className="location-cta">Let's Lift →</span>
              </button>
              <button className="location-card home-card" onClick={() => handleSelectLocation('home')}>
                <div className="location-card-bg"></div>
                <span className="location-card-emoji">🏠</span>
                <h2>At Home</h2>
                <p>Zero equipment needed — just your bodyweight and motivation</p>
                <ul className="location-perks">
                  <li>🏠 No equipment needed</li>
                  <li>🏠 Any room works</li>
                  <li>🏠 Beginner friendly</li>
                </ul>
                <span className="location-cta">Let's Go →</span>
              </button>
            </div>
          </div>
          <Chatbot userData={userData} />
        </div>
    );
  }

  // BODY PARTS SCREEN
  if (screen === 'bodyParts') {
    const isHome = workoutLocation === 'home';
    const availableBodyParts = userData.goal === 'loseWeight'
        ? BODY_PARTS
        : BODY_PARTS.filter(bp => bp.id !== 'loseWeightOnly');

    return (
        <div className={`bodyparts-screen${isHome ? ' home-theme' : ''}`}>
          <FloatingDumbbells isHome={isHome} />
          <Flames isHome={isHome} />
          <div className="bodyparts-content">
            <div className="bodyparts-header">
              <span className="bodyparts-icon">{isHome ? '🏠' : '💪'}</span>
              <h1>Target Area</h1>
              <p className="bodyparts-subtitle">{isHome ? 'Home workout — no equipment needed' : 'What do you want to focus on?'}</p>
            </div>
            <div className="bodyparts-container">
              {availableBodyParts.map(part => (
                  <button key={part.id} className={`bodypart-card ${part.id === 'loseWeightOnly' ? 'featured' : ''}`} onClick={() => handleSelectBodyPart(part.id)}>
                    <span className="bodypart-icon">{part.icon}</span>
                    <h3>{part.name}</h3>
                    <p>{part.description}</p>
                    {part.id === 'loseWeightOnly' && <span className="featured-badge">RECOMMENDED</span>}
                  </button>
              ))}
            </div>
          </div>
          <Chatbot userData={userData} />
        </div>
    );
  }

  // DASHBOARD SCREEN
  if (screen === 'dashboard') {
    const bmiInfo = getBmiInfo();
    const currentGoal = GOALS.find(g => g.id === userData.goal);
    const currentBodyPart = BODY_PARTS.find(b => b.id === userData.targetArea);
    const totalCalories = workoutPlan.reduce((sum, w) => sum + w.calories, 0);
    const completedCount = getCompletedCount();
    const allComplete = completedCount === workoutPlan.length && workoutPlan.length > 0;
    const progressPercent = (completedCount / workoutPlan.length) * 100;

    const isHome = workoutLocation === 'home';
    return (
        <div className={`dashboard-screen${isHome ? ' home-theme' : ''}`}>
          {showHighFive && <HighFiveAnimation onDone={() => setShowHighFive(false)} />}
          <WaveTransition active={waveActive} isHome={workoutLocation === 'home'} />
          <FloatingDumbbells isHome={isHome} />
          <Flames isHome={isHome} />

          {/* Header */}
          <div className="dashboard-header">
            <div className="user-welcome">
              <div className="welcome-emoji">{isHome ? "🏠" : "🔥"}</div>
              <div className="welcome-text">
                <h1>Let's Go, {userData.name}!</h1>
                <p>{userData.age} yrs • {userData.feet}'{userData.inches || 0}" • {userData.weight} lbs
                  {currentUser && currentUser !== 'guest' && <span className="logged-in-badge"> 🔐 {currentUser}</span>}
                  <span className={`location-badge ${isHome ? 'home-badge' : 'gym-badge'}`}>{isHome ? '🏠 Home Workout' : '🏋️ Gym Workout'}</span>
                </p>
              </div>
            </div>
            <div className="header-actions">
              <VoiceSelector />
              <button className="change-goals-btn" onClick={handleResetGoals}>
                🎯 Change Goals
              </button>
              <button className="logout-btn" onClick={handleLogout}>
                👋 Logout
              </button>
            </div>
          </div>

          {/* TABS */}
          <div className="dashboard-tabs">
            <button className={`dash-tab ${activeTab === 'workout' ? 'active' : ''}`} onClick={() => setActiveTab('workout')}>
              🏋️ Workout
            </button>
            <button className={`dash-tab ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
              📅 Calendar
            </button>
            <button className={`dash-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
              📋 History
            </button>
          </div>

          {/* CALENDAR TAB */}
          {activeTab === 'calendar' && (
              <div className="history-tab-content">
                <CalendarTab workoutHistory={workoutHistory} isHome={isHome} />
              </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
              <div className="history-tab-content">
                <PRTracker workoutHistory={workoutHistory} />
                <h2 className="history-header-title">📋 Your Workout History</h2>
                <HistoryTab history={workoutHistory} />
              </div>
          )}

          {/* WORKOUT TAB */}
          {activeTab === 'workout' && (<>

            {/* 🏠/🏋️ Location Toggle */}
            <div className="location-toggle-bar">
              <span className="location-toggle-label">Workout Location:</span>
              <div className="location-toggle-pills">
                <button
                    className={`loc-pill ${workoutLocation === 'gym' ? 'loc-active-gym' : ''}`}
                    onClick={() => handleSwitchLocation('gym')}
                >🏋️ Gym</button>
                <button
                    className={`loc-pill ${workoutLocation === 'home' ? 'loc-active-home' : ''}`}
                    onClick={() => handleSwitchLocation('home')}
                >🏠 Home</button>
              </div>
            </div>

            {/* 💪 Muscle Map */}
            <MuscleMap targetArea={userData.targetArea} />

            {/* Timer */}
            <WorkoutTimer
                isRunning={timerRunning}
                onToggle={handleTimerToggle}
                onReset={handleTimerReset}
                onTick={handleTimerTick}
            />

            {showEasterEgg && <EasterEggGame onClose={() => setShowEasterEgg(false)} />}

            {/* Cooldown toast */}
            {checkCooldown > 0 && (
                <div className="cooldown-toast">
                  ⏳ Rest {checkCooldown}s before next check-off — no cheating! 😤
                </div>
            )}

            {/* Timer Lock Notice */}
            {!timerRunning && (
                <div className="timer-lock-notice">
                  ⏱️ <strong>Start the timer</strong> to unlock exercise checkboxes!
                  <span className="hidden-egg" onClick={() => setShowEasterEgg(true)} title="...">🥚</span>
                </div>
            )}

            {/* Progress — ring + bar */}
            <div className="progress-section">
              <div className="progress-ring-row">
                <ProgressRing
                    percent={progressPercent}
                    size={110}
                    stroke={10}
                    color={allComplete ? '#00ff88' : (isHome ? '#1976d2' : '#ff4500')}
                />
                <div className="progress-ring-info">
                  <div className="progress-header">
                    <span className="progress-title">TODAY'S PROGRESS</span>
                    <span className="progress-count">{completedCount}/{workoutPlan.length} done</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progressPercent}%` }}>
                      {progressPercent > 15 && <span className="progress-percent">{Math.round(progressPercent)}%</span>}
                    </div>
                  </div>
                  {allComplete
                      ? <div className="progress-complete">🎉 WORKOUT COMPLETE! You crushed it!</div>
                      : <p className="progress-remaining">{workoutPlan.length - completedCount} exercise{workoutPlan.length - completedCount !== 1 ? 's' : ''} left — keep pushing!</p>
                  }
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="dashboard-stats">
              <div className="mini-stat-card bmi-card">
                <span className="mini-stat-icon-top">📊</span>
                <span className="mini-stat-label">BMI</span>
                <span className="mini-stat-value" style={{ color: bmiInfo.color }}>{userData.bmi}</span>
                <span className="mini-stat-category" style={{ color: bmiInfo.color }}>{bmiInfo.category}</span>
              </div>
              <div className="mini-stat-card">
                <span className="mini-stat-icon-top">{currentGoal?.icon}</span>
                <span className="mini-stat-label">Goal</span>
                <span className="mini-stat-value-text">{currentGoal?.name}</span>
              </div>
              <div className="mini-stat-card">
                <span className="mini-stat-icon-top">{currentBodyPart?.icon}</span>
                <span className="mini-stat-label">Focus</span>
                <span className="mini-stat-value-text">{currentBodyPart?.name}</span>
              </div>
              <div className="mini-stat-card calories-card">
                <span className="mini-stat-icon-top">🔥</span>
                <span className="mini-stat-label">Est. Burn</span>
                <span className="mini-stat-value burn">{totalCalories}</span>
                <span className="mini-stat-category">calories</span>
              </div>
            </div>

            {/* Workout Plan */}
            <div className="workout-section">
              <div className="workout-section-header">
                <div>
                  <h2>🏋️ Your Workout Plan</h2>
                  <p className="workout-section-subtitle">
                    {workoutPlan.length} exercises • Start timer, then check off as you complete
                  </p>
                </div>
                <button className="shuffle-btn" onClick={() => {
                  // Shuffle the current workout plan for variety
                  const base = userData.targetArea === 'loseWeightOnly'
                      ? WORKOUTS.loseWeight.loseWeightOnly
                      : (WORKOUTS[userData.goal]?.[userData.targetArea] || []);
                  const shuffled = [...base].sort(() => Math.random() - 0.5);
                  setWorkoutPlan(shuffled);
                  setWorkoutSavedThisSession(false);
                  // Reset today's completed
                  const today = new Date().toDateString();
                  const filtered = Object.fromEntries(Object.entries(completedWorkouts).filter(([k]) => !k.startsWith(today)));
                  saveCompletedWorkouts(filtered);
                  speak("New workout order! Let's mix it up and crush it!");
                }} title="Shuffle exercise order for variety">
                  🔀 Shuffle
                </button>
              </div>

              {/* Motivational quote strip */}
              {(() => {
                const quotes = [
                  "\"The only bad workout is the one that didn't happen.\"",
                  "\"Your body can stand almost anything. It's your mind you have to convince.\"",
                  "\"Sweat is just fat crying. Make it weep. 🔥\"",
                  "\"Every rep is a vote for who you're becoming.\"",
                  "\"Pain is temporary. Glory is forever. Now GO.\"",
                  "\"You didn't come this far to only come this far.\"",
                  "\"Champions aren't made in gyms. They're made from what they have inside.\"",
                  "\"The pain you feel today is the strength you'll feel tomorrow.\"",
                ];
                const q = quotes[new Date().getDate() % quotes.length];
                return <div className="motive-strip">{q}</div>;
              })()}

              <div className="workout-list">
                {workoutPlan.map((workout, index) => (
                    <div key={index} className={`workout-card ${isWorkoutComplete(index) ? 'completed' : ''} ${!timerRunning && !isWorkoutComplete(index) ? 'locked' : ''}`}>
                      <div className="workout-left">
                        <div className="workout-number">{index + 1}</div>
                        <button
                            className={`workout-checkbox ${isWorkoutComplete(index) ? 'checked' : ''} ${!timerRunning ? 'checkbox-locked' : ''} ${stampingIndex === index ? 'stamping' : ''}`}
                            onClick={() => toggleWorkoutComplete(index)}
                            title={!timerRunning ? 'Start the timer to check off exercises' : (isWorkoutComplete(index) ? 'Click to uncheck' : 'Mark complete')}
                        >
                                        <span className="checkbox-inner">
                                            {isWorkoutComplete(index) ? '✓' : (!timerRunning ? '🔒' : '')}
                                        </span>
                          {stampingIndex === index && <span className="stamp-ring" />}
                        </button>
                      </div>
                      <div className="workout-info">
                        <div className="workout-name-row">
                          <h3>{workout.name}</h3>
                          <span className={`difficulty ${workout.difficulty.toLowerCase()}`}>
                      {workout.difficulty}
                    </span>
                          <a
                              href={getYouTubeLink(workout.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="yt-btn"
                              title={`Watch how to do ${workout.name}`}
                              onClick={e => e.stopPropagation()}
                          >
                            ▶ How To
                          </a>
                        </div>
                        <p className="workout-description">{workout.description}</p>
                        <div className="workout-tips">
                          <span className="tip-icon">💡</span>
                          <span>{workout.tips}</span>
                        </div>
                        <div className="workout-stats-row">
                    <span className="workout-stat">
                      <strong>Sets:</strong> {workout.sets}
                    </span>
                          <span className="workout-stat">
                      <strong>Reps:</strong> {workout.reps}
                    </span>
                          <span className="workout-stat">
                      <strong>Rest:</strong> {workout.rest}
                    </span>
                          <span className="workout-stat calories">
                                            <span className="cal-emoji">{isHome ? '💧' : '🔥'}</span> {workout.calories} cal
                                        </span>
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>

            {/* Bonus Workout Section */}
            {allComplete && (
                <div className="bonus-section">
                  <div className="bonus-header">
                    <span className="bonus-emoji">🎉</span>
                    <h2>Workout Complete!</h2>
                    <p>Want a bonus challenge to burn extra calories?</p>
                  </div>

                  <div className="bonus-workouts">
                    {BONUS_WORKOUTS.map((bonus, index) => (
                        <div
                            key={index}
                            className={`bonus-card ${selectedBonus === index ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedBonus(index);
                              speak(`Great choice! ${bonus.name}. ${bonus.description}`);
                            }}
                        >
                          <h4>{bonus.name}</h4>
                          <p className="bonus-exercises">{bonus.exercises}</p>
                          <p className="bonus-description">{bonus.description}</p>
                          <span className="bonus-calories">+{bonus.calories} cal</span>
                        </div>
                    ))}
                  </div>
                </div>
            )}

            {/* BMI Scale */}
            <div className="bmi-section">
              <h3>📊 BMI Scale {userData.gender && <span className="bmi-gender-tag">{userData.gender === 'female' ? '♀ Female' : '♂ Male'}</span>}</h3>
              {userData.gender === 'female' ? (
                  <div className="bmi-scale">
                    <div className={`bmi-range underweight ${parseFloat(userData.bmi) < 18.5 ? 'active' : ''}`}>
                      <span className="range-label">Underweight</span>
                      <span className="range-value">&lt; 18.5</span>
                    </div>
                    <div className={`bmi-range healthy ${parseFloat(userData.bmi) >= 18.5 && parseFloat(userData.bmi) < 24 ? 'active' : ''}`}>
                      <span className="range-label">Healthy</span>
                      <span className="range-value">18.5 – 23.9</span>
                    </div>
                    <div className={`bmi-range overweight ${parseFloat(userData.bmi) >= 24 && parseFloat(userData.bmi) < 29 ? 'active' : ''}`}>
                      <span className="range-label">Overweight</span>
                      <span className="range-value">24 – 28.9</span>
                    </div>
                    <div className={`bmi-range obese ${parseFloat(userData.bmi) >= 29 ? 'active' : ''}`}>
                      <span className="range-label">Obese</span>
                      <span className="range-value">29+</span>
                    </div>
                  </div>
              ) : (
                  <div className="bmi-scale">
                    <div className={`bmi-range underweight ${parseFloat(userData.bmi) < 18.5 ? 'active' : ''}`}>
                      <span className="range-label">Underweight</span>
                      <span className="range-value">&lt; 18.5</span>
                    </div>
                    <div className={`bmi-range healthy ${parseFloat(userData.bmi) >= 18.5 && parseFloat(userData.bmi) < 25 ? 'active' : ''}`}>
                      <span className="range-label">Healthy</span>
                      <span className="range-value">18.5 – 24.9</span>
                    </div>
                    <div className={`bmi-range overweight ${parseFloat(userData.bmi) >= 25 && parseFloat(userData.bmi) < 30 ? 'active' : ''}`}>
                      <span className="range-label">Overweight</span>
                      <span className="range-value">25 – 29.9</span>
                    </div>
                    <div className={`bmi-range obese ${parseFloat(userData.bmi) >= 30 ? 'active' : ''}`}>
                      <span className="range-label">Obese</span>
                      <span className="range-value">30+</span>
                    </div>
                  </div>
              )}
              <div className="bmi-indicator" style={{ left: `${Math.min(Math.max((parseFloat(userData.bmi) - 15) / 25 * 100, 0), 100)}%` }}>
                <span className="bmi-arrow">▼</span>
                <span className="bmi-your">Your BMI: {userData.bmi}</span>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="disclaimer-box">
              <h4>⚠️ Important Note About BMI</h4>
              <p>
                BMI is a general screening tool and doesn't tell the whole story. It doesn't account for:
              </p>
              <ul>
                <li><strong>Muscle mass</strong> - Athletes may show "overweight" but be very fit</li>
                <li><strong>Age</strong> - Body composition changes as we age</li>
                <li><strong>Gender</strong> - Men and women have different body compositions</li>
                <li><strong>Bone density</strong> - Some people naturally have denser bones</li>
              </ul>
              <p className="disclaimer-advice">
                Always consult with a healthcare professional for a complete health assessment.
              </p>
            </div>

            {/* Source */}
            <div className="source-box">
              <h4>📊 BMI Formula & Sources</h4>
              <p className="formula">BMI = (weight in lbs ÷ height in inches²) × 703</p>
              <div className="sources">
                <p><strong>Sources:</strong></p>
                <ul>
                  <li>
                    <a href="https://www.cdc.gov/bmi/adult-calculator/index.html" target="_blank" rel="noopener noreferrer">
                      CDC - Centers for Disease Control and Prevention
                    </a>
                  </li>
                  <li>
                    <a href="https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight" target="_blank" rel="noopener noreferrer">
                      WHO - World Health Organization
                    </a>
                  </li>
                  <li>
                    <a href="https://www.nhlbi.nih.gov/health/educational/lose_wt/BMI/bmicalc.htm" target="_blank" rel="noopener noreferrer">
                      NIH - National Institutes of Health
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Chatbot */}
            <Chatbot userData={userData} />
          </>)} {/* end workout tab */}

          {/* Chatbot always visible on other tabs */}
          {(activeTab === 'history' || activeTab === 'calendar') && <Chatbot userData={userData} />}
        </div>
    );
  }

  return null;
}

export default App;