// Initialize Firebase
let firebaseConfig = null;

// Function to fetch Firebase configuration from server
async function initializeFirebaseConfig() {
    try {
        const response = await fetch('/api/firebase-config');
        if (!response.ok) {
            throw new Error('Failed to fetch Firebase configuration');
        }
        firebaseConfig = await response.json();
        console.log('[main.js] Firebase config fetched from server');
        
        // Initialize Firebase with the fetched config
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('[main.js] Firebase initialized successfully');
        }
        return true;
    } catch (error) {
        console.error('[main.js] Firebase config fetch error:', error);
        return false;
    }
}

// Initialize Firebase with Windows-compatible settings
(async function() {
    const configLoaded = await initializeFirebaseConfig();
    if (!configLoaded) {
        console.error('[main.js] Failed to load Firebase configuration');
        return;
    }

    // Set persistence to SESSION (persists only in the current tab)
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(() => {
            console.log('[main.js] Auth persistence set to SESSION');
        })
        .catch((error) => {
            console.error("[main.js] Auth persistence error:", error);
        });

    // Configure Firestore with Windows-compatible settings
    const db = firebase.firestore();
    db.settings({
        merge: true,
        experimentalAutoDetectLongPolling: true,
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        ignoreUndefinedProperties: true
    });

    // Continue with the rest of the Firebase initialization...
    initializeApp();
})()

