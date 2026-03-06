import { useState, useEffect, useRef } from 'react';
import './App.css';

// ============================================
// SPEECH FUNCTION - Enhanced for better quality
// ============================================
let voices = [];

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
}

if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text, callback) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find the most natural voice
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Google US English') ||
      voice.name.includes('Google UK English Female') ||
      voice.name.includes('Samantha') ||
      voice.name.includes('Karen') ||
      voice.name.includes('Microsoft Zira') ||
      voice.name.includes('Microsoft Eva') ||
      voice.name.includes('Microsoft Jenny') ||
      voice.name.includes('Natural')
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;
    
    if (callback) {
      utterance.onend = callback;
    }
    
    window.speechSynthesis.speak(utterance);
  }
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

// Bonus workout suggestions for extra calorie burn
const BONUS_WORKOUTS = [
  { name: '5-Minute Finisher: Burpee Challenge', exercises: '10 burpees, rest 30 sec, repeat 3x', calories: 100, description: 'Quick intense finisher to maximize calorie burn' },
  { name: 'Tabata Blast', exercises: '20 sec work / 10 sec rest x 8 rounds of jump squats', calories: 80, description: 'High-intensity interval training for metabolism boost' },
  { name: 'Core Burnout', exercises: 'Plank 1 min, bicycle crunches 30, leg raises 15', calories: 60, description: 'Finish with a strong core blast' },
  { name: 'Cardio Kickstart', exercises: 'Jumping jacks 50, high knees 1 min, mountain climbers 30', calories: 90, description: 'Get your heart rate up one more time' },
  { name: 'Arm Burnout', exercises: 'Push-ups to failure, arm circles 1 min, tricep dips 15', calories: 50, description: 'Finish your arms completely' },
  { name: 'Leg Finisher', exercises: 'Wall sit 1 min, jump squats 20, calf raises 30', calories: 70, description: 'Leave nothing in the tank for legs' },
];

// Body part options with "Lose Weight Only" added
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

// AI Chatbot responses
const AI_RESPONSES = {
  greetings: [
    "Hey! I'm your Gym Buddy AI assistant. How can I help you today?",
    "What's up! Ready to crush your fitness goals? Ask me anything!",
    "Hello! I'm here to help with workouts, nutrition, motivation, and more!"
  ],
  workout: [
    "Great question about workouts! For best results, aim for 3-5 sessions per week with rest days in between.",
    "When doing any exercise, focus on form first, then increase intensity. Quality over quantity!",
    "Remember to warm up for 5-10 minutes before your workout and cool down with stretching after."
  ],
  nutrition: [
    "For weight loss, aim for a slight calorie deficit of 300-500 calories per day.",
    "Protein is key for muscle building! Aim for 0.7-1g per pound of body weight.",
    "Stay hydrated! Drink at least 8 glasses of water daily, more when exercising."
  ],
  motivation: [
    "Remember why you started! Every workout brings you closer to your goals.",
    "Progress isn't always linear. Trust the process and stay consistent!",
    "You're stronger than you think. Push through and you'll surprise yourself!"
  ],
  rest: [
    "Rest days are crucial for muscle recovery and growth. Don't skip them!",
    "Getting 7-9 hours of sleep helps your muscles recover and boosts performance.",
    "Active recovery like light walking or stretching can help on rest days."
  ],
  default: [
    "That's a great question! Based on your goals, I'd recommend focusing on consistency and gradual progression.",
    "I'm here to help! Could you be more specific about what you'd like to know?",
    "Let me help with that. What specific aspect of fitness are you curious about?"
  ]
};

// ============================================
// COMPONENTS
// ============================================

// Flames Component
function Flames() {
  return (
    <div className="flames-container">
      <div className="flame-glow"></div>
      {[...Array(12)].map((_, i) => <div key={i} className="flame"></div>)}
      {[...Array(6)].map((_, i) => <div key={i + 12} className="flame-inner"></div>)}
    </div>
  );
}

