// path: src/js/themeEngine.js
// context: javascript / themeEngine.js / browser-runtime / target: mobile-android

// 7 Fundamental Atmospheric Themes for Day-of-Week Cycling
export const DAYS_CONFIG = [
  {
    dayIndex: 0,
    name: 'Sunday',
    badge: 'Serenity & Connection',
    particleMode: 'amber_sun',
    orbColors: ['#f59e0b', '#d97706', '#b45309'],
    accentHex: '#f59e0b',
    accentGradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    glassBorder: 'rgba(245, 158, 11, 0.25)',
    greeting: 'Peaceful Sunday'
  },
  {
    dayIndex: 1,
    name: 'Monday',
    badge: 'Momentum & Drive',
    particleMode: 'cyan_pulse',
    orbColors: ['#0284c7', '#0369a1', '#075985'],
    accentHex: '#38bdf8',
    accentGradient: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
    glassBorder: 'rgba(56, 189, 248, 0.25)',
    greeting: 'Empowered Monday'
  },
  {
    dayIndex: 2,
    name: 'Tuesday',
    badge: 'Sakura Flow',
    particleMode: 'cherry_blossom',
    orbColors: ['#ec4899', '#be185d', '#9d174d'],
    accentHex: '#ec4899',
    accentGradient: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
    glassBorder: 'rgba(236, 72, 153, 0.25)',
    greeting: 'Flowing Tuesday'
  },
  {
    dayIndex: 3,
    name: 'Wednesday',
    badge: 'Equilibrium & Recharge',
    particleMode: 'purple_nebula',
    orbColors: ['#8b5cf6', '#6d28d9', '#4c1d95'],
    accentHex: '#a855f7',
    accentGradient: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    glassBorder: 'rgba(168, 85, 247, 0.25)',
    greeting: 'Balanced Wednesday'
  },
  {
    dayIndex: 4,
    name: 'Thursday',
    badge: 'Creative Spark',
    particleMode: 'cherry_blossom',
    orbColors: ['#d946ef', '#c026d3', '#86198f'],
    accentHex: '#e879f9',
    accentGradient: 'linear-gradient(135deg, #e879f9 0%, #d946ef 100%)',
    glassBorder: 'rgba(232, 121, 249, 0.25)',
    greeting: 'Inspired Thursday'
  },
  {
    dayIndex: 5,
    name: 'Friday',
    badge: 'Triumph & Gratitude',
    particleMode: 'golden_spark',
    orbColors: ['#f97316', '#ea580c', '#c2410c'],
    accentHex: '#fb923c',
    accentGradient: 'linear-gradient(135deg, #fb923c 0%, #f43f5e 100%)',
    glassBorder: 'rgba(251, 146, 60, 0.25)',
    greeting: 'Golden Friday'
  },
  {
    dayIndex: 6,
    name: 'Saturday',
    badge: 'Sanctuary & Joy',
    particleMode: 'purple_nebula',
    orbColors: ['#6366f1', '#4f46e5', '#3730a3'],
    accentHex: '#818cf8',
    accentGradient: 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)',
    glassBorder: 'rgba(129, 140, 248, 0.25)',
    greeting: 'Radiant Saturday'
  }
];

// FULL DATE-BY-DATE ROUTINES & PROMPTS: OCTOBER & NOVEMBER (ALL 61 DAYS)
export const CALENDAR_ROUTINES = {
  // --- OCTOBER (31 DAYS) ---
  '10-01': {
    title: 'October Opening: The Blank Canvas',
    routine: 'Morning: Set 3 non-negotiable month intentions. Afternoon: Clear physical & digital clutter. Evening: Journal your baseline mindset.',
    prompt: 'A new month rises. What chapter of your life are you choosing to write in October? What old habit are you leaving behind?'
  },
  '10-02': {
    title: 'Autumn Cadence: Pacing Your Energy',
    routine: 'Morning: 5-minute silent breathing before checking screens. Afternoon: 25-minute deep focus block without notifications.',
    prompt: 'Where has your attention been leaking lately? Name one boundary you can set today to reclaim your inner peace.'
  },
  '10-03': {
    title: 'Weekend Unwind & Connection',
    routine: 'Morning: Slow walk outdoors without headphones. Afternoon: Reach out to one meaningful friend or family member.',
    prompt: 'Relationships are living gardens. Who in your circle made you smile recently? Send them a quick text of appreciation.'
  },
  '10-04': {
    title: 'Sunday Stillness & Alignment',
    routine: 'Morning: Prepare warm tea and reflect on your week. Evening: Review your schedule and protect rest windows.',
    prompt: 'How is your emotional battery feeling right now? What can you do today that serves your peace rather than your productivity?'
  },
  '10-05': {
    title: 'Momentum Ignition: Focus Arc',
    routine: 'Morning: Tackle the hardest task first (Eat the Frog). Afternoon: 10-minute posture & hydration reset.',
    prompt: 'The week begins with raw potential. What is the single most valuable accomplishment you will celebrate this Friday?'
  },
  '10-06': {
    title: 'Creative Friction: Breaking Blocks',
    routine: 'Morning: Freewrite thoughts for 5 minutes without editing. Afternoon: Brainstorm 5 new ideas for your biggest goal.',
    prompt: 'What project or idea has been waiting in the back of your mind? What tiny 5-minute action can you take on it today?'
  },
  '10-07': {
    title: 'Midweek Checkpoint: Re-centering',
    routine: 'Morning: Check your weekly goals progress. Afternoon: Take an intentional 15-minute screen-free break.',
    prompt: 'Halfway through the week. Are you rushing, or are you moving with intention? Notice what is working well and honor it.'
  },
  '10-08': {
    title: 'Curiosity & Learning',
    routine: 'Morning: Read 5 pages of an inspiring book or article. Afternoon: Ask a thoughtful question in a conversation.',
    prompt: 'What new perspective or piece of wisdom captured your curiosity this week? How does it change how you see things?'
  },
  '10-09': {
    title: 'Friday Sunset: Celebrating Wins',
    routine: 'Morning: Finish open loops and pending notes. Evening: Celebrate at least two victories, however modest.',
    prompt: 'Look back at your Monday self. What challenge did you handle better than you expected? Acknowledge your resilience.'
  },
  '10-10': {
    title: 'Saturday Sanctuary: Pure Play',
    routine: 'Morning: Wake up naturally with no alarm. Afternoon: Engage in a creative or playful hobby purely for fun.',
    prompt: 'What activity makes you completely forget to check your phone? Dive into that space today.'
  },
  '10-11': {
    title: 'Sunday Heart Check',
    routine: 'Morning: Light ambient music and mindful breakfast. Evening: Clean your personal workspace for the coming week.',
    prompt: 'Sunday reflection: How are your relationships, love life, and family connections? What does someone close to you need right now?'
  },
  '10-12': {
    title: 'Clarity of Purpose',
    routine: 'Morning: Write your "Top 1 Priority" on an index card. Afternoon: Protect 90 minutes of distraction-free execution.',
    prompt: 'If you could only accomplish one meaningful thing by sunset today, what would give you true peace of mind?'
  },
  '10-13': {
    title: 'Flow & Focus Calibration',
    routine: 'Morning: 10 minutes of physical stretching. Afternoon: Eliminate one low-value distraction from your routine.',
    prompt: 'Momentum builds by removing friction. What tiny distraction has been stealing your focus, and how will you bypass it?'
  },
  '10-14': {
    title: 'Gratitude in the Small Things',
    routine: 'Morning: List 3 micro-blessings (a warm drink, a kind word, a roof). Afternoon: Share a compliment with someone.',
    prompt: 'What simple comfort in your everyday life are you grateful for that you often take for granted?'
  },
  '10-15': {
    title: 'Mid-Month Strategic Review',
    routine: 'Morning: Compare your October intentions with where you stand. Afternoon: Course-correct without self-judgment.',
    prompt: 'October is halfway through. What have you learned about your energy, routines, and habits so far this month?'
  },
  '10-16': {
    title: 'Unbreakable Momentum',
    routine: 'Morning: Write down what you are proud of. Afternoon: Clear out pending correspondence and notes.',
    prompt: 'Friday evening check-in: What went right this week? Write down the highlight that brought a genuine smile to your face.'
  },
  '10-17': {
    title: 'Digital Detox & Freedom',
    routine: 'Morning: Keep your phone across the room for 2 hours. Afternoon: Step into nature or explore a new corner of your town.',
    prompt: 'When you step away from the digital stream, what thoughts emerge in the quiet? Record them here.'
  },
  '10-18': {
    title: 'Sunday Healing & Recharge',
    routine: 'Morning: Gentle morning stretch and hydrating tea. Evening: Plan tomorrow’s clothes and morning routine.',
    prompt: 'How is your relationship with yourself? Are you speaking to yourself with kindness and patience lately?'
  },
  '10-19': {
    title: 'The Third Arc: Relentless Focus',
    routine: 'Morning: Identify your week’s cornerstone objective. Afternoon: Push past resistance and start the first step.',
    prompt: 'What is the one conversation or task you have been putting off? What courage does it take to face it today?'
  },
  '10-20': {
    title: 'Cultivating Mental Sharpness',
    routine: 'Morning: Drink 500ml water upon waking. Afternoon: Take a 10-minute brisk walk to oxygenate your mind.',
    prompt: 'A sharp mind requires a nourished body. What healthy choice can you make today that your future self will thank you for?'
  },
  '10-21': {
    title: 'Harmony & Emotional Flow',
    routine: 'Morning: 3 deep belly breaths before speaking. Afternoon: Practice active listening without planning your reply.',
    prompt: 'Notice the quality of your interactions today. Were you present with others? What did someone reveal to you?'
  },
  '10-22': {
    title: 'Deep Synthesis & Creative Vision',
    routine: 'Morning: Review your recent reflections in SAIF-VERSE. Afternoon: Turn one core idea into an actionable blueprint.',
    prompt: 'Today is a pivotal crossroad. What vision for your future excites you so deeply that you can feel it in your bones?'
  },
  '10-23': {
    title: 'Friday Release & Celebration',
    routine: 'Morning: Wrap up all open tabs and obligations. Evening: Celebrate with your favorite meal or creative session.',
    prompt: 'What was your favorite moment of connection, laughter, or achievement this past week? Capture the memory in detail.'
  },
  '10-24': {
    title: 'Saturday Wanderlust & Joy',
    routine: 'Morning: Slow coffee or tea, music without lyrics. Afternoon: Create, draw, write, or explore without rules.',
    prompt: 'Give your inner creator total permission today. What feels fun, light, and completely free right now?'
  },
  '10-25': {
    title: 'Sunday Reflections & Soul Care',
    routine: 'Morning: Spend 15 minutes journaling your dreams and thoughts. Evening: Unplug screens 1 hour before sleep.',
    prompt: 'Sunday check-in: How do you feel about the relationships in your life? What bond needs a little warmth or reassurance?'
  },
  '10-26': {
    title: 'Final October Sprint: High Standards',
    routine: 'Morning: Define the 3 things that will make this final October week memorable. Afternoon: Execute with precision.',
    prompt: 'The final week of October begins. How do you want to finish this month so that you look back with pride?'
  },
  '10-27': {
    title: 'Steadfast Resilience',
    routine: 'Morning: Remind yourself of a past obstacle you conquered. Afternoon: Stand firm in the face of temporary delays.',
    prompt: 'When things feel difficult or slow, what truth keeps your inner fire burning? Write your anchor phrase.'
  },
  '10-28': {
    title: 'Midweek Equilibrium',
    routine: 'Morning: Mindful posture check. Afternoon: Release physical tension from your shoulders and jaw.',
    prompt: 'What weight have you been carrying that does not belong to you? Give yourself permission to set it down.'
  },
  '10-29': {
    title: 'Creative Sparks & Autumn Twilight',
    routine: 'Morning: Capture morning thoughts in a quick note. Evening: Observe the sunset colors and reflect on change.',
    prompt: 'Change is the only constant. What beautiful shift or growth has taken place in your character this season?'
  },
  '10-30': {
    title: 'Gratitude for the Journey',
    routine: 'Morning: Write a note thanking someone who supported you. Afternoon: Celebrate completing October’s core projects.',
    prompt: 'Look across the whole landscape of this month. What are you most proud of enduring, creating, or learning?'
  },
  '10-31': {
    title: 'October Finale: Mystery & Transition',
    routine: 'Morning: Complete your October monthly review note. Evening: Welcome the shifting seasons and set November visions.',
    prompt: 'October closes its gates tonight. What magical memory or key lesson will you carry into November?'
  },

  // --- NOVEMBER (30 DAYS) ---
  '11-01': {
    title: 'November Dawn: The Gratitude Season',
    routine: 'Morning: Write 3 foundational visions for November. Afternoon: Organize your digital notes. Evening: Grounding breathwork.',
    prompt: 'November opens today. What feeling do you want to define this entire month: peace, courage, focus, or abundance?'
  },
  '11-02': {
    title: 'First Monday of November: New Horizon',
    routine: 'Morning: Prioritize high-impact deliverables. Afternoon: 15-minute sunlight walk. Evening: Read rather than scroll.',
    prompt: 'A clean slate for a fresh month. What is one habit you will commit to practicing every single day of November?'
  },
  '11-03': {
    title: 'Building Momentum & Discipline',
    routine: 'Morning: Execute the first 30 minutes of work without music or distractions. Afternoon: Hydrate and re-focus.',
    prompt: 'Discipline is simply remembering what you truly want. What goal are you staying loyal to today?'
  },
  '11-04': {
    title: 'Midweek Horizon: Mindful Energy',
    routine: 'Morning: Check your mental clarity score (1-10). Afternoon: Take a 5-minute pause to reset your breath.',
    prompt: 'Are you living in reaction mode or creation mode today? How can you shift back into intentional creation?'
  },
  '11-05': {
    title: 'Spark of Innovation',
    routine: 'Morning: Brainstorm unconventional solutions to a lingering question. Afternoon: Connect with a peer or teammate.',
    prompt: 'What question has been bouncing around in your mind? Write it down and allow your intuition to answer freely.'
  },
  '11-06': {
    title: 'Golden Friday: First Week Victory',
    routine: 'Morning: Finish pending commitments. Evening: Log off early and celebrate the first week of November.',
    prompt: 'What was your greatest breakthrough or quiet victory this week? Write it down so you never forget it.'
  },
  '11-07': {
    title: 'November Saturday: Warmth & Sanctuary',
    routine: 'Morning: Slow waking, warm breakfast, gentle daylight. Afternoon: Quality time with loved ones or creative projects.',
    prompt: 'What makes you feel deeply at home? Lean into that warmth today and let your mind completely unwind.'
  },
  '11-08': {
    title: 'Sunday Bonds & Heart Connection',
    routine: 'Morning: Mindful tea and reflective journaling. Evening: Plan meals and primary tasks for the coming week.',
    prompt: 'Sunday check-in: How is your relationship with those you hold dearest? How can you make them feel seen and cherished today?'
  },
  '11-09': {
    title: 'Unwavering Clarity',
    routine: 'Morning: Identify the essential vs the non-essential. Afternoon: Cut out one unnecessary commitment.',
    prompt: 'Clarity is power. When you strip away all the noise, what truly matters to you in this current chapter of your life?'
  },
  '11-10': {
    title: 'Flow & Focus Expansion',
    routine: 'Morning: 20-minute uninterrupted writing or deep work session. Afternoon: Physical movement and stretching.',
    prompt: 'What does your peak state of focus look like? How can you design your environment today to support that state?'
  },
  '11-11': {
    title: '11:11 Alignment & Intentions',
    routine: 'Morning: Pause at 11:11 to speak your deepest affirmation. Afternoon: Take one aligned action toward your dream.',
    prompt: 'Make a wish and back it with action. What is your grandest aspiration for the coming year, and what is the first step?'
  },
  '11-12': {
    title: 'Courage Over Comfort',
    routine: 'Morning: Lean into the task you feel slight resistance toward. Afternoon: Reward yourself for taking brave action.',
    prompt: 'Where in your life are you playing smaller than you are capable of? What would the boldest version of you do today?'
  },
  '11-13': {
    title: 'Friday Gratitude Wave',
    routine: 'Morning: Write 5 specific things you are deeply thankful for. Evening: Share your appreciation with someone directly.',
    prompt: 'Gratitude turns what we have into enough. What unexpected blessing has illuminated your path this week?'
  },
  '11-14': {
    title: 'Saturday Rest & Free Wonder',
    routine: 'Morning: No screen for the first hour of waking. Afternoon: Explore a creative curiosity or rest deeply.',
    prompt: 'What does your soul crave when there are no deadlines or expectations? Give yourself that gift today.'
  },
  '11-15': {
    title: 'Mid-November Horizon Check',
    routine: 'Morning: Review your November progress note. Afternoon: Align your compass for the second half of the month.',
    prompt: 'November is halfway through. What have you learned about yourself this month? What needs gentle adjustment?'
  },
  '11-16': {
    title: 'The Third Wave: Relentless Dedication',
    routine: 'Morning: Establish your top priorities for the week. Afternoon: Protect your focus time fiercely.',
    prompt: 'What is one promise you made to yourself that you are determined to keep this week? Write it as your vow.'
  },
  '11-17': {
    title: 'Presence in Every Moment',
    routine: 'Morning: Mindful shower or wash, feeling the temperature. Afternoon: Eat one meal in complete silence and savor it.',
    prompt: 'When you are truly here in the present moment, what worries naturally dissolve? Notice the peace available right now.'
  },
  '11-18': {
    title: 'Midweek Resilience & Strength',
    routine: 'Morning: Posture check and 10 deep restorative breaths. Afternoon: Take a walk in fresh air to clear your head.',
    prompt: 'You have navigated every difficult day so far with 100% success. What strength inside you are you leaning on today?'
  },
  '11-19': {
    title: 'Creative Mastery',
    routine: 'Morning: Draft an idea, write a verse, or outline a plan. Afternoon: Refine it with patience and care.',
    prompt: 'Creativity is your divine signature. What are you bringing into the world through your unique voice and craft?'
  },
  '11-20': {
    title: 'Friday Twilight & Contentment',
    routine: 'Morning: Wrap up weekly milestones. Evening: Dim the lights, play soothing music, and celebrate your persistence.',
    prompt: 'Friday reflection: What moment from this week made you feel truly alive and grateful? Write the scene in vivid detail.'
  },
  '11-21': {
    title: 'Saturday Solitude & Peace',
    routine: 'Morning: Sleep in and wake softly. Afternoon: Enjoy a warm drink and journal freely in SAIF-VERSE.',
    prompt: 'Solitude is where we meet ourselves. What truth has your inner voice been whispering that you are now ready to hear?'
  },
  '11-22': {
    title: 'Sunday Heart & Connection',
    routine: 'Morning: Share a warm meal or phone call with someone you care about. Evening: Reset your sanctuary.',
    prompt: 'Sunday love check: Who has been on your mind lately? What words of love, support, or encouragement can you offer them?'
  },
  '11-23': {
    title: 'Thanksgiving Week: Abundance Mindset',
    routine: 'Morning: Start your day by naming 3 people who changed your life. Afternoon: Express silent or spoken thanks.',
    prompt: 'Abundance is not what you possess, but how deeply you appreciate what is already here. What fills your heart today?'
  },
  '11-24': {
    title: 'Kindness & Giving Back',
    routine: 'Morning: Perform one unexpected act of kindness. Afternoon: Notice how giving energy revitalizes your spirit.',
    prompt: 'A candle loses nothing by lighting another candle. How did you bring light into someone’s world today?'
  },
  '11-25': {
    title: 'Eve of Gratitude: Reflection',
    routine: 'Morning: Finish pending projects. Evening: Prepare your space for peaceful togetherness and rest.',
    prompt: 'If you had to name the single greatest blessing of this year so far, what would it be and why?'
  },
  '11-26': {
    title: 'Thanksgiving Day: Celebration of Life',
    routine: 'Morning: Give thanks for your breath, your heartbeat, and your journey. Evening: Savor time with family and friends.',
    prompt: 'Today is dedicated to gratitude. Pour out your appreciation for everyone and everything that has brought you to this moment.'
  },
  '11-27': {
    title: 'Black Friday: True Wealth',
    routine: 'Morning: Step away from consumer frenzy and spend 15 minutes in nature. Afternoon: Value experiences over objects.',
    prompt: 'True wealth is peace of mind, healthy relationships, and purpose. What non-material treasures are you richest in today?'
  },
  '11-28': {
    title: 'November Weekend: Cozy Reflections',
    routine: 'Morning: Slow cozy morning with your favorite book or note. Afternoon: Rest and restore your physical body.',
    prompt: 'As the weather cools and November draws toward its close, what warm memories are keeping your spirit cozy?'
  },
  '11-29': {
    title: 'Sunday Soul Alignment',
    routine: 'Morning: Review your entire November in SAIF-VERSE. Evening: Begin outlining your visions for the grand finale of the year.',
    prompt: 'Sunday check-in: How have you evolved over the past 30 days? In what ways are you stronger and wiser than when November began?'
  },
  '11-30': {
    title: 'November Finale: The Transition to Winter',
    routine: 'Morning: Write your November completion letter to yourself. Evening: Celebrate closing November with grace and power.',
    prompt: 'November bows out tonight. What are you leaving behind in November, and what fire are you carrying into the final month of the year?'
  }
};