function initializeApp() {

// Loading overlay management
let activeNetworkRequests = 0; // Counter for active network requests
let isTransmitting = false; // Flag to track transmission state

const showLoadingOverlay = () => {
    if (activeNetworkRequests > 0 && isTransmitting) {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(3px);
        `;
        
        const loaderContainer = document.createElement('div');
        loaderContainer.style.cssText = `
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
        `;
        
        const loader = document.createElement('img');
        loader.src = '/static/images/loader.gif';
        loader.alt = 'Loading...';
        loader.style.cssText = `
            width: 50px;
            height: 50px;
            object-fit: contain;
        `;
        
        const loadingText = document.createElement('div');
        loadingText.textContent = 'Loading...';
        loadingText.style.cssText = `
            margin-top: 10px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #666;
        `;
        
        loaderContainer.appendChild(loader);
        loaderContainer.appendChild(loadingText);
        overlay.appendChild(loaderContainer);
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    }
};

const hideLoadingOverlay = () => {
    if (activeNetworkRequests <= 0 || !isTransmitting) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }
    }
};

// Export functions to window
window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay;

// Function to check if we're on a public page
const isPublicPage = () => {
    const path = window.location.pathname;
    return path.includes('/login') || 
           path.includes('/register') || 
           path.includes('/about') || 
           path === '/' ||
           path.includes('/events') ||
           path.includes('/public-events');
};

// Initialize Firebase Auth
const auth = firebase.auth();

// Global state variables
let initialLoad = true;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 5000;
let isAuthenticating = false;
let isValidatingSession = false;
let isRegistering = false;
let isLoggingOut = false;
let authInitialized = false;
let sessionCheckInProgress = false;
let lastSessionCheck = 0;
const SESSION_CHECK_INTERVAL = 30000; // 30 seconds

// Token refresh interval (45 minutes)
const TOKEN_REFRESH_INTERVAL = 45 * 60 * 1000;

// Add a login state flag
let isLoggingIn = false;

// Function to update navigation UI based on auth state
const updateNavigationUI = (isLoggedIn, username = '') => {
    const usernameDisplay = document.querySelector('.username-display');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginLink = document.getElementById('loginLink');
    
    console.log('[main.js] Updating navigation UI - isLoggedIn:', isLoggedIn, 'username:', username);
    
    if (isLoggedIn && username) {
        // User is logged in - show username and logout button
        if (usernameDisplay) {
            usernameDisplay.textContent = username;
            usernameDisplay.style.display = 'inline-block';
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'inline-block';
        }
        if (loginLink) {
            loginLink.style.display = 'none';
        }
    } else {
        // User is not logged in - hide username and logout button
        if (usernameDisplay) {
            usernameDisplay.style.display = 'none';
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
        if (loginLink) {
            loginLink.style.display = 'inline-block';
        }
    }
};

// Add a comprehensive state cleanup function
const clearAuthState = () => {
    console.log('[main.js] Clearing authentication state... (Start)');
    console.log('[main.js] Clearing localStorage...');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    console.log('[main.js] localStorage cleared.');
    console.log('[main.js] Clearing sessionStorage...');
        sessionStorage.clear();
    console.log('[main.js] sessionStorage cleared.');
    
    // Update navigation UI to logged out state
    updateNavigationUI(false);
    
    console.log('[main.js] Attempting Firebase signOut...');
    return firebase.auth().signOut()
        .then(() => {
            console.log('[main.js] Firebase signOut successful.');
            console.log('[main.js] Clearing authentication state... (End)');
        })
        .catch((error) => {
            console.warn('[main.js] Firebase signOut during cleanup failed:', error);
            console.log('[main.js] Clearing authentication state... (End)');
        });
};

// Login form handler removed - handled in login.html template to avoid duplicate handlers

// Modify the onAuthStateChanged listener
auth.onAuthStateChanged(async (user) => {
    console.log('[main.js] Auth state changed. User:', user ? user.uid : 'null');
    if (user) {
        console.log('[main.js] User is signed in:', user.uid, 'Email:', user.email);
        if (window.isUserRegistering()) {
            console.log('[main.js] User is registering, skipping immediate session validation after backend success.');
            window.setIsRegistering(false);
        } else {
            try {
                const token = await user.getIdToken(true);
                localStorage.setItem('authToken', token);
                console.log('[main.js] Token refreshed and stored in onAuthStateChanged');
                
                const result = await validateSessionWithRetry();
                if (!result) {
                    console.log('[main.js] Session validation failed after auth state change');
                    // Don't immediately sign out, might be a temporary server issue
                    console.log('[main.js] Skipping automatic signout, will let user try to interact');
                } else {
                    console.log('[main.js] Session validation successful after auth state change');
                }
            } catch (error) {
                console.error('[main.js] Error during onAuthStateChanged processing (non-registration):', error);
                // Don't automatically sign out on validation errors
                console.log('[main.js] Validation error in onAuthStateChanged, but keeping user signed in');
            }
        }
    } else {
        console.log('[main.js] User is signed out');
        clearAuthState();
        if (!isPublicPage()) {
            console.log('[main.js] User signed out from a non-public page, redirecting to login.');
            window.location.href = '/login';
        }
        if (window.isUserRegistering()) {
            window.setIsRegistering(false);
            console.log('[main.js] Registration state reset due to sign out.');
        }
    }
});

// Function to handle Firebase auth errors
const handleFirebaseAuthError = (error) => {
    console.error('[main.js] Firebase auth error:', error);
    let errorMessage = 'An error occurred during authentication';
    let isInformative = false;
    switch (error.code) {
        case 'auth/invalid-email':
            errorMessage = 'Invalid email address';
            break;
        case 'auth/user-disabled':
            errorMessage = 'This account has been disabled';
            break;
        case 'auth/user-not-found':
            errorMessage = 'No account found with this email';
            break;
        case 'auth/wrong-password':
        case 'auth/invalid-login-credentials':
            errorMessage = 'Your Account or password mismatched';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many failed attempts. Please try again later';
            break;
        case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection';
            break;
        case 'auth/operation-not-allowed':
            errorMessage = 'This operation is not allowed';
            break;
        case 'auth/email-already-in-use':
            errorMessage = 'An account with this email already exists. Please try logging in.';
            isInformative = true;
            break;
        default:
            if (error.message && error.message.includes('INVALID_LOGIN_CREDENTIALS')) {
                errorMessage = 'Your Account or password mismatched';
            } else {
                errorMessage = error.message || 'Authentication failed';
            }
            break;
    }
    hideLoadingOverlay();
    setTimeout(() => {
        if (isInformative) {
            Swal.fire({
                icon: 'info',
                title: 'Account Exists',
                text: errorMessage,
                showCancelButton: true,
                confirmButtonText: 'Go to Login',
                cancelButtonText: 'Stay Here',
                background: 'rgba(255, 255, 255, 0.9)',
                backdrop: 'rgba(0, 0, 0, 0.4)',
                customClass: {
                    popup: 'swal2-popup-glass',
                    title: 'swal2-title-glass',
                    content: 'swal2-content-glass',
                    confirmButton: 'swal2-confirm-button-glass',
                    cancelButton: 'swal2-cancel-button-glass'
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = '/login';
                }
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Authentication Error',
                text: errorMessage,
                background: 'rgba(255, 255, 255, 0.9)',
                backdrop: 'rgba(0, 0, 0, 0.4)',
                customClass: {
                    popup: 'swal2-popup-glass',
                    title: 'swal2-title-glass',
                    content: 'swal2-content-glass',
                    confirmButton: 'swal2-confirm-button-glass'
                }
            });
        }
    }, 300);
};

// Function to refresh token with improved error handling
const refreshAuthToken = async () => {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log('[main.js] No user to refresh token for');
            return;
        }
        const token = await user.getIdToken(true);
        localStorage.setItem('authToken', token);
        const response = await fetch('/api/refresh-token', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.token) {
                await auth.signInWithCustomToken(data.token);
                console.log('[main.js] Token refreshed successfully');
            }
        } else {
            console.error('[main.js] Token refresh failed:', await response.text());
            try {
                const credential = user.credential;
                if (credential) {
                    await user.reauthenticateWithCredential(credential);
                    console.log('[main.js] User reauthenticated successfully');
                }
            } catch (reauthError) {
                console.error('Reauthentication failed:', reauthError);
                await auth.signOut();
            }
        }
    } catch (error) {
        console.error('[main.js] Token refresh error:', error);
        await auth.signOut();
    }
};

// Function to validate session with retry
const validateSessionWithRetry = async (maxRetries = 3) => {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const result = await validateSession();
            if (result) return true;
            retries++;
            if (retries < maxRetries) {
                console.log(`[main.js] Session validation retry ${retries}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
            }
        } catch (error) {
            console.error(`[main.js] Session validation attempt ${retries + 1} failed:`, error);
            retries++;
            if (retries < maxRetries) {
                console.log(`[main.js] Session validation retry ${retries}/${maxRetries} after error`);
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
            }
        }
    }
    return false;
};

