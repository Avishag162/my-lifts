// Starter exercise library, with Hebrew names and English aliases. Pictures are drawn by scripts/draw-exercises.ts;
// videos are existing YouTube demos (CrossFit's own where there is one), checked to exist on 2026-11-11.
import { type DB } from './db.ts';
import { GROUPS, groupOf, guessedExtras } from '../shared/muscles.ts';
import { normalizeName, similarity, type NameIndexEntry } from './matching.ts';
import { SEED_CUES, SEED_GROUPS } from './exercise-data.ts';

interface SeedExercise {
  name: string;
  area: 'legs' | 'back' | 'chest' | 'shoulders' | 'arms' | 'glutes' | 'core';
  equipment: 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'ball' | 'bodyweight';
  step?: number;
  aliases?: string[];
}

/** Picture (in src/web/public/exercises) and demo video for each starter exercise. */
export const SEED_MEDIA: Record<string, { image: string; video: string }> = {
  'סקוואט עם מוט': { image: 'back-squat', video: 'ultWZbUMPL8' },
  'סקוואט גביע': { image: 'goblet-squat', video: '6aLLiik02yU' },
  'פרונט סקוואט': { image: 'front-squat', video: 'm4ytaCJZpl0' },
  'לאנג׳ עם משקולות': { image: 'lunge', video: 'I34ysEkPK7w' },
  'בולגרי ספליט סקוואט': { image: 'bulgarian-split-squat', video: '-IpkZv8tZYM' },
  'דדליפט': { image: 'deadlift', video: 'op9kVnSso6Q' },
  'דדליפט רומני': { image: 'romanian-deadlift', video: 'Roe2hOnzXf4' },
  'היפ תראסט': { image: 'hip-thrust', video: 'Zp26q4BY5HE' },
  'גלוט ברידג׳': { image: 'glute-bridge', video: 'KI6fjDqGZh4' },
  'קיקבק בכבל': { image: 'cable-kickback', video: 'VSgMyiOu0uE' },
  'לחיצת חזה': { image: 'bench-press', video: 'XSza8hVTlmM' },
  'לחיצת חזה במשקולות': { image: 'dumbbell-bench-press', video: 'G9nf-QZeYWI' },
  'שכיבות סמיכה': { image: 'push-up', video: '_l3ySVKYVJ8' },
  'חתירה בהטיה': { image: 'bent-over-row', video: 'UM4oeRiyYl4' },
  'חתירה במשקולת': { image: 'dumbbell-row', video: 'IZlsQ83klT4' },
  'חתירה בטבעות': { image: 'ring-row', video: 'xhlReCpAE9k' },
  'מתח': { image: 'pull-up', video: 'rVRiy_HVz2g' },
  'מתח עם משקל': { image: 'weighted-pull-up', video: 'dntiFx5q22A' },
  'פולי עליון': { image: 'lat-pulldown', video: 'c2e_j4IdPBs' },
  'לחיצת כתפיים': { image: 'overhead-press', video: 'xe19t2_6yis' },
  'פוש פרס': { image: 'push-press', video: 'X6-DMh-t4nQ' },
  'לחיצת כתפיים במשקולות': { image: 'dumbbell-shoulder-press', video: 'JAA855alyw4' },
  'הרחקה לצדדים': { image: 'lateral-raise', video: 'Y29xKcze8Ik' },
  'כפיפת מרפקים': { image: 'biceps-curl', video: 'nBzLCE-dcRQ' },
  'פשיטת מרפקים': { image: 'triceps-extension', video: 'opAqldj0s1o' },
  'סקאל קראשר': { image: 'skull-crusher', video: 'O1mSsKPyS9Q' },
  'מקבילים': { image: 'dips', video: 'hsEKg3M45dc' },
  'קטלבל סווינג': { image: 'kettlebell-swing', video: 'vdezTMulJ-k' },
  'תראסטר': { image: 'thruster', video: 'L219ltL15zk' },
  'בוקס ג׳אמפ': { image: 'box-jump', video: '52r_Ul5k03g' },
  'טואס טו בר': { image: 'toes-to-bar', video: '_03pCKOv4l4' },
  'פלאנק': { image: 'plank', video: 'mwlp75MS6Rg' },
  'רוסיאן טוויסט': { image: 'russian-twist', video: 'TfTUk2AjV7g' },
  // Cable (adjustable pulley), box and wall-ball exercises, added 2026-11-12 (videos found that day).
  'חתירה בכבל': { image: 'seated-cable-row', video: 'f_r95UajQcg' },
  'פייס פול': { image: 'face-pull', video: '4CXhdbWOdzQ' },
  'פשיטת מרפקים בכבל': { image: 'triceps-pushdown', video: 'd2o_COJbnO4' },
  'פשיטת מרפקים מעל הראש בכבל': { image: 'overhead-cable-triceps', video: 'AUsSlsBu5eg' },
  'כפיפת מרפקים בכבל': { image: 'cable-curl', video: 'pEVXvlVKm80' },
  'פרפר בכבל': { image: 'cable-fly', video: 'taI4XduLpTk' },
  'הרחקה לצדדים בכבל': { image: 'cable-lateral-raise', video: '-CAGLnWUkWA' },
  'פאלוף פרס': { image: 'pallof-press', video: '_2xWmYNnFS8' },
  'וודצ׳ופ בכבל': { image: 'cable-woodchop', video: 'yPvAj_X_5NM' },
  'פול ת׳רו בכבל': { image: 'cable-pull-through', video: '4oZ_0_bQcOg' },
  'משיכה בידיים ישרות בכבל': { image: 'straight-arm-pulldown', video: '98W63pVdW38' },
  'כפיפות בטן בכבל': { image: 'cable-crunch', video: '0KEP6A1deBE' },
  'סטפ אפ': { image: 'step-up', video: 'qXQDZOrc7TQ' },
  'בוקס סקוואט': { image: 'box-squat', video: 'D5hSzCggeE8' },
  'מקבילים על קופסה': { image: 'bench-dips', video: 'byDQQOr0yDI' },
  'וול בול': { image: 'wall-ball', video: 'jCSoA4amHj4' },
  // More for the pulleys and free weights.
  'רוורס פליי בכבל': { image: 'cable-reverse-fly', video: 'CfLXDFh110w' },
  'חתירה ביד אחת בכבל': { image: 'single-arm-cable-row', video: 'SqlsitqMeMs' },
  'לחיצת חזה בכבל': { image: 'cable-chest-press', video: 'UsFdYBcvHEs' },
  'הרמה קדמית בכבל': { image: 'cable-front-raise', video: 'RsbyWwhaWBs' },
  'כפיפת פטישים בכבל': { image: 'cable-hammer-curl', video: 'PslvRTdHJHY' },
  'הרחקת ירך בכבל': { image: 'cable-hip-abduction', video: 'Jge8zqHf5Xs' },
  'דדליפט סומו': { image: 'sumo-deadlift', video: 'JbY72Him34Q' },
  'פאוור קלין': { image: 'power-clean', video: 'lI35socHJ4k' },
  'קלין': { image: 'squat-clean', video: 'UmjF_McKUv4' },
  'סנאץ׳': { image: 'power-snatch', video: 'a_uQXwXRrCc' },
  'פוש ג׳רק': { image: 'push-jerk', video: 'ck-vj8DZZZI' },
  'לחיצת ארנולד': { image: 'arnold-press', video: 'HBo3hhGD-cA' },
  'כפיפת פטישים': { image: 'hammer-curl', video: 'CFBZ4jN1CMI' },
  'דדליפט רגל אחת': { image: 'single-leg-rdl', video: 'k83AIfjDbnI' },
  'לחיצת חזה בשיפוע': { image: 'incline-dumbbell-press', video: 'QEY2z5LtB9Y' },
  'פולאובר': { image: 'dumbbell-pullover', video: 'l0YnKjgikm0' },
  'רנגייד רואו': { image: 'renegade-row', video: 'F68p7cJFtOI' },
  'הליכת חקלאי': { image: 'farmers-carry', video: 'z7E_YU9P1jU' },
  'טורקיש גט אפ': { image: 'turkish-get-up', video: '6BiS4LKjxuk' },
  'סנאץ׳ בקטלבל': { image: 'kettlebell-snatch', video: 'OYmrVhdZXpo' },
  'גוד מורנינג': { image: 'good-morning', video: '0LLam_wkt3A' },
  'פשיטת ברכיים בפולי': { image: 'cable-leg-extension', video: 'wpA1gwp7E_A' },
  'כפיפת ברכיים בשכיבה': { image: 'lying-cable-leg-curl', video: 'RclC0-k4RvE' },
};

// Every exercise has its English
// names as aliases. Weighted and bodyweight versions are separate exercises, so progress is compared like for like.
export const SEED_EXERCISES: SeedExercise[] = ([
  { name: 'סקוואט עם מוט', area: 'legs', equipment: 'barbell', aliases: ['סקוואט', 'Back Squat', 'Barbell Back Squat', 'Squat'] },
  { name: 'סקוואט גביע', area: 'legs', equipment: 'kettlebell', step: 4, aliases: ['גובלט סקוואט', 'Goblet Squat'] },
  { name: 'פרונט סקוואט', area: 'legs', equipment: 'barbell', aliases: ['Front Squat'] },
  { name: 'לאנג׳ עם משקולות', area: 'legs', equipment: 'dumbbell', step: 1, aliases: ['מכרעים', 'לאנג׳', 'Lunges', 'DB Lunges', 'Walking Lunges', 'Reverse Lunges'] },
  { name: 'בולגרי ספליט סקוואט', area: 'legs', equipment: 'dumbbell', step: 1, aliases: ['בולגרי', 'Bulgarian Split Squat', 'BSS'] },
  { name: 'דדליפט', area: 'back', equipment: 'barbell', step: 5, aliases: ['Deadlift', 'מתה'] },
  { name: 'דדליפט רומני', area: 'glutes', equipment: 'barbell', aliases: ['RDL', 'רומני', 'Romanian Deadlift'] },
  { name: 'היפ תראסט', area: 'glutes', equipment: 'barbell', step: 5, aliases: ['Hip Thrust', 'Barbell Hip Thrust', 'גשר ירכיים עם מוט'] },
  { name: 'גלוט ברידג׳', area: 'glutes', equipment: 'bodyweight', aliases: ['גשר', 'Glute Bridge'] },
  { name: 'קיקבק בכבל', area: 'glutes', equipment: 'cable', step: 2.5, aliases: ['קיקבק', 'Cable Kickback', 'Kickback'] },
  { name: 'לחיצת חזה', area: 'chest', equipment: 'barbell', aliases: ['בנץ׳', 'Bench Press', 'Barbell Bench Press', 'לחיצת חזה במוט'] },
  { name: 'לחיצת חזה במשקולות', area: 'chest', equipment: 'dumbbell', step: 1, aliases: ['DB Bench Press', 'Dumbbell Bench Press'] },
  { name: 'שכיבות סמיכה', area: 'chest', equipment: 'bodyweight', aliases: ['פושאפס', 'Push Ups', 'Push-Ups'] },
  { name: 'חתירה בהטיה', area: 'back', equipment: 'barbell', aliases: ['חתירה', 'Bent Over Row', 'Barbell Row'] },
  { name: 'חתירה במשקולת', area: 'back', equipment: 'dumbbell', step: 1, aliases: ['חתירה ביד אחת', 'DB Row', 'Dumbbell Row', 'Single Arm Row'] },
  { name: 'חתירה בטבעות', area: 'back', equipment: 'bodyweight', aliases: ['Ring Row'] },
  { name: 'מתח', area: 'back', equipment: 'bodyweight', aliases: ['Pull Ups', 'Pull-Ups', 'Bodyweight Pull-Ups', 'Strict Pull-Ups', 'עליות מתח'] },
  { name: 'מתח עם משקל', area: 'back', equipment: 'dumbbell', step: 2.5, aliases: ['Weighted Pull-Ups', 'Weighted Pull Ups'] },
  { name: 'פולי עליון', area: 'back', equipment: 'cable', step: 5, aliases: ['Lat Pulldown'] },
  { name: 'לחיצת כתפיים', area: 'shoulders', equipment: 'barbell', aliases: ['לחיצה צבאית', 'Overhead Press', 'Strict Press', 'Shoulder Press', 'Barbell Shoulder Press', 'OHP'] },
  { name: 'פוש פרס', area: 'shoulders', equipment: 'barbell', aliases: ['Push Press'] },
  { name: 'לחיצת כתפיים במשקולות', area: 'shoulders', equipment: 'dumbbell', step: 1, aliases: ['DB Shoulder Press', 'Dumbbell Shoulder Press'] },
  { name: 'הרחקה לצדדים', area: 'shoulders', equipment: 'dumbbell', step: 1, aliases: ['הרחקות', 'Lateral Raise', 'Lateral Raises', 'DB Lateral Raise'] },
  { name: 'כפיפת מרפקים', area: 'arms', equipment: 'dumbbell', step: 1, aliases: ['ביספס', 'כפיפות מרפק', 'Biceps Curl', 'Bicep Curl', 'DB Curl'] },
  { name: 'פשיטת מרפקים', area: 'arms', equipment: 'dumbbell', step: 1, aliases: ['טרייספס', 'Triceps Extension', 'Tricep Extension'] },
  { name: 'סקאל קראשר', area: 'arms', equipment: 'dumbbell', step: 1, aliases: ['Skull Crusher', 'DB Skull Crusher', 'Skull Crushers'] },
  { name: 'מקבילים', area: 'arms', equipment: 'bodyweight', aliases: ['Dips'] },
  { name: 'קטלבל סווינג', area: 'glutes', equipment: 'kettlebell', step: 4, aliases: ['סווינג', 'KB Swing', 'Kettlebell Swing', 'Russian Swing'] },
  { name: 'תראסטר', area: 'legs', equipment: 'barbell', aliases: ['Thruster', 'Thrusters'] },
  { name: 'בוקס ג׳אמפ', area: 'legs', equipment: 'bodyweight', aliases: ['Box Jump', 'Box Jumps', 'Box Jump Step Downs', 'Box Jump Step Down'] },
  { name: 'טואס טו בר', area: 'core', equipment: 'bodyweight', aliases: ['Toes to Bar', 'Toes-to-Bar', 'T2B'] },
  { name: 'פלאנק', area: 'core', equipment: 'bodyweight', aliases: ['פלנק', 'Plank'] },
  { name: 'רוסיאן טוויסט', area: 'core', equipment: 'dumbbell', step: 1, aliases: ['טוויסט רוסי', 'Russian Twist'] },
  // Adjustable pulleys, boxes and wall balls.
  { name: 'חתירה בכבל', area: 'back', equipment: 'cable', step: 5, aliases: ['פולי תחתון', 'חתירה בפולי תחתון', 'חתירה בישיבה', 'Seated Cable Row', 'Cable Row', 'Low Row'] },
  { name: 'פייס פול', area: 'shoulders', equipment: 'cable', aliases: ['Face Pull', 'Face Pulls', 'Cable Face Pull'] },
  { name: 'פשיטת מרפקים בכבל', area: 'arms', equipment: 'cable', aliases: ['פושדאון', 'Triceps Pushdown', 'Tricep Pushdown', 'Cable Pushdown', 'Rope Pushdown'] },
  { name: 'פשיטת מרפקים מעל הראש בכבל', area: 'arms', equipment: 'cable', aliases: ['Overhead Cable Triceps Extension', 'Overhead Cable Extension', 'Cable Overhead Extension'] },
  { name: 'כפיפת מרפקים בכבל', area: 'arms', equipment: 'cable', aliases: ['Cable Curl', 'Cable Curls', 'Cable Bicep Curl', 'Cable Biceps Curl'] },
  { name: 'פרפר בכבל', area: 'chest', equipment: 'cable', aliases: ['קרוס אובר', 'Cable Fly', 'Cable Flyes', 'Cable Crossover'] },
  { name: 'הרחקה לצדדים בכבל', area: 'shoulders', equipment: 'cable', step: 1, aliases: ['Cable Lateral Raise', 'Cable Lateral Raises'] },
  { name: 'פאלוף פרס', area: 'core', equipment: 'cable', aliases: ['Pallof Press', 'Paloff Press'] },
  { name: 'וודצ׳ופ בכבל', area: 'core', equipment: 'cable', aliases: ['וודצ׳ופר', 'Cable Woodchop', 'Woodchop', 'Wood Chop', 'Woodchopper'] },
  { name: 'פול ת׳רו בכבל', area: 'glutes', equipment: 'cable', aliases: ['Cable Pull Through', 'Pull Through', 'Pull-Through'] },
  { name: 'משיכה בידיים ישרות בכבל', area: 'back', equipment: 'cable', aliases: ['Straight Arm Pulldown', 'Straight-Arm Pulldown', 'Straight Arm Lat Pulldown'] },
  { name: 'כפיפות בטן בכבל', area: 'core', equipment: 'cable', aliases: ['Cable Crunch', 'Kneeling Cable Crunch'] },
  { name: 'סטפ אפ', area: 'legs', equipment: 'dumbbell', step: 1, aliases: ['עליות על קופסה', 'Step Up', 'Step Ups', 'Box Step Up', 'DB Step Up'] },
  { name: 'בוקס סקוואט', area: 'legs', equipment: 'barbell', aliases: ['סקוואט לקופסה', 'Box Squat', 'Box Squats'] },
  { name: 'מקבילים על קופסה', area: 'arms', equipment: 'bodyweight', aliases: ['Box Dips', 'Bench Dips', 'Bench Dip'] },
  { name: 'וול בול', area: 'legs', equipment: 'ball', step: 1, aliases: ['Wall Ball', 'Wall Balls', 'Wall Ball Shots', 'Wallball', 'WB'] },
  { name: 'רוורס פליי בכבל', area: 'shoulders', equipment: 'cable', step: 1, aliases: ['Cable Reverse Fly', 'Reverse Cable Fly', 'Reverse Cable Crossover', 'Rear Delt Fly'] },
  { name: 'חתירה ביד אחת בכבל', area: 'back', equipment: 'cable', aliases: ['Single Arm Cable Row', 'One Arm Cable Row', 'SA Cable Row'] },
  { name: 'לחיצת חזה בכבל', area: 'chest', equipment: 'cable', aliases: ['Cable Chest Press', 'Standing Cable Press', 'Cable Press'] },
  { name: 'הרמה קדמית בכבל', area: 'shoulders', equipment: 'cable', step: 1, aliases: ['Cable Front Raise', 'Front Raise'] },
  { name: 'כפיפת פטישים בכבל', area: 'arms', equipment: 'cable', aliases: ['Cable Hammer Curl', 'Rope Hammer Curl', 'Rope Curl'] },
  { name: 'הרחקת ירך בכבל', area: 'glutes', equipment: 'cable', step: 1, aliases: ['Cable Hip Abduction', 'Cable Abduction', 'Standing Hip Abduction'] },
  { name: 'דדליפט סומו', area: 'legs', equipment: 'barbell', step: 5, aliases: ['Sumo Deadlift', 'Sumo DL', 'Sumo Deadlifts'] },
  { name: 'פאוור קלין', area: 'legs', equipment: 'barbell', aliases: ['Power Clean', 'Power Cleans', 'Hang Power Clean', 'PC', 'HPC'] },
  { name: 'קלין', area: 'legs', equipment: 'barbell', aliases: ['Squat Clean', 'Clean', 'Cleans', 'Hang Squat Clean', 'Full Clean'] },
  { name: 'סנאץ׳', area: 'legs', equipment: 'barbell', aliases: ['Snatch', 'Power Snatch', 'Hang Power Snatch', 'Squat Snatch'] },
  { name: 'פוש ג׳רק', area: 'shoulders', equipment: 'barbell', aliases: ['Push Jerk', 'Split Jerk', 'Jerk'] },
  { name: 'לחיצת ארנולד', area: 'shoulders', equipment: 'dumbbell', step: 1, aliases: ['Arnold Press', 'Arnold Dumbbell Press'] },
  { name: 'כפיפת פטישים', area: 'arms', equipment: 'dumbbell', step: 1, aliases: ['Hammer Curl', 'Hammer Curls', 'DB Hammer Curl'] },
  { name: 'דדליפט רגל אחת', area: 'glutes', equipment: 'dumbbell', step: 1, aliases: ['Single Leg RDL', 'Single Leg Deadlift', 'SL RDL', 'Single-Leg Romanian Deadlift'] },
  { name: 'לחיצת חזה בשיפוע', area: 'chest', equipment: 'dumbbell', step: 1, aliases: ['Incline Dumbbell Press', 'Incline DB Press', 'Incline Press', 'Incline Bench Press'] },
  { name: 'פולאובר', area: 'back', equipment: 'dumbbell', step: 1, aliases: ['Dumbbell Pullover', 'DB Pullover', 'Pullover', 'Pullovers'] },
  { name: 'רנגייד רואו', area: 'back', equipment: 'dumbbell', step: 1, aliases: ['Renegade Row', 'Renegade Rows', 'Plank Row'] },
  { name: 'הליכת חקלאי', area: 'core', equipment: 'dumbbell', step: 2, aliases: ['Farmers Carry', "Farmer's Carry", 'Farmers Walk', "Farmer's Walk", 'Farmer Carry'] },
  { name: 'טורקיש גט אפ', area: 'core', equipment: 'kettlebell', step: 4, aliases: ['Turkish Get Up', 'Turkish Get-Up', 'TGU', 'Get Up'] },
  { name: 'סנאץ׳ בקטלבל', area: 'shoulders', equipment: 'kettlebell', step: 4, aliases: ['Kettlebell Snatch', 'KB Snatch', 'Kettlebell Snatches'] },
  { name: 'גוד מורנינג', area: 'glutes', equipment: 'barbell', aliases: ['Good Morning', 'Good Mornings', 'Barbell Good Morning'] },
  { name: 'פשיטת ברכיים בפולי', area: 'legs', equipment: 'cable', aliases: ['פשיטת ברכיים', 'Cable Leg Extension', 'Leg Extension', 'Leg Extensions'] },
  { name: 'כפיפת ברכיים בשכיבה', area: 'legs', equipment: 'cable', aliases: ['כפיפת ברכיים', 'Lying Leg Curl', 'Leg Curl', 'Hamstring Curl', 'Cable Leg Curl'] },
] as SeedExercise[]).map((e) =>
  // Coaches say "פולי" as often as "כבל": "פרפר בכבל" is also found as "פרפר בפולי".
  e.name.endsWith(' בכבל') ? { ...e, aliases: [...(e.aliases ?? []), e.name.replace(/ בכבל$/, ' בפולי')] } : e,
);

export const AREA_LABELS: Record<string, string> = {
  legs: 'רגליים',
  back: 'גב',
  chest: 'חזה',
  shoulders: 'כתפיים',
  arms: 'ידיים',
  glutes: 'ישבן',
  core: 'בטן',
};

export function seedLibrary(db: DB): void {
  insertSeed(db);
  // Pulleys were "machine" before cables had their own kind.
  db.prepare("UPDATE exercises SET equipment = 'cable' WHERE equipment = 'machine' AND name IN ('קיקבק בכבל', 'פולי עליון')").run();
  // Fill in pictures and videos that are still empty (never overrides what a coach set).
  const fill = db.prepare(
    'UPDATE exercises SET image_url = COALESCE(image_url, ?), video_url = COALESCE(video_url, ?) WHERE name = ?',
  );
  for (const [name, m] of Object.entries(SEED_MEDIA)) fill.run(`/exercises/${m.image}.svg`, `https://www.youtube.com/watch?v=${m.video}`, name);
  adoptSeedMedia(db);
  drawCoachExercises(db);
  mergeDuplicates(db);
  coachExerciseExtras(db);
  seedExerciseDetails(db);
}

/**
 * Drawings made later for exercises coaches added (they showed the body-area placeholder until then). Only a
 * placeholder is replaced; a picture a coach chose is kept. Matched by name, spelling as the coach typed it.
 */
export const COACH_DRAWINGS: Record<string, string> = {
  'Barbell lunges': 'barbell-lunge',
  'Db bench reverse fly': 'incline-reverse-fly',
  'Plank db drage': 'plank-drag',
  'Plank db drag': 'plank-drag',
  'Trx hiplift': 'trx-hip-lift',
  'Trx hip lift': 'trx-hip-lift',
  'Trx pistol squate': 'trx-pistol-squat',
  'Trx pistol squat': 'trx-pistol-squat',
  'האנג קלין': 'hang-clean',
  'הרחקות ירך בגומיה': 'band-hip-abduction',
  'הרחקות כתף לפנים בפולי': 'cable-front-raise',
  "לאנג' צידי - דינמי": 'lateral-lunge',
  'סיידקיק עם גומייה': 'band-side-kick',
  // Added 2026-11-18.
  'Scorpion Steps': 'scorpion',
  'Static Hanging Knee Raise': 'hanging-knee-hold',
  'Weighted Reverse Crunch': 'weighted-reverse-crunch',
  'היפ תראסט רגל אחת': 'single-leg-hip-thrust',
  'הנפות ברכיים בתלייה (בטן)': 'hanging-knee-raise',
  'סקוואט לחתירה ישרה': 'squat-upright-row',
  Chinup: 'chin-up',
  "ג'אמפ סקוואט": 'jump-squat',
  'סומו סקוואט': 'sumo-squat',
  'סקוואט גביע בהגבהה': 'heel-elevated-goblet-squat',
  'חתירה ביד אחת בכבל (עליון)': 'high-cable-row',
  'כפיפות בטן על הבוסו': 'bosu-crunch',
  'כפיפת בטן צידית': 'side-crunch',
  'מתח (אקצנטרי - חזרות שליליות)': 'eccentric-pull-up',
  // Added 2026-11-20.
  'הטייה לצד עם משקל': 'side-bend',
  'הליכות מזוודה עם משקל': 'suitcase-carry',
  'הרמה קדמית עם משקל חופשי': 'dumbbell-front-raise',
  'לאנג׳ עם מדרגה (הגבהה מקדימה)': 'front-foot-elevated-lunge',
  'ספליט דדליפט רומני (בהגבהה)': 'rear-foot-elevated-rdl', // back foot on a bench
  'סקוואט משקולות על הכתפיים': 'dumbbell-shoulder-squat',
  'פשיטת מרפקים בכבל יד אחת': 'single-arm-cable-pushdown',
};

/**
 * Drawings of another exercise that stood in for these when they were added (the closest one the app found). They
 * are replaced by the exercise's own drawing; any other picture a coach chose is kept.
 */
const STAND_INS: Record<string, string[]> = {
  'chin-up': ['pull-up'],
  'eccentric-pull-up': ['pull-up'],
  'jump-squat': ['back-squat', 'box-squat', 'goblet-squat', 'front-squat'],
  'sumo-squat': ['back-squat', 'box-squat', 'goblet-squat', 'front-squat'],
  'heel-elevated-goblet-squat': ['goblet-squat'],
  'high-cable-row': ['single-arm-cable-row'],
  'bosu-crunch': ['cable-crunch'],
  'side-crunch': ['cable-crunch'],
  'single-arm-cable-pushdown': ['triceps-pushdown'],
};

interface CoachExtra {
  video: string;
  cues: string[];
  /** The other muscle groups it works, written only while none were chosen. */
  groups?: string[];
  /** The main body area, corrected (only together with the groups, so once) when the coach picked another one. */
  area?: string;  /**
   * A coach's first guess that is replaced once: when the exercise still has exactly these values, the area, groups
   * and cues above are written over them. Any later change by a coach no longer matches, so it is kept.
   */
  fixFrom?: { area?: string; groups?: string; cues?: string };
}

/**
 * Demo video and technique cues for the exercises coaches added, by their drawing. The video
 * replaces only the automatic YouTube search link, and cues are written only where there are none: what a coach
 * set is kept. Videos found on 2026-11-17.
 */
export const COACH_EXTRAS: Record<string, CoachExtra> = {
  'barbell-lunge': {
    video: 'qfpaNBDhidg',
    cues: [
      'המוט על הגב העליון, חזה פתוח ומבט קדימה',
      'צעד ארוך, הברך האחורית יורדת עד כמעט נגיעה ברצפה',
      'הברך הקדמית בכיוון האצבעות, לא קורסת פנימה',
      'דוחפים מכל כף הרגל הקדמית חזרה למעלה',
    ],
    groups: ['legs', 'glutes'],
  },
  'incline-reverse-fly': {
    video: '7pE90Lysxss',
    cues: [
      'החזה צמוד לספסל בשיפוע, הצוואר ארוך',
      'מרפקים מעט כפופים ונעולים לאורך כל התנועה',
      'מרימים לצדדים עד גובה הכתפיים ומקרבים את השכמות',
      'יורדים לאט, בלי תנופה',
    ],
    groups: ['shoulders', 'back'],
  },
  'plank-drag': {
    video: '8jXEKccX7mQ',
    cues: [
      'פלאנק גבוה: כפות הידיים מתחת לכתפיים, רגליים מעט פתוחות',
      'האגן יציב ומקביל לרצפה, לא מתנדנד מצד לצד',
      'יד אחת גוררת את המשקולת לצד השני מתחת לגוף',
      'בטן וישבן מכווצים לאורך כל הסט',
    ],
    groups: ['core', 'shoulders'],
  },
  'trx-hip-lift': {
    video: 'TQMHyynLbkc',
    cues: [
      'שוכבים על הגב, העקבים ברצועות מתחת לנקודת העיגון',
      'הידיים על הרצפה לצד הגוף',
      'דוחפים בעקבים ומכווצים ישבן עד קו ישר מהכתפיים לעקבים',
      'עוצרים רגע למעלה ויורדים לאט, בלי לקשת את הגב התחתון',
    ],
    area: 'glutes',
    groups: ['legs', 'core'],
  },
  'trx-pistol-squat': {
    video: 'htMldsOurDQ',
    cues: [
      'אוחזים בידיות מול העיגון, הרצועות מתוחות',
      'רגל אחת ישרה קדימה, יורדים עם הישבן לאחור',
      'הברך של רגל העמידה בכיוון האצבעות, העקב על הרצפה',
      'הידיים עוזרות רק כמה שצריך, הרגל עושה את העבודה',
    ],
    groups: ['legs', 'glutes', 'core'],
  },
  'hang-clean': {
    video: '6ms0g--1vQY',
    cues: [
      'מעמידה עם המוט יורדים בהטיה עד מעל הברכיים, גב ישר',
      'פתיחה חזקה של הירכיים והברכיים, המוט צמוד לגוף',
      'מרפקים מסתובבים מהר קדימה מתחת למוט',
      'קולטים בפרונט ראק: מרפקים גבוהים, ברכיים מעט כפופות',
    ],
    area: 'legs',
    groups: ['glutes', 'back', 'shoulders'],
  },
  'band-hip-abduction': {
    video: '4qr26RNU3EQ',
    cues: [
      'הגומייה מעל הברכיים או סביב הקרסוליים, עמידה זקופה',
      'מרחיקים את הרגל לצד מהירך, בלי להטות את הגוף',
      'האצבעות מכוונות קדימה, לא מסובבים את הרגל החוצה',
      'חוזרים לאט, הגומייה נשארת מתוחה',
    ],
    area: 'glutes',
    groups: [],
  },
  'lateral-lunge': {
    video: 'apsp_uuXZTU',
    cues: [
      'צעד רחב לצד, כפות הרגליים מכוונות קדימה',
      'יורדים עם הישבן לאחור על הרגל הצועדת, הרגל השנייה ישרה',
      'חזה פתוח, הברך בכיוון האצבעות',
      'דוחפים חזק מהרגל הכפופה חזרה למרכז',
    ],
    groups: ['legs', 'glutes'],
  },
  'band-side-kick': {
    video: 'ouaU8aG8owA',
    cues: [
      'גומייה סביב הקרסוליים, עומדים על רגל אחת עם ברך רכה',
      'בועטים לצד ומעט לאחור, התנועה יוצאת מהישבן',
      'הגוף נשאר זקוף, לא נשענים לצד השני',
      'חוזרים בשליטה, לא נותנים לגומייה למשוך את הרגל',
    ],
    area: 'glutes',
    groups: [],
  },
  'cable-front-raise': {
    video: 'RsbyWwhaWBs',
    cues: [
      'הידית בגובה הירך, עמידה יציבה ובטן מכווצת',
      'מרימים קדימה ביד כמעט ישרה עד גובה הכתף',
      'לא מתנדנדים לאחור כדי להרים',
      'יורדים לאט ובשליטה',
    ],
    groups: [],
  },
  // Added 2026-11-18 (videos found that day).
  // In a glute workout, "10-12 each direction": a banded diagonal walk, stepping back and out (and forward).
  scorpion: {
    video: 'RZf4zd-2Ig0',
    cues: [
      'גומייה מעל הברכיים, חצי סקוואט וגב ישר',
      'צעד באלכסון לאחור ולצד, הרגל השנייה מצטרפת בלי לאבד מתח',
      'הברכיים דוחפות החוצה נגד הגומייה, לא קורסות פנימה',
      'נשארים נמוכים לאורך כל ההליכה, ואז באותו מספר צעדים לכיוון השני',
    ],
    area: 'glutes',
    groups: ['legs'],
  },
  'hanging-knee-hold': {
    video: 'L7F8XLyYYnE',
    cues: [
      'תלייה פעילה על המוט, כתפיים למטה',
      'מרימים את הברכיים לפחות לגובה הירך ומחזיקים',
      'האגן מעט מגולגל קדימה, בטן מכווצת',
      'לא מתנדנדים, נושמים לאורך ההחזקה',
    ],
    groups: [],
  },
  'weighted-reverse-crunch': {
    video: 'x8pv9xx0g6A',
    cues: [
      'שוכבים על הגב, המשקולת בין הברכיים או כפות הרגליים',
      'מגלגלים את האגן מהרצפה ומביאים את הברכיים לחזה',
      'הבטן עושה את העבודה, בלי תנופה מהרגליים',
      'יורדים לאט עד שהגב התחתון שוב על הרצפה',
    ],
    groups: [],
  },
  'single-leg-hip-thrust': {
    video: 'vYHqQmurSUk',
    cues: [
      'השכמות על הספסל, רגל אחת על הרצפה והשנייה באוויר',
      'דוחפים בעקב של הרגל שעל הרצפה',
      'האגן עולה ישר, לא נוטה לצד',
      'מכווצים ישבן למעלה ויורדים לאט',
    ],
    area: 'glutes',
    groups: ['legs', 'core'],
  },
  'hanging-knee-raise': {
    video: 'MRcpnl4G3YA',
    cues: [
      'תלייה פעילה על המוט, כתפיים למטה',
      'מרימים את הברכיים לחזה ומגלגלים את האגן',
      'בלי תנופה, הגוף לא מתנדנד',
      'יורדים לאט עד רגליים ישרות',
    ],
    area: 'core',
    groups: [],
  },
  'squat-upright-row': {
    video: 'ZNr1_Cfl9ME',
    cues: [
      'המשקולות לפני הירכיים, יורדים לסקוואט עם גב ישר',
      'עולים חזק ובהמשך מושכים את המשקולות לגובה החזה',
      'המרפקים מובילים למעלה ולצדדים, מעל כפות הידיים',
      'מורידים את הידיים ויורדים לסקוואט הבא',
    ],
    groups: ['glutes', 'shoulders'],
  },
  // More coach-added exercises from the library (videos found that day).
  'chin-up': {
    video: '53kV7Ou7oZo',
    cues: [
      'אחיזה הפוכה (כפות הידיים אליכם) ברוחב כתפיים',
      'מתחילים מתלייה מלאה, כתפיים למטה',
      'מושכים עד שהסנטר מעל המוט, המרפקים צמודים לגוף',
      'יורדים לאט עד ידיים ישרות, בלי תנופה',
    ],
    groups: ['back', 'biceps'],
  },
  'eccentric-pull-up': {
    video: 'bn76WhQQMlI',
    cues: [
      'עולים למעלה בקפיצה או בעזרת קופסה, הסנטר מעל המוט',
      'יורדים לאט ככל האפשר, 3-5 שניות',
      'שליטה לאורך כל הירידה עד ידיים ישרות',
      'יורדים מהמוט ועולים שוב, לא מושכים למעלה',
    ],
    groups: ['back', 'biceps'],
  },
  'jump-squat': {
    video: '4WYZBd2OmPY',
    cues: [
      'יורדים לסקוואט עם גב ישר',
      'קופצים למעלה בכל הכוח, הידיים עוזרות',
      'נוחתים רך על כל כף הרגל, ברכיים מעט כפופות',
      'הברכיים בכיוון האצבעות בנחיתה',
    ],
    groups: ['legs', 'glutes'],
  },
  'sumo-squat': {
    video: '3h1A9GfB07w',
    cues: [
      'עמידה רחבה, האצבעות מעט החוצה',
      'המשקולת תלויה בין הרגליים, ידיים ישרות',
      'יורדים ישר למטה, הברכיים נפתחות החוצה',
      'גב זקוף, עולים בכיווץ ישבן',
    ],
    groups: ['legs', 'glutes'],
  },
  'heel-elevated-goblet-squat': {
    video: 'lt9BKstdwdU',
    cues: [
      'העקבים על פלטה או טריז, המשקולת צמודה לחזה',
      'יורדים עמוק, הברכיים מתקדמות מעבר לאצבעות',
      'גוף זקוף לאורך כל התנועה',
      'עולים בשליטה, הלחץ על הירך הקדמית',
    ],
    groups: ['legs', 'glutes'],
  },
  'high-cable-row': {
    video: 'mGlzyVZ29jQ',
    cues: [
      'הכבל גבוה, יד ישרה למעלה וקדימה',
      'מושכים את המרפק למטה ולאחור, לצד הגוף',
      'מקרבים שכמה, הכתף לא עולה לאוזן',
      'חוזרים לאט עד מתיחה מלאה',
    ],
    groups: ['back', 'biceps', 'shoulders'],
  },
  'bosu-crunch': {
    video: 'KjvDgHPxXcg',
    cues: [
      'הגב התחתון על הבוסו, כפות הרגליים על הרצפה',
      'ידיים ליד הראש בלי למשוך את הצוואר',
      'מקפלים את הגב העליון ומכווצים בטן',
      'חוזרים לאט עד מתיחה מעל הבוסו',
    ],
    groups: [],
  },
  'side-crunch': {
    video: 'p_gI3YGsk9Y',
    cues: [
      'שוכבים על הגב, ברכיים כפופות',
      'מסובבים ומרימים כתף אחת לכיוון הברך הנגדית',
      'התנועה יוצאת מהבטן הצידית, לא מהצוואר',
      'יורדים לאט ומחליפים צד',
    ],
    groups: [],
  },
  // More coach-added exercises (videos found that day).
  'side-bend': {
    video: 'ltVi1F5SBkE',
    cues: [
      'עמידה ברוחב כתפיים, משקולת ביד אחת והיד השנייה על המותן',
      'מטים את הגוף לצד המשקולת, בלי להתכופף קדימה או לאחור',
      'עולים בכיווץ הבטן הצידית של הצד השני עד עמידה זקופה',
      'אגן יציב, התנועה רק מהמותניים, ואותו מספר חזרות לכל צד',
    ],
    groups: [],
    // Added with shoulders as a second group; a side bend works the core only.
    fixFrom: { groups: 'shoulders' },
  },
  'suitcase-carry': {
    video: 'y-hn_Ha1-RE',
    cues: [
      'משקולת כבדה ביד אחת לצד הגוף, היד השנייה חופשית',
      'הולכים זקוף, לא נוטים לצד המשקולת',
      'כתפיים בגובה שווה, בטן מכווצת ושכמות למטה',
      'צעדים קצרים ושקטים, ומחליפים יד באמצע',
    ],
    area: 'core',
    groups: ['shoulders'],
    // Added under arms (shown as biceps); a suitcase carry is a core exercise, with grip and shoulders holding on.
    fixFrom: { area: 'arms', groups: 'shoulders,core' },
  },
  'dumbbell-front-raise': {
    video: '2oSVPyjO2nc',
    cues: [
      'משקולות לפני הירכיים, ברכיים רכות ובטן מכווצת',
      'מרימים קדימה ביד כמעט ישרה עד גובה הכתף',
      'לא מתנדנדים לאחור כדי להרים',
      'יורדים לאט ובשליטה',
    ],
    groups: [],
    // Added with a one-line description as its only cue.
    fixFrom: { cues: 'הנפת משקל לפנים עד גובה הכתף' },
  },
  'front-foot-elevated-lunge': {
    video: 'FA1-YHsgCcY',
    cues: [
      'עומדים על מדרגה או פלטה נמוכה, משקולות לצד הגוף',
      'צעד ארוך לאחור לרצפה, הרגל הקדמית נשארת על המדרגה',
      'יורדים עמוק, הברך האחורית כמעט נוגעת ברצפה',
      'דוחפים מכל כף הרגל הקדמית וחוזרים למדרגה',
    ],
    groups: ['glutes'],
  },
  'rear-foot-elevated-rdl': {
    video: 'X9tK2T0ZdgA',
    cues: [
      'הרגל האחורית על ספסל, כמו בבולגרי, והרגל הקדמית נושאת את המשקל',
      'ברך קדמית רכה, מטים את הגוף קדימה עם הישבן לאחור',
      'גב ישר, המשקולות יורדות צמוד לרגל הקדמית',
      'יורדים עד מתיחה בירך האחורית ועולים בכיווץ ישבן',
    ],
    groups: ['glutes', 'back'],
  },
  'dumbbell-shoulder-squat': {
    video: 'QSleSxhvs7s',
    cues: [
      'המשקולות מונחות על הכתפיים, מרפקים קדימה',
      'עמידה ברוחב כתפיים, יורדים עם הישבן לאחור ולמטה',
      'חזה פתוח וגב ישר, הברכיים בכיוון האצבעות',
      'דוחפים מכל כף הרגל חזרה למעלה',
    ],
    groups: ['glutes', 'core'],
  },
  'single-arm-cable-pushdown': {
    video: 'FSD-tbnEX2k',
    cues: [
      'הכבל גבוה, אחיזה ביד אחת, המרפק צמוד לצד הגוף',
      'פושטים את המרפק עד יד ישרה למטה',
      'רק האמה זזה, הכתף והמרפק נשארים במקום',
      'חוזרים לאט עד זווית של 90 מעלות',
    ],
    groups: [],
  },
};

function coachExerciseExtras(db: DB): void {
  const byKey = new Map(Object.entries(COACH_DRAWINGS).map(([n, slug]) => [normalizeName(n), slug]));
  const rows = db.prepare('SELECT id, name, body_area, video_url, cues, muscle_groups FROM exercises').all() as {
    id: number;
    name: string;
    body_area: string;
    video_url: string | null;
    cues: string | null;
    muscle_groups: string | null;
  }[];
  const setVideo = db.prepare('UPDATE exercises SET video_url = ?, media_auto = 0 WHERE id = ?');
  const setCues = db.prepare('UPDATE exercises SET cues = ? WHERE id = ?');
  const setGroups = db.prepare('UPDATE exercises SET muscle_groups = ? WHERE id = ?');
  const setArea = db.prepare('UPDATE exercises SET body_area = ? WHERE id = ?');
  for (const r of rows) {
    const slug = byKey.get(normalizeName(r.name));
    const x = slug && COACH_EXTRAS[slug];
    if (!x) continue;
    if (!r.video_url || r.video_url.startsWith('https://www.youtube.com/results')) {
      setVideo.run(`https://www.youtube.com/watch?v=${x.video}`, r.id);
    }
    if (!r.cues?.trim()) setCues.run(x.cues.join('\n'), r.id);
    if (x.groups && r.muscle_groups == null) {
      if (x.area) setArea.run(x.area, r.id);
      setGroups.run(x.groups.join(','), r.id);
    }
    const f = x.fixFrom;
    if (
      f &&
      (f.area === undefined || r.body_area === f.area) &&
      (f.groups === undefined || r.muscle_groups === f.groups) &&
      (f.cues === undefined || r.cues === f.cues)
    ) {
      if (f.area !== undefined && x.area) setArea.run(x.area, r.id);
      if (f.groups !== undefined && x.groups) setGroups.run(x.groups.join(','), r.id);
      if (f.cues !== undefined) setCues.run(x.cues.join('\n'), r.id);
    }
  }
}

/** Cues and muscle groups for the starter exercises, where none are set yet. */
function seedExerciseDetails(db: DB): void {
  const setCues = db.prepare("UPDATE exercises SET cues = ? WHERE name = ? AND (cues IS NULL OR TRIM(cues) = '')");
  for (const [name, cues] of Object.entries(SEED_CUES)) setCues.run(cues.join('\n'), name);
  const setGroups = db.prepare('UPDATE exercises SET muscle_groups = ? WHERE name = ? AND muscle_groups IS NULL');
  for (const [name, groups] of Object.entries(SEED_GROUPS)) setGroups.run(groups.join(','), name);
}

function drawCoachExercises(db: DB): void {
  const byKey = new Map(Object.entries(COACH_DRAWINGS).map(([n, slug]) => [normalizeName(n), slug]));
  const rows = db.prepare('SELECT id, name, image_url, media_auto FROM exercises').all() as {
    id: number;
    name: string;
    image_url: string | null;
    media_auto: number;
  }[];
  const set = db.prepare('UPDATE exercises SET image_url = ? WHERE id = ?');
  for (const r of rows) {
    const slug = byKey.get(normalizeName(r.name));
    if (!slug) continue;
    const pic = `/exercises/${slug}.svg`;
    const standIn = (STAND_INS[slug] ?? []).some((s) => r.image_url === `/exercises/${s}.svg`);
    if (r.image_url !== pic && (!r.image_url || isGenericPicture(r.image_url) || r.media_auto === 1 || standIn)) set.run(pic, r.id);
  }
}

/**
 * Exercises a coach added twice under another name: the copy is folded into the library
 * exercise. Its logs, workouts and names move over, and its name stays as an alias so it is still recognised.
 */
