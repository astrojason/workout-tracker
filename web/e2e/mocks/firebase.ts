// e2e/mocks/firebase.ts
// Replaces lib/firebase.ts for e2e tests.
// All Firestore operations are stubbed — no network calls are made.

export const mockSessions: Record<string, unknown[]> = {};
export const mockPRs: Record<string, unknown> = {};
export const mockSettings = {
    defaultRestSeconds: 120,
    soundEnabled: false,
    currentWeeks: {},
};

// Auth — always returns a signed-in user
export const mockUser = {
    uid: "test-user-123",
    email: "test@example.com",
    displayName: "Test User",
};

// Firestore stubs
export const saveSession = async (
    _userId: string,
    session: unknown
): Promise<void> => {
    const s = session as { dayOfWeek: string };
    if (!mockSessions[s.dayOfWeek]) mockSessions[s.dayOfWeek] = [];
    mockSessions[s.dayOfWeek].push(session);
};

export const getSessions = async (_userId: string): Promise<unknown[]> => {
    return Object.values(mockSessions).flat();
};

export const getSettings = async (_userId: string) => mockSettings;

export const saveSettings = async (
    _userId: string,
    settings: unknown
): Promise<void> => {
    Object.assign(mockSettings, settings);
};

export const savePR = async (
    _userId: string,
    pr: { exerciseName: string; recordType: string }
): Promise<void> => {
    mockPRs[`${pr.exerciseName}_${pr.recordType}`] = pr;
};

export const getPRs = async (_userId: string) => Object.values(mockPRs);

export const getTodayChecklistSession = async () => null;

export const upsertChecklistSession = async () => { };

export const getExerciseHistory = async () => [];

export const getPrograms = async () => [];

export const saveProgram = async () => { };

export const deleteProgram = async () => { };

export const saveWorkout = async () => { };

export const getWorkouts = async () => [];

// Reset between tests
export const resetMocks = () => {
    Object.keys(mockSessions).forEach((k) => delete mockSessions[k]);
    Object.keys(mockPRs).forEach((k) => delete mockPRs[k]);
    mockSettings.defaultRestSeconds = 120;
    mockSettings.soundEnabled = false;
    mockSettings.currentWeeks = {};
};