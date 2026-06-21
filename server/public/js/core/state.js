const STATE = {
  currentTab: 'landing',
  theme: 'light',
  currentUser: null,
  apiKeys: [],
  medicalKeys: [],
  sessions: [],
  triageSession: {
    symptom: '',
    chatLog: [],
    step: 0,
    totalSteps: 5,
    category: 'عام',
    redFlagFired: false,
    result: null,
  },
  breathing: {
    cycle: 0,
    totalCycles: 3,
    scores: [],
    timerHandle: null,
    phase: 'get-ready',
    phaseTime: 0,
    breathResult: null,
    muted: false,
  },
  food: {
    apiKey: '', // loaded from backend config dynamically to prevent git leaks
    selectedMood: '',
    currentData: null, // last fetched food recommendations (full JSON)
    currentMood: '',   // the mood/query that was used
    chatLog: [],       // [{ role: 'user'|'assistant', text: '...' }]
    savedSessionId: null, // id of the saved session in STATE.sessions
    lastModelUsed: '', // 'qwen/qwen3-32b' or 'llama-3.3-70b-versatile'
    preferredModel: '', // '' = auto (Qwen first), 'llama' = Llama first
  },
  medicalTest: {
    apiKey: '',
    apiKeys: [],
    lastResult: null,
    selectedImage: null, // base64 string
    selectedFileIsPdf: false,
    selectedFileName: '',
    extractedText: '',
    lastModelUsed: '',
  },
  bmi: null,
  meds: {
    list: [],
    taken: {},
    activeTab: 'today',
    streak: 0,
    missedWeek: 0,
  },
  modalSessionIndex: -1,
  mentors: [],
  mentees: [],
  selectedMentee: null,
};
