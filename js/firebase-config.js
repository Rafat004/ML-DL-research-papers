/* ============================================================
   Deep Learning Knowledge Hub — Firebase Configuration & Service
   Handles Firebase App, Firestore, Storage, and Google Auth.
   ============================================================ */

const FirebaseConfig = (() => {
    const STORAGE_KEY_CONFIG = 'dl_hub_firebase_config_v1';

    // Default configuration for ml-dl-research-paper
    const DEFAULT_CONFIG = {
        apiKey: "AIzaSyACHpOcWvUFe7p2-UoaUBvZQzdcpVP1BrM",
        authDomain: "ml-dl-research-paper.firebaseapp.com",
        projectId: "ml-dl-research-paper",
        storageBucket: "ml-dl-research-paper.firebasestorage.app",
        messagingSenderId: "1013231792429",
        appId: "1:1013231792429:web:1ef4d3d1b0ba8a048ee3a4",
        measurementId: "G-EB8X9Y0W2N"
    };

    function getConfig() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.projectId && parsed.apiKey) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Error reading Firebase config from localStorage:', e);
        }
        return DEFAULT_CONFIG;
    }

    function saveConfig(cfg) {
        if (!cfg || !cfg.projectId) {
            throw new Error('Project ID is required');
        }
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
        return true;
    }

    function clearConfig() {
        localStorage.removeItem(STORAGE_KEY_CONFIG);
    }

    function isConfigured() {
        const cfg = getConfig();
        return Boolean(cfg.apiKey && cfg.projectId && cfg.projectId !== "YOUR_PROJECT_ID");
    }

    let app = null;
    let db = null;
    let storage = null;
    let auth = null;
    let cachedUser = null;

    function init() {
        if (!isConfigured()) {
            return false;
        }

        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK scripts not loaded yet');
            return false;
        }

        try {
            const cfg = getConfig();
            if (!firebase.apps || firebase.apps.length === 0) {
                app = firebase.initializeApp(cfg);
            } else {
                app = firebase.app();
            }

            db = firebase.firestore();
            storage = firebase.storage();
            auth = firebase.auth();
            auth.onAuthStateChanged(u => {
                cachedUser = u;
            });

            // Enable offline persistence for Firestore if available
            try {
                db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
                    if (err.code === 'failed-precondition') {
                        // Multiple tabs open, persistence can only be enabled in one tab at a time.
                    } else if (err.code === 'unimplemented') {
                        // Browser doesn't support offline persistence
                    }
                });
            } catch (e) {}

            return true;
        } catch (err) {
            console.error('Firebase initialization error:', err);
            return false;
        }
    }

    // Try initializing immediately
    init();

    return {
        getConfig,
        saveConfig,
        clearConfig,
        isConfigured,
        init,
        getDb: () => db || (init() ? db : null),
        getStorage: () => storage || (init() ? storage : null),
        getAuth: () => auth || (init() ? auth : null),

        // Helper: Sign in with Google (Owner authentication)
        signInWithGoogle: async () => {
            const a = auth || (init() ? auth : null);
            if (!a) throw new Error('Firebase Auth is not initialized');
            const provider = new firebase.auth.GoogleAuthProvider();
            return await a.signInWithPopup(provider);
        },

        // Helper: Sign out
        signOut: async () => {
            const a = auth || (init() ? auth : null);
            if (!a) return;
            return await a.signOut();
        },

        // Helper: Listen to auth state
        onAuthStateChanged: (callback) => {
            const a = auth || (init() ? auth : null);
            if (!a) {
                callback(null);
                return () => {};
            }
            return a.onAuthStateChanged(callback);
        },

        getCurrentUser: () => {
            return cachedUser || (auth ? auth.currentUser : null);
        }
    };
})();