// Function to sync session state
const syncSessionState = async () => {
    if (Date.now() - lastSessionCheck < SESSION_CHECK_INTERVAL) {
        console.log('[main.js] Skipping session sync - too soon');
        return true;
    }
    try {
        sessionCheckInProgress = true;
        const serverData = await checkServerSession();
        if (serverData && serverData.valid) {
            console.log('[main.js] Server session valid, syncing state');
            // Update navigation UI with user data if available
            if (serverData.user && serverData.user.username) {
                updateNavigationUI(true, serverData.user.username);
            }
            lastSessionCheck = Date.now();
            return true;
        } else {
            console.log('[main.js] Server session invalid or not found.');
            lastSessionCheck = Date.now();
            if (!isPublicPage()) {
                console.log('[main.js] Invalid server session on non-public page, redirecting to login.');
                window.location.href = '/login';
        }
        return false;
        }
    } catch (error) {
        console.error('[main.js] Error syncing session state:', error);
        lastSessionCheck = Date.now();
        if (!isPublicPage()) {
            console.log('[main.js] Error during session sync on non-public page, redirecting to login.');
            window.location.href = '/login';
        }
        return false;
    } finally {
        sessionCheckInProgress = false;
    }
};

// Function to check server session
const checkServerSession = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.log('[main.js] checkServerSession: No auth token found.');
        return null;
    }
    try {
        const response = await fetch('/api/validate-session', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        if (response.ok) {
            const data = await response.json();
            console.log('[main.js] checkServerSession API success:', data);
            return data;
                } else {
            const errorData = await response.json().catch(() => { return { error: 'Unknown error format' }; });
            console.log('[main.js] checkServerSession API error:', response.status, errorData);
            if (response.status === 401) {
                console.log('[main.js] checkServerSession API returned 401 (Invalid token), treating as invalid session.');
                localStorage.removeItem('authToken');
                return null;
            } else if (response.status === 404 && errorData.error === 'User profile not found') {
                console.log('[main.js] checkServerSession API returned 404 (User profile not found), treating as invalid session.');
                return null;
            }
            throw new Error(`Session validation API failed: ${response.status} - ${errorData.error}`);
        }
                } catch (error) {
        console.error('[main.js] checkServerSession fetch error:', error);
        throw error;
    }
};