export class ThemeEngine {
  constructor(particleEngine) {
    this.particleEngine = particleEngine;
    this.selectedDayIndex = null;
    this.listeners = [];
  }

  getCurrentRealDayIndex() {
    return new Date().getDay();
  }

  getDateKey(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  }

  getTodayCalendarRoutine() {
    const key = this.getDateKey();
    if (CALENDAR_ROUTINES[key]) {
      return CALENDAR_ROUTINES[key];
    }
    // Fallback if outside October/November: dynamic daily prompt based on day of week
    const dayConfig = this.getActiveDayConfig();
    return {
      title: `${dayConfig.name} Routine & Alignment`,
      routine: 'Morning: 5 minutes of mindful reflection. Afternoon: Protected execution block. Evening: Gratitude note in SAIF-VERSE.',
      prompt: `How are you feeling this ${dayConfig.name}? Take a deep breath and record what is most meaningful to your heart today.`
    };
  }

  getActiveDayConfig() {
    const dayIdx = this.selectedDayIndex !== null 
      ? this.selectedDayIndex 
      : this.getCurrentRealDayIndex();
    return DAYS_CONFIG[dayIdx];
  }

  setManualDay(dayIndex) {
    this.selectedDayIndex = dayIndex;
    this.applyTheme();
    this.notify();
  }

  setAutoDay() {
    this.selectedDayIndex = null;
    this.applyTheme();
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getActiveDayConfig());
  }

  notify() {
    const config = this.getActiveDayConfig();
    this.listeners.forEach(cb => cb(config));
  }

  applyTheme() {
    const config = this.getActiveDayConfig();
    document.documentElement.style.setProperty('--accent-color', config.accentHex);
    document.documentElement.style.setProperty('--accent-gradient', config.accentGradient);
    document.documentElement.style.setProperty('--glass-border', config.glassBorder);

    const orb1 = document.getElementById('ambient-orb-1');
    const orb2 = document.getElementById('ambient-orb-2');
    if (orb1 && orb2) {
      orb1.style.background = config.orbColors[0];
      orb2.style.background = config.orbColors[1];
    }

    if (this.particleEngine) {
      this.particleEngine.setMode(config.particleMode);
    }
  }
}