export const DUPLICATES: Record<string, string> = {
  'לחיצות כתף עם מוט': 'לחיצת כתפיים',
  'כפיפת ברך בשכיבה': 'כפיפת ברכיים בשכיבה',
};

function mergeDuplicates(db: DB): void {
  const all = db.prepare('SELECT id, name FROM exercises').all() as { id: number; name: string }[];
  const find = (n: string) => all.find((e) => normalizeName(e.name) === normalizeName(n));
  for (const [dupName, keepName] of Object.entries(DUPLICATES)) {
    const dup = find(dupName);
    const keep = find(keepName);
    if (!dup || !keep || dup.id === keep.id) continue;
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE class_exercises SET exercise_id = ? WHERE exercise_id = ?').run(keep.id, dup.id);
      db.prepare('UPDATE exercise_entries SET exercise_id = ? WHERE exercise_id = ?').run(keep.id, dup.id);
      db.prepare('UPDATE unknown_names SET resolved_exercise_id = ? WHERE resolved_exercise_id = ?').run(keep.id, dup.id);
      db.prepare('UPDATE exercise_aliases SET exercise_id = ? WHERE exercise_id = ?').run(keep.id, dup.id);
      db.prepare('DELETE FROM exercises WHERE id = ?').run(dup.id);
      addAlias(db, keep.id, dup.name);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

/**
 * A coach added an exercise before it was a starter one (e.g. "טורקיש גט אפ" the same day): if it still has the
 * picture and video chosen automatically, it gets the starter's drawing and video. What a coach chose is kept.
 */
function adoptSeedMedia(db: DB): void {
  const rows = db
    .prepare("SELECT id, name, image_url FROM exercises WHERE media_auto = 1 OR image_url LIKE '/exercises/generic-%'")
    .all() as { id: number; name: string; image_url: string | null }[];
  if (!rows.length) return;
  const aliasesOf = db.prepare('SELECT alias_key FROM exercise_aliases WHERE exercise_id = ?');
  const set = db.prepare('UPDATE exercises SET image_url = ?, video_url = ?, media_auto = 0 WHERE id = ?');
  for (const r of rows) {
    const keys = [normalizeName(r.name), ...(aliasesOf.all(r.id) as { alias_key: string }[]).map((a) => a.alias_key)];
    const seed = SEED_EXERCISES.find((s) => {
      if (!SEED_MEDIA[s.name]) return false;
      const seedKeys = [s.name, ...(s.aliases ?? [])].map(normalizeName);
      return seedKeys.some((k) => keys.includes(k)) || similarity(normalizeName(s.name), keys[0]) >= 0.85;
    });
    if (!seed) continue;
    const m = SEED_MEDIA[seed.name];
    set.run(`/exercises/${m.image}.svg`, `https://www.youtube.com/watch?v=${m.video}`, r.id);
  }
}

/**
 * Adds the starter exercises that aren't in the library yet (so later additions reach a running studio too).
 * An exercise a coach already added under one of the names is left alone, and an alias never moves to another exercise.
 */
function insertSeed(db: DB): void {
  const insEx = db.prepare(
    'INSERT INTO exercises (name, body_area, equipment, weight_step, tracks_weight) VALUES (?, ?, ?, ?, ?)',
  );
  const byName = db.prepare('SELECT id FROM exercises WHERE name = ?');
  const aliasOwner = db.prepare('SELECT exercise_id FROM exercise_aliases WHERE alias_key = ?');
  const existing = (db.prepare('SELECT name FROM exercises').all() as { name: string }[]).map((r) => normalizeName(r.name));
  const deleted = new Set((db.prepare('SELECT name_key FROM deleted_exercises').all() as { name_key: string }[]).map((r) => r.name_key));
  for (const e of SEED_EXERCISES) {
    // The owner deleted it: stays deleted.
    if (deleted.has(normalizeName(e.name))) continue;
    const have = byName.get(e.name) as { id: number } | undefined;
    if (have) {
      // Aliases added to a starter exercise later reach a running studio too (never taken from another exercise).
      for (const a of e.aliases ?? []) if (!aliasOwner.get(normalizeName(a))) addAlias(db, have.id, a);
      continue;
    }
    const key = normalizeName(e.name);
    if (aliasOwner.get(key)) continue;
    // A coach already added it with a slightly different spelling ("פייספול").
    if (existing.some((n) => similarity(key, n) >= 0.85)) continue;
    existing.push(key);
    const tracksWeight = e.equipment === 'bodyweight' ? 0 : 1;
    const { lastInsertRowid } = insEx.run(e.name, e.area, e.equipment, e.step ?? 2.5, tracksWeight);
    for (const a of e.aliases ?? []) if (!aliasOwner.get(normalizeName(a))) addAlias(db, Number(lastInsertRowid), a);
  }
}

export function addAlias(db: DB, exerciseId: number, alias: string): void {
  db.prepare('INSERT OR REPLACE INTO exercise_aliases (alias_key, alias, exercise_id) VALUES (?, ?, ?)').run(
    normalizeName(alias),
    alias,
    exerciseId,
  );
}

export function buildNameIndex(db: DB): NameIndexEntry[] {
  const exercises = db.prepare('SELECT id, name FROM exercises').all() as { id: number; name: string }[];
  const byId = new Map(exercises.map((e) => [e.id, e.name]));
  const index: NameIndexEntry[] = exercises.map((e) => ({ exerciseId: e.id, name: e.name, key: normalizeName(e.name) }));
  const aliases = db.prepare('SELECT alias_key, exercise_id FROM exercise_aliases').all() as {
    alias_key: string;
    exercise_id: number;
  }[];
  for (const a of aliases) index.push({ exerciseId: a.exercise_id, name: byId.get(a.exercise_id) ?? '', key: a.alias_key });
  return index;
}

// ---------- Editing the library (coaches) ----------

const AREAS = Object.keys(AREA_LABELS);
const EQUIPMENT = ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'ball', 'bodyweight'];

export interface ExerciseInput {
  name: string;
  bodyArea: string;
  equipment: string;
  weightStep: number;
  tracksWeight: boolean;
  imageUrl?: string | null;
  videoUrl?: string | null;
  /** Technique cues, one per line. Left out = unchanged. */
  cues?: string | null;
  aliases?: string[];
  /** The other muscle groups it works, by id (the main one comes from bodyArea). Left out = unchanged. */
  muscleGroups?: string[] | null;
}

export class LibraryError extends Error {}

function validUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  if (/^\/exercises\/[a-z0-9-]+\.svg$/.test(u)) return u; // our own drawings
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:') throw new Error();
    return url.toString();
  } catch {
    throw new LibraryError('קישור לא תקין (צריך להתחיל ב-https)');
  }
}

function checkInput(e: ExerciseInput) {
  if (!e.name?.trim()) throw new LibraryError('חסר שם');
  if (!AREAS.includes(e.bodyArea)) throw new LibraryError('אזור בגוף לא תקין');
  if (!EQUIPMENT.includes(e.equipment)) throw new LibraryError('ציוד לא תקין');
  if (!(e.weightStep > 0 && e.weightStep <= 50)) throw new LibraryError('קפיצת משקל לא תקינה');
}

/** An alias may point to one exercise only. */
function setAliases(db: DB, exerciseId: number, aliases: string[]) {
  db.prepare('DELETE FROM exercise_aliases WHERE exercise_id = ?').run(exerciseId);
  for (const a of aliases.map((x) => x.trim()).filter(Boolean)) {
    const key = normalizeName(a);
    const other = db.prepare('SELECT exercise_id FROM exercise_aliases WHERE alias_key = ?').get(key) as { exercise_id: number } | undefined;
    if (other && other.exercise_id !== exerciseId) throw new LibraryError(`הכינוי ״${a}״ כבר שייך לתרגיל אחר`);
    addAlias(db, exerciseId, a);
  }
}