// Update the validateSession function
const validateSession = async () => {
    if (isRegistering || isLoggingOut) {
        console.log('[main.js] Registration or logout in progress, skipping session validation');
        return true;
    }
    if (isPublicPage() && !firebase.auth().currentUser) {
        console.log('[main.js] On public page and no Firebase user, skipping server session validation.');
        return true;
    }
    const user = firebase.auth().currentUser;
    const token = localStorage.getItem('authToken');
    
    console.log('[main.js] validateSession called with user:', user ? user.uid : 'null', 'token:', token ? token.substring(0, 10) + '...' : 'null');
    
    if (user && token) {
        try {
            const serverData = await checkServerSession();
            if (serverData && serverData.valid) {
                console.log('[main.js] validateSession: Server session is valid.');
                // Update navigation UI with user data if available
                if (serverData.user && serverData.user.username) {
                    updateNavigationUI(true, serverData.user.username);
                }
                return true;
            } else {
                console.log('[main.js] validateSession: Server session is invalid.');
                // Don't remove token immediately, might be a temporary server issue
                console.log('[main.js] Keeping token for potential retry');
                return false;
            }
        } catch (error) {
            console.error('[main.js] validateSession: Error checking server session:', error);
            // Don't remove token on network errors
            if (error.message && error.message.includes('fetch')) {
                console.log('[main.js] Network error during validation, keeping token');
                return false;
            }
            localStorage.removeItem('authToken');
            return false;
        }
    } else if (!user && token) {
        console.log('[main.js] validateSession: Token found but no Firebase user, attempting refresh.');
        try {
            await refreshAuthToken();
            return true;
        } catch (refreshError) {
            console.error('[main.js] validateSession: Token found but refresh failed:', refreshError);
            localStorage.removeItem('authToken');
            return false;
        }
    } else {
        console.log('[main.js] validateSession: No Firebase user or token found.');
        if (token) {
            localStorage.removeItem('authToken');
        }
        return false;
    }
};

// Export registration state management
window.setIsRegistering = (value) => {
    isRegistering = value;
    if (value) {
            localStorage.clear();
            sessionStorage.clear();
        firebase.auth().signOut();
    }
};
window.isUserRegistering = () => isRegistering;

// Add periodic session check
setInterval(() => {
    if (!isPublicPage() && !isRegistering && !isLoggingOut) {
        syncSessionState().catch(console.error);
    }
}, SESSION_CHECK_INTERVAL);

// Initialize navigation UI on page load
const initializeNavigationUI = async () => {
    console.log('[main.js] Starting navigation UI initialization...');
    
    // Wait longer for Firebase auth to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const user = firebase.auth().currentUser;
    console.log('[main.js] Firebase auth state on page load:', user ? user.uid : 'No user');
    
    if (user) {
        console.log('[main.js] User detected on page load, validating session and updating UI');
        try {
            // Get a fresh token first
            const token = await user.getIdToken(true);
            localStorage.setItem('authToken', token);
            console.log('[main.js] Fresh token obtained and stored');
            
            const result = await validateSession();
            if (!result && !isPublicPage()) {
                console.log('[main.js] Session validation failed on page load after token refresh');
                // Don't redirect immediately, give onAuthStateChanged a chance to handle it
                setTimeout(() => {
                    if (!firebase.auth().currentUser) {
                        console.log('[main.js] No user after delay, redirecting to login');
                        window.location.href = '/login';
                    }
                }, 2000);
            } else {
                console.log('[main.js] Session validation successful on page load');
            }
        } catch (error) {
            console.error('[main.js] Error during page load session validation:', error);
            // Don't redirect immediately on error, let onAuthStateChanged handle it
            console.log('[main.js] Skipping immediate redirect due to validation error');
        }
    } else {
        console.log('[main.js] No user detected on page load');
        updateNavigationUI(false);
        // Only redirect if we're on a protected page and we're sure there's no user
        if (!isPublicPage()) {
            console.log('[main.js] On protected page with no user, waiting before redirect...');
            setTimeout(() => {
                if (!firebase.auth().currentUser) {
                    console.log('[main.js] Still no user after delay, redirecting to login');
                    window.location.href = '/login';
                }
            }, 2000);
        }
    }
};

// Call initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNavigationUI);
} else {
    initializeNavigationUI();
}

// Initialize Firebase services with Windows-specific error handling
let storage;
try {
    storage = firebase.storage();
    storage.setMaxUploadRetryTime(15000);
    storage.setMaxOperationRetryTime(15000);
} catch (error) {
    console.error('Firebase storage initialization error:', error);
    storage = firebase.storage();
}

// Add Windows-specific error handling for network issues
window.addEventListener('online', () => {
    console.log('Network connection restored');
    if (db) {
        db.enableNetwork().catch(console.error);
    }
});

window.addEventListener('offline', () => {
    console.log('Network connection lost');
    if (db) {
        db.disableNetwork().catch(console.error);
    }
});

// Token refresh function
const refreshToken = async () => {
    try {
        if (isRegistering || isLoggingOut) {
            console.log('[main.js] Registration or logout in progress, skipping token refresh');
            return;
        }
        if (isPublicPage() && !firebase.auth().currentUser) {
            console.log('[main.js] On public page and not logged in, skipping token refresh');
            return;
        }
        const result = await validateSession();
        if (!result) {
            console.log('[main.js] Session validation failed, clearing session');
            if (!isPublicPage()) {
                window.location.href = '/login';
            }
        }
    } catch (error) {
        console.log('[main.js] Token refresh error:', error);
        if (!isPublicPage()) {
            window.location.href = '/login';
        }
    }
};

// Modify fetch to manage loading overlay
let fetchOriginal = window.fetch;
window.fetch = function() {
    let [resource, config] = arguments;
    if (typeof resource === 'string' && (resource.startsWith('/') || resource.startsWith(window.location.origin))) {
        if (resource !== '/api/validate-dev-code') { // Skip interceptor for dev code validation
            activeNetworkRequests++;
            isTransmitting = true;
            showLoadingOverlay();
            const token = localStorage.getItem('authToken');
        if (token) {
            config = config || {};
            config.headers = config.headers || {};
                if (!config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
                }
            config.headers['X-Requested-With'] = 'XMLHttpRequest';
        }
    }
    }
    return fetchOriginal.apply(window, [resource, config]).then(response => {
        if (typeof resource === 'string' && (resource.startsWith('/') || resource.startsWith(window.location.origin))) {
            if (resource !== '/api/validate-dev-code') {
                activeNetworkRequests--;
                if (activeNetworkRequests <= 0) {
                    isTransmitting = false;
                }
                hideLoadingOverlay();
            }
            if (response.status === 403) {
                console.log('[main.js] Insufficient permissions, redirecting to appropriate page');
                const currentPath = window.location.pathname;
                if (currentPath.includes('/dev/') || currentPath.includes('/admin/')) {
                    window.location.href = '/dashboard';
                }
                }
            }
            return response;
    }).catch(error => {
        if (typeof resource === 'string' && (resource.startsWith('/') || resource.startsWith(window.location.origin))) {
            if (resource !== '/api/validate-dev-code') {
                activeNetworkRequests--;
                isTransmitting = false;
                hideLoadingOverlay();
            }
        }
        throw error;
        });
};

// Handle logout
async function logout() {
    try {
        showLoadingOverlay();
        
        // Immediately update navigation UI to logged out state
        updateNavigationUI(false);
        
        const token = localStorage.getItem('authToken');
        
        // Clear Firebase auth
        await firebase.auth().signOut();
        
        // Clear all local storage
        localStorage.clear();
        
        // Clear all session storage
        sessionStorage.clear();
        
        // Clear cookies by setting them to expire
        document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        
        // Call server logout endpoint
        const response = await fetch('/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            console.warn('Server logout failed, but continuing with client logout');
        }
        
        // Force redirect with cache-busting parameter
        window.location.href = `/?_clear=1&_t=${Date.now()}`;
        
    } catch (error) {
        console.error('Error during logout:', error);
        // Even on error, ensure UI is updated and redirect
        updateNavigationUI(false);
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = `/?_clear=1&_t=${Date.now()}`;
    } finally {
        hideLoadingOverlay();
    }
}

// Add event listener for logout
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.querySelector('button[onclick="logout()"]');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});

// Export functions globally
window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay;
window.setIsRegistering = (value) => {
    isRegistering = value;
};
window.isUserRegistering = () => isRegistering;
window.logout = logout;