// Floating Dumbbells Component
function FloatingDumbbells() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="dumbbell">
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

// Timer Component
function WorkoutTimer({ isRunning, onToggle, onReset }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
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
    onReset();
  };

  return (
    <div className="workout-timer">
      <div className="timer-display">{formatTime(seconds)}</div>
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

// Chatbot Component
function Chatbot({ userData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { type: 'bot', text: "Hey! I'm your Gym Buddy AI. Ask me anything about workouts, nutrition, or motivation!" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getAIResponse = (userMessage) => {
    const msg = userMessage.toLowerCase();
    
    // Check for keywords and return appropriate response
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
      return AI_RESPONSES.greetings[Math.floor(Math.random() * AI_RESPONSES.greetings.length)];
    }
    if (msg.includes('workout') || msg.includes('exercise') || msg.includes('train')) {
      return AI_RESPONSES.workout[Math.floor(Math.random() * AI_RESPONSES.workout.length)];
    }
    if (msg.includes('eat') || msg.includes('food') || msg.includes('diet') || msg.includes('nutrition') || msg.includes('protein') || msg.includes('calorie')) {
      return AI_RESPONSES.nutrition[Math.floor(Math.random() * AI_RESPONSES.nutrition.length)];
    }
    if (msg.includes('motivat') || msg.includes('tired') || msg.includes('give up') || msg.includes('hard') || msg.includes('difficult')) {
      return AI_RESPONSES.motivation[Math.floor(Math.random() * AI_RESPONSES.motivation.length)];
    }
    if (msg.includes('rest') || msg.includes('sleep') || msg.includes('recover')) {
      return AI_RESPONSES.rest[Math.floor(Math.random() * AI_RESPONSES.rest.length)];
    }
    if (msg.includes('bmi') || msg.includes('weight')) {
      if (userData?.bmi) {
        return `Your current BMI is ${userData.bmi}. ${userData.bmi < 25 ? "That's in a healthy range! Keep up the great work." : "Let's work together to improve that. Consistency is key!"}`;
      }
      return "BMI is a useful starting point, but remember it doesn't account for muscle mass. Focus on how you feel and your progress!";
    }
    if (msg.includes('how many') && msg.includes('calorie')) {
      return "For weight loss, aim for a 300-500 calorie deficit. For maintenance, eat at your TDEE. For muscle gain, add 200-300 calories. Your specific needs depend on your activity level!";
    }
    if (msg.includes('sore') || msg.includes('pain')) {
      return "Muscle soreness is normal 24-72 hours after a workout (DOMS). Stay hydrated, do light stretching, and get good sleep. If pain is sharp or in joints, rest that area and consider seeing a doctor.";
    }
    if (msg.includes('how often')) {
      return "For beginners, 3 times per week is great. Intermediate can do 4-5 times. Always have at least 1-2 rest days. Listen to your body!";
    }
    if (msg.includes('best exercise') || msg.includes('best workout')) {
      return "The best workout is one you'll actually do consistently! But compound movements like squats, deadlifts, push-ups, and rows give you the most bang for your buck.";
    }
    
    return AI_RESPONSES.default[Math.floor(Math.random() * AI_RESPONSES.default.length)];
  };

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { type: 'user', text: input }]);
    const userMsg = input;
    setInput('');
    setIsTyping(true);
    
    // Simulate AI thinking
    setTimeout(() => {
      const response = getAIResponse(userMsg);
      setMessages(prev => [...prev, { type: 'bot', text: response }]);
      setIsTyping(false);
      
      // Speak the response
      speak(response);
    }, 1000 + Math.random() * 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
      {/* Chat Button */}
      <button className="chatbot-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✕' : '🤖'}
        {!isOpen && <span className="chat-label">AI Assistant</span>}
      </button>
      
      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-avatar">🤖</div>
            <div className="chatbot-title">
              <h4>Gym Buddy AI</h4>
              <span className="online-status">● Online</span>
            </div>
          </div>
          
          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.type}`}>
                {msg.type === 'bot' && <span className="bot-avatar">🤖</span>}
                <div className="message-bubble">{msg.text}</div>
              </div>
            ))}
            {isTyping && (
              <div className="chat-message bot">
                <span className="bot-avatar">🤖</span>
                <div className="message-bubble typing">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="chatbot-input">
            <input
              type="text"
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button onClick={handleSend}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN APP COMPONENT
// ============================================
function App() {
  const [screen, setScreen] = useState('splash');
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
  const [workoutPlan, setWorkoutPlan] = useState([]);
  const [completedWorkouts, setCompletedWorkouts] = useState({});
  const [timerRunning, setTimerRunning] = useState(false);
  const [showBonusWorkout, setShowBonusWorkout] = useState(false);
  const [selectedBonus, setSelectedBonus] = useState(null);

  // Load saved data on start
  useEffect(() => {
    const savedData = localStorage.getItem('gymBuddyUserData');
    const savedCompleted = localStorage.getItem('gymBuddyCompleted');
    
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setUserData(parsed);
      if (parsed.bmi && parsed.goal && parsed.targetArea) {
        // Handle the special "loseWeightOnly" case
        if (parsed.targetArea === 'loseWeightOnly') {
          setWorkoutPlan(WORKOUTS.loseWeight.loseWeightOnly);
        } else {
          setWorkoutPlan(WORKOUTS[parsed.goal][parsed.targetArea] || []);
        }
        setScreen('dashboard');
      }
    }
    
    if (savedCompleted) {
      setCompletedWorkouts(JSON.parse(savedCompleted));
    }
  }, []);

  // Save data
  const saveUserData = (newData) => {
    setUserData(newData);
    localStorage.setItem('gymBuddyUserData', JSON.stringify(newData));
  };

  // Save completed workouts
  const saveCompletedWorkouts = (completed) => {
    setCompletedWorkouts(completed);
    localStorage.setItem('gymBuddyCompleted', JSON.stringify(completed));
  };

  // Toggle workout completion
  const toggleWorkoutComplete = (index) => {
    const today = new Date().toDateString();
    const key = `${today}-${index}`;
    const newCompleted = { ...completedWorkouts };
    
    if (newCompleted[key]) {
      delete newCompleted[key];
    } else {
      newCompleted[key] = true;
      // Speak encouragement
      const encouragements = [
        "Great job! Keep it up!",
        "Awesome! You're crushing it!",
        "One down! You're making progress!",
        "Nice work! Stay focused!",
        "Excellent! Keep pushing!"
      ];
      speak(encouragements[Math.floor(Math.random() * encouragements.length)]);
    }
    
    saveCompletedWorkouts(newCompleted);
  };

  // Check if workout is completed
  const isWorkoutComplete = (index) => {
    const today = new Date().toDateString();
    const key = `${today}-${index}`;
    return completedWorkouts[key] || false;
  };

  // Calculate completed count
  const getCompletedCount = () => {
    const today = new Date().toDateString();
    return Object.keys(completedWorkouts).filter(key => key.startsWith(today)).length;
  };

  // Navigation handlers
  const handleEnter = () => {
    setScreen('greeting');
    setTimeout(() => {
      speak("Hey! What's up! Welcome to Gym Buddy, your personal fitness companion. I'm so excited to meet you and help you on your fitness journey. Whether you're just starting out or you've been at it for a while, I'm here to support you every step of the way. Ready to get started?");
    }, 500);
  };

  const handleContinue = () => {
    setScreen('questions');
    setTimeout(() => {
      speak("Awesome! Now let's get to know each other. Tell me your name, age, and a little about your body so I can personalize your experience.");
    }, 300);
  };

  const handleSubmitInfo = () => {
    if (userData.weight && userData.feet && userData.name && userData.age) {
      const totalInches = (parseFloat(userData.feet) * 12) + (parseFloat(userData.inches) || 0);
      const weightLbs = parseFloat(userData.weight);
      const calculatedBmi = ((weightLbs / (totalInches * totalInches)) * 703).toFixed(1);
      
      const newData = { ...userData, bmi: calculatedBmi };
      saveUserData(newData);
      setScreen('goals');

      setTimeout(() => {
        speak(`Great ${userData.name}! Your BMI is ${calculatedBmi}. Now let's talk about your fitness goals. What are you looking to achieve?`);
      }, 300);
    } else {
      speak("Hey, looks like you missed something. Make sure to fill in all the fields for me!");
    }
  };

  const handleSelectGoal = (goalId) => {
    const newData = { ...userData, goal: goalId };
    saveUserData(newData);
    setScreen('bodyParts');
    
    const goal = GOALS.find(g => g.id === goalId);
    setTimeout(() => {
      speak(`${goal.name}, great choice! Now, what area of your body do you want to focus on? You can also choose Lose Weight Only for a cardio-focused fat burning workout.`);
    }, 300);
  };

  const handleSelectBodyPart = (bodyPartId) => {
    const newData = { ...userData, targetArea: bodyPartId };
    saveUserData(newData);
    
    let workouts;
    if (bodyPartId === 'loseWeightOnly') {
      workouts = WORKOUTS.loseWeight.loseWeightOnly;
    } else {
      workouts = WORKOUTS[userData.goal][bodyPartId] || [];
    }
    
    setWorkoutPlan(workouts);
    setScreen('dashboard');
    
    const bodyPart = BODY_PARTS.find(b => b.id === bodyPartId);
    const goal = GOALS.find(g => g.id === userData.goal);
    
    setTimeout(() => {
      speak(`Perfect! I've created a ${bodyPart.name.toLowerCase()} workout plan to help you ${goal.name.toLowerCase()}. You've got ${workouts.length} exercises ready to go. Use the timer to track your workout. Check off exercises as you complete them. Let's crush it!`);
    }, 300);
  };

  const handleResetGoals = () => {
    setScreen('goals');
    setTimerRunning(false);
    setTimeout(() => {
      speak("No problem! Let's change up your goals. What would you like to focus on now?");
    }, 300);
  };

  const handleLogout = () => {
    localStorage.removeItem('gymBuddyUserData');
    localStorage.removeItem('gymBuddyCompleted');
    setUserData({
      name: '',
      age: '',
      weight: '',
      feet: '',
      inches: '',
      bmi: null,
      goal: null,
      targetArea: null,
    });
    setWorkoutPlan([]);
    setCompletedWorkouts({});
    setTimerRunning(false);
    setScreen('splash');
  };

  const handleTimerToggle = () => {
    if (!timerRunning) {
      speak("Timer started. Let's go!");
    } else {
      speak("Timer paused. Take a breather.");
    }
    setTimerRunning(!timerRunning);
  };

  const handleTimerReset = () => {
    setTimerRunning(false);
    speak("Timer reset. Ready when you are!");
  };

  const getBmiInfo = () => {
    const bmi = parseFloat(userData.bmi);
    if (bmi < 18.5) return { category: 'Underweight', color: '#3498db' };
    if (bmi < 25) return { category: 'Healthy', color: '#2ecc71' };
    if (bmi < 30) return { category: 'Overweight', color: '#f39c12' };
    return { category: 'Obese', color: '#e74c3c' };
  };

  // ============================================
  // SCREENS
  // ============================================

  // SPLASH SCREEN
  if (screen === 'splash') {
    return (
      <div className="splash-screen">
        <FloatingDumbbells />
        <Flames />
        <h1 className="title">GYM BUDDY</h1>
        <p className="subtitle">Your AI-Powered Fitness Companion</p>
        <button className="enter-button" onClick={handleEnter}>
          LET'S GO
        </button>
        <p className="hint">🔊 Sound will play</p>
      </div>
    );
  }

  // GREETING SCREEN
  if (screen === 'greeting') {
    return (
      <div className="greeting-screen">
        <FloatingDumbbells />
        <Flames />
        <div className="greeting-icon">👋</div>
        <h1>Hey There!</h1>
        <p className="greeting-text">
          Welcome to <span className="highlight">Gym Buddy</span>, your personal fitness companion!
        </p>
        <p className="greeting-subtext">
          I'm so excited to meet you and help you on your fitness journey. 
          Whether you're just starting out or you've been at it for a while, 
          I'm here to support you every step of the way.
        </p>
        <button className="continue-button" onClick={handleContinue}>
          Let's Get Started! 🚀
        </button>
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
        <h1>Tell Me About Yourself 💪</h1>
        <p className="question-subtitle">So I can personalize your experience</p>

        <div className="form-container">
          <div className="input-group">
            <label>What's Your Name?</label>
            <input
              type="text"
              placeholder="Enter your name"
              value={userData.name}
              onChange={(e) => setUserData({ ...userData, name: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label>How Old Are You?</label>
            <input
              type="number"
              placeholder="Enter your age"
              value={userData.age}
              onChange={(e) => setUserData({ ...userData, age: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label>What's Your Weight? (lbs)</label>
            <input
              type="number"
              placeholder="Enter your weight"
              value={userData.weight}
              onChange={(e) => setUserData({ ...userData, weight: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label>What's Your Height?</label>
            <div className="height-inputs">
              <div className="height-field">
                <input
                  type="number"
                  placeholder="Feet"
                  value={userData.feet}
                  onChange={(e) => setUserData({ ...userData, feet: e.target.value })}
                  min="0"
                  max="8"
                />
                <span className="height-label">ft</span>
              </div>
              <div className="height-field">
                <input
                  type="number"
                  placeholder="Inches"
                  value={userData.inches}
                  onChange={(e) => setUserData({ ...userData, inches: e.target.value })}
                  min="0"
                  max="11"
                />
                <span className="height-label">in</span>
              </div>
            </div>
          </div>

          <button className="submit-button" onClick={handleSubmitInfo}>
            Continue 💪
          </button>
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
        <h1>What's Your Goal? 🎯</h1>
        <p className="goals-subtitle">Choose what you want to achieve</p>
        
        <div className="goals-container">
          {GOALS.map(goal => (
            <button 
              key={goal.id} 
              className="goal-card"
              onClick={() => handleSelectGoal(goal.id)}
              style={{ '--goal-color': goal.color }}
            >
              <span className="goal-icon">{goal.icon}</span>
              <h3>{goal.name}</h3>
              <p>{goal.description}</p>
            </button>
          ))}
        </div>
        <Chatbot userData={userData} />
      </div>
    );
  }

  // BODY PARTS SCREEN
  if (screen === 'bodyParts') {
    // Filter body parts based on goal
    const availableBodyParts = userData.goal === 'loseWeight' 
      ? BODY_PARTS 
      : BODY_PARTS.filter(bp => bp.id !== 'loseWeightOnly');
    
    return (
      <div className="bodyparts-screen">
        <FloatingDumbbells />
        <Flames />
        <h1>Target Area 🎯</h1>
        <p className="bodyparts-subtitle">What do you want to focus on?</p>
        
        <div className="bodyparts-container">
          {availableBodyParts.map(part => (
            <button 
              key={part.id} 
              className={`bodypart-card ${part.id === 'loseWeightOnly' ? 'featured' : ''}`}
              onClick={() => handleSelectBodyPart(part.id)}
            >
              <span className="bodypart-icon">{part.icon}</span>
              <h3>{part.name}</h3>
              <p>{part.description}</p>
            </button>
          ))}
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

    return (
      <div className="dashboard-screen">
        <FloatingDumbbells />
        <Flames />
        
        {/* Header */}
        <div className="dashboard-header">
          <div className="user-welcome">
            <h1>Hey, {userData.name}! 💪</h1>
            <p>{userData.age} years old • {userData.feet}'{userData.inches || 0}" • {userData.weight} lbs</p>
          </div>
          <div className="header-actions">
            <button className="change-goals-btn" onClick={handleResetGoals}>
              Change Goals
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {/* Timer */}
        <WorkoutTimer 
          isRunning={timerRunning}
          onToggle={handleTimerToggle}
          onReset={handleTimerReset}
        />

        {/* Progress */}
        <div className="progress-section">
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${(completedCount / workoutPlan.length) * 100}%` }}></div>
          </div>
          <p className="progress-text">{completedCount} of {workoutPlan.length} exercises completed</p>
        </div>

        {/* Stats Row */}
        <div className="dashboard-stats">
          <div className="mini-stat-card">
            <span className="mini-stat-label">BMI</span>
            <span className="mini-stat-value" style={{ color: bmiInfo.color }}>{userData.bmi}</span>
            <span className="mini-stat-category" style={{ color: bmiInfo.color }}>{bmiInfo.category}</span>
          </div>
          <div className="mini-stat-card">
            <span className="mini-stat-label">Goal</span>
            <span className="mini-stat-icon">{currentGoal?.icon}</span>
            <span className="mini-stat-category">{currentGoal?.name}</span>
          </div>
          <div className="mini-stat-card">
            <span className="mini-stat-label">Focus</span>
            <span className="mini-stat-icon">{currentBodyPart?.icon}</span>
            <span className="mini-stat-category">{currentBodyPart?.name}</span>
          </div>
          <div className="mini-stat-card">
            <span className="mini-stat-label">Est. Burn</span>
            <span className="mini-stat-value burn">{totalCalories}</span>
            <span className="mini-stat-category">calories</span>
          </div>
        </div>

        {/* Workout Plan */}
        <div className="workout-section">
          <h2>Your {currentBodyPart?.name} Workout Plan 🏋️</h2>
          <p className="workout-section-subtitle">
            {workoutPlan.length} exercises • Tap the checkbox when you complete each one
          </p>

          <div className="workout-list">
            {workoutPlan.map((workout, index) => (
              <div key={index} className={`workout-card ${isWorkoutComplete(index) ? 'completed' : ''}`}>
                <button 
                  className={`workout-checkbox ${isWorkoutComplete(index) ? 'checked' : ''}`}
                  onClick={() => toggleWorkoutComplete(index)}
                >
                  {isWorkoutComplete(index) ? '✓' : index + 1}
                </button>
                <div className="workout-info">
                  <h3>{workout.name}</h3>
                  <p className="workout-description">{workout.description}</p>
                  <p className="workout-tips"><strong>💡 Tip:</strong> {workout.tips}</p>
                  <div className="workout-details">
                    <span className="workout-detail">
                      <strong>Sets:</strong> {workout.sets}
                    </span>
                    <span className="workout-detail">
                      <strong>Reps:</strong> {workout.reps}
                    </span>
                    <span className="workout-detail">
                      <strong>Rest:</strong> {workout.rest}
                    </span>
                  </div>
                </div>
                <div className="workout-meta">
                  <span className={`difficulty ${workout.difficulty.toLowerCase()}`}>
                    {workout.difficulty}
                  </span>
                  <span className="calories">🔥 {workout.calories} cal</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bonus Workout Section */}
        {allComplete && (
          <div className="bonus-section">
            <h2>🎉 Workout Complete! Want a Bonus Challenge?</h2>
            <p>You crushed it! Here are some bonus exercises to burn extra calories:</p>
            
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
        <div className="bmi-scale-container">
          <h3>BMI Scale</h3>
          <div className="bmi-scale">
            <div className="bmi-range underweight">
              <span className="range-label">Underweight</span>
              <span className="range-value">&lt; 18.5</span>
            </div>
            <div className="bmi-range healthy">
              <span className="range-label">Healthy</span>
              <span className="range-value">18.5 - 24.9</span>
            </div>
            <div className="bmi-range overweight">
              <span className="range-label">Overweight</span>
              <span className="range-value">25 - 29.9</span>
            </div>
            <div className="bmi-range obese">
              <span className="range-label">Obese</span>
              <span className="range-value">30+</span>
            </div>
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
      </div>
    );
  }

  return null;
}

export default App;