export interface SimilarExercise {
  id: number;
  name: string;
}

/**
 * Before a coach adds an exercise: is it already in the library under this name or one of its aliases (exact),
 * or is there one with a close name (similar)? Catches typos, plural/singular, Hebrew vs English names.
 */
export function findSimilar(db: DB, names: string[], excludeId = 0): { exact: SimilarExercise | null; similar: SimilarExercise[] } {
  const keys = names.map((n) => normalizeName(n)).filter(Boolean);
  const index = buildNameIndex(db).filter((e) => e.exerciseId !== excludeId);
  for (const k of keys) {
    const hit = index.find((e) => e.key === k);
    if (hit) return { exact: { id: hit.exerciseId, name: hit.name }, similar: [] };
  }
  const best = new Map<number, { id: number; name: string; score: number }>();
  for (const k of keys)
    for (const e of index) {
      // Every word of one name inside the other ("פשיטת מרפקים" / "פשיטת מרפקים בכבל") counts as close too.
      const words = (s: string) => s.split(' ').filter((w) => w.length > 1);
      const a = words(k);
      const b = words(e.key);
      const contained = a.length > 0 && b.length > 0 && (a.every((w) => b.includes(w)) || b.every((w) => a.includes(w)));
      const score = Math.max(similarity(k, e.key), contained ? 0.75 : 0);
      const cur = best.get(e.exerciseId);
      if (score >= 0.6 && (!cur || score > cur.score)) best.set(e.exerciseId, { id: e.exerciseId, name: e.name, score });
    }
  const similar = [...best.values()].sort((x, y) => y.score - x.score).slice(0, 4).map(({ id, name }) => ({ id, name }));
  return { exact: null, similar };
}

/** The coach tried to add an exercise that is (or may be) already in the library. */
export class DuplicateExerciseError extends LibraryError {
  constructor(
    public exact: SimilarExercise | null,
    public similar: SimilarExercise[],
  ) {
    super(exact ? `התרגיל כבר קיים בספרייה: ${exact.name}` : 'יש בספרייה תרגילים דומים. אולי התכוונת לאחד מהם?');
  }
}

/** A picture for a new exercise: the drawing of the closest exercise (same body area and equipment, similar name). */
/** How alike a name must be for its drawing to stand in for a new exercise (same body area too). */
const PICTURE_SIMILARITY = 0.6;

/** The placeholder drawing for a body area: shown until a proper drawing is made for the exercise. */
export const genericPicture = (bodyArea: string) => `/exercises/generic-${bodyArea}.svg`;
export const isGenericPicture = (url: string | null | undefined) => !!url && url.startsWith('/exercises/generic-');

/**
 * The drawing of the most alike exercise of the same body area, if one is truly alike; otherwise the body area's
 * placeholder, so a trainee never sees a drawing of a different exercise.
 */
function closestPicture(db: DB, e: ExerciseInput): string {
  const rows = db
    .prepare("SELECT name, equipment, image_url FROM exercises WHERE body_area = ? AND image_url LIKE '/exercises/%' AND image_url NOT LIKE '/exercises/generic-%'")
    .all(e.bodyArea) as any[];
  let best: { url: string; score: number } | null = null;
  const key = normalizeName(e.name);
  for (const r of rows) {
    const sim = similarity(key, normalizeName(r.name));
    if (sim < PICTURE_SIMILARITY) continue;
    const score = sim + (r.equipment === e.equipment ? 0.1 : 0);
    if (!best || score > best.score) best = { url: r.image_url, score };
  }
  return best?.url ?? genericPicture(e.bodyArea);
}

/** A demo video for a new exercise: a YouTube search by its English name (from the aliases) when there is one. */
function videoSearch(e: ExerciseInput): string {
  const english = (e.aliases ?? []).find((a) => /^[a-z0-9 \-']+$/i.test(a.trim()));
  const q = english ? `${english.trim()} exercise how to` : `${e.name.trim()} תרגיל`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/**
 * A coach adds an exercise. Refused if it's already there under any name; if a close one exists the coach is asked
 * first (`confirmNew` = "it's really a different exercise"). Every new exercise gets a picture and a video link:
 * the coach's own, or chosen automatically (marked, so the library shows they're worth checking).
 */
export function createExercise(db: DB, e: ExerciseInput & { confirmNew?: boolean }, createdBy: number | null = null): number {
  checkInput(e);
  const dup = findSimilar(db, [e.name, ...(e.aliases ?? [])]);
  if (dup.exact) throw new DuplicateExerciseError(dup.exact, []);
  if (dup.similar.length && !e.confirmNew) throw new DuplicateExerciseError(null, dup.similar);
  const image = validUrl(e.imageUrl) ?? closestPicture(db, e);
  const video = validUrl(e.videoUrl) ?? videoSearch(e);
  const auto = !e.imageUrl || !e.videoUrl ? 1 : 0;
  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO exercises (name, body_area, equipment, weight_step, tracks_weight, image_url, video_url, media_auto, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(e.name.trim(), e.bodyArea, e.equipment, e.weightStep, e.tracksWeight ? 1 : 0, image, video, auto, createdBy, new Date().toISOString());
  const id = Number(lastInsertRowid);
  setAliases(db, id, e.aliases ?? []);
  if (e.cues !== undefined) db.prepare('UPDATE exercises SET cues = ? WHERE id = ?').run(cleanCues(e.cues), id);
  if (e.muscleGroups) db.prepare('UPDATE exercises SET muscle_groups = ? WHERE id = ?').run(storedGroups(e), id);
  // Added again after the owner deleted it: no longer counts as deleted.
  const del = db.prepare('DELETE FROM deleted_exercises WHERE name_key = ?');
  for (const n of [e.name, ...(e.aliases ?? [])]) del.run(normalizeName(n));
  return id;
}

export function updateExercise(db: DB, id: number, e: ExerciseInput): void {
  checkInput(e);
  const clash = findSimilar(db, [e.name], id).exact;
  if (clash) throw new LibraryError(`השם כבר שייך לתרגיל ${clash.name}`);
  // Saved by a coach: the picture and video are now theirs.
  const r = db
    .prepare(
      'UPDATE exercises SET name = ?, body_area = ?, equipment = ?, weight_step = ?, tracks_weight = ?, image_url = ?, video_url = ?, media_auto = 0 WHERE id = ?',
    )
    .run(e.name.trim(), e.bodyArea, e.equipment, e.weightStep, e.tracksWeight ? 1 : 0, validUrl(e.imageUrl), validUrl(e.videoUrl), id);
  if (Number(r.changes) === 0) throw new LibraryError('התרגיל לא נמצא');
  if (e.aliases) setAliases(db, id, e.aliases);
  if (e.cues !== undefined) db.prepare('UPDATE exercises SET cues = ? WHERE id = ?').run(cleanCues(e.cues), id);
  if (e.muscleGroups) db.prepare('UPDATE exercises SET muscle_groups = ? WHERE id = ?').run(storedGroups(e), id);
}

/** What to store for the coach's choice of other muscle groups: NULL when it's just the guess by name. */
function storedGroups(e: ExerciseInput): string | null {
  const main = groupOf(e.bodyArea, e.name);
  const chosen = GROUPS.map((g) => g.id).filter((g) => g !== main && (e.muscleGroups ?? []).includes(g));
  const guess = guessedExtras(e.bodyArea, e.name);
  return chosen.join(',') === GROUPS.map((g) => g.id).filter((g) => guess.includes(g)).join(',') ? null : chosen.join(',');
}

function cleanCues(text: string | null): string | null {
  const lines = (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines.join('\n').slice(0, 2000) : null;
}

export function aliasesOf(db: DB, id: number): string[] {
  return (db.prepare('SELECT alias FROM exercise_aliases WHERE exercise_id = ? ORDER BY alias').all(id) as any[]).map((r) => r.alias);
}