// Event management functions
const createEvent = async (eventData) => {
    try {
        const response = await fetch('/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(eventData)
        });
        const data = await response.json();
        if (!response.ok) {
            setTimeout(() => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.error || 'Failed to create event',
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdrop: 'rgba(0, 0, 0, 0.4)',
                    customClass: {
                        popup: 'swal2-popup-glass',
                        title: 'swal2-title-glass',
                        content: 'swal2-content-glass',
                        confirmButton: 'swal2-confirm-button-glass'
                    }
                });
            }, 300);
            throw new Error(data.error || 'Failed to create event');
        }
        setTimeout(() => {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Event created successfully',
                background: 'rgba(255, 255, 255, 0.9)',
                backdrop: 'rgba(0, 0, 0, 0.4)',
                customClass: {
                    popup: 'swal2-popup-glass',
                    title: 'swal2-title-glass',
                    content: 'swal2-content-glass',
                    confirmButton: 'swal2-confirm-button-glass'
                }
            });
        }, 300);
        return data;
    } catch (error) {
        console.error('Error in createEvent:', error);
        throw error;
    }
};

const updateEvent = async (eventId, eventData) => {
    try {
        const response = await fetch(`/events?id=${eventId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(eventData)
        });
        const data = await response.json();
        if (!response.ok) {
            setTimeout(() => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.error || 'Failed to update event',
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdrop: 'rgba(0, 0, 0, 0.4)',
                    customClass: {
                        popup: 'swal2-popup-glass',
                        title: 'swal2-title-glass',
                        content: 'swal2-content-glass',
                        confirmButton: 'swal2-confirm-button-glass'
                    }
                });
            }, 300);
            throw new Error(data.error || 'Failed to update event');
        }
        setTimeout(() => {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Event updated successfully',
                background: 'rgba(255, 255, 0.9)',
                backdrop: 'rgba(0, 0, 0, 0.4)',
                customClass: {
                    popup: 'swal2-popup-glass',
                    title: 'swal2-title-glass',
                    content: 'swal2-content-glass',
                    confirmButton: 'swal2-confirm-button-glass'
                }
            });
        }, 300);
        return data;
    } catch (error) {
        console.error('Error in updateEvent:', error);
        throw error;
    }
};

const deleteEvent = async (eventId) => {
    try {
        const response = await fetch(`/events?id=${eventId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const data = await response.json();
        if (!response.ok) {
            setTimeout(() => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.error || 'Failed to delete event',
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdrop: 'rgba(0, 0, 0, 0.4)',
                    customClass: {
                        popup: 'swal2-popup-glass',
                        title: 'swal2-title-glass',
                        content: 'swal2-content-glass',
                        confirmButton: 'swal2-confirm-button-glass'
                    }
                });
            }, 300);
            throw new Error(data.error || 'Failed to delete event');
        }
        setTimeout(() => {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Event deleted successfully',
                background: 'rgba(255, 255, 255, 0.9)',
                backdrop: 'rgba(0, 255, 255, 0.4)',
                customClass: {
                    popup: 'swal2-popup-glass',
                    title: 'swal2-title-glass',
                    content: 'swal2-content-glass',
                    confirmButton: 'swal2-confirm-button-glass'
                }
            });
        }, 300);
        return data;
    } catch (error) {
        console.error('Error in deleteEvent:', error);
        throw error;
    }
};

const getEventStats = async (eventId) => {
    try {
        const response = await fetch(`/api/events/stats/${eventId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Failed to fetch event statistics:', data.error);
            throw new Error(data.error || 'Failed to fetch event statistics');
        }

        return data;

    } catch (error) {
        console.error('Error in getEventStats:', error);
        throw error;
    }
};

// Export event management functions
window.createEvent = createEvent;
window.updateEvent = updateEvent;
window.deleteEventAPI = deleteEvent; // Renamed to avoid conflict with admin_dashboard.js
window.getEventStats = getEventStats;

// Export the Firebase auth error handler
window.handleFirebaseAuthError = handleFirebaseAuthError;

// Add a global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('[main.js] Unhandled Promise Rejection:', event.reason);
});

window.addEventListener('error', (event) => {
    console.error('[main.js] Uncaught Error:', event.error);
});

} // End of initializeApp() function

// Registration form submission - MOVED TO register.html template to avoid duplicate handlers
// This was causing duplicate registrations when both main.js and register.html had event listeners
// The registration logic is now handled in register.html only
