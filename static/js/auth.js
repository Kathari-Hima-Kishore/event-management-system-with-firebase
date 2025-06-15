// Wait for main.js to initialize functions
(function checkFunctions() {
    if (!window.showLoadingOverlay || !window.hideLoadingOverlay || !window.setIsRegistering) {
        setTimeout(checkFunctions, 50);
        return;
    }
    initializeAuth();
})();

function initializeAuth() {    // Login form handler removed - handled in login.html template
    
    // Handle registration form submission
    document.getElementById('role')?.addEventListener('change', (e) => {
        const devCodeContainer = document.getElementById('devCodeContainer');
        if (devCodeContainer) {
            devCodeContainer.style.display = e.target.value === 'dev' ? 'block' : 'none';
        }
    });

    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        const devCode = document.getElementById('devCode')?.value;
        
        // Client-side validations
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address');
            return;
        }

        if (!username.trim()) {
            alert('Please enter a username');
            return;
        }

        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }        try {
            window.showLoadingOverlay();
            setIsRegistering(true); // Set registration state

            console.log('Starting registration process...');
            
            // Validate developer code first if role is 'dev'
            if (role === 'dev') {
                if (!devCode || devCode.trim() === '') {
                    alert('Developer code is required for developer registration.');
                    window.hideLoadingOverlay();
                    setIsRegistering(false);
                    return;
                }

                // Validate developer code with backend before creating Firebase user
                console.log('Validating developer code before Firebase user creation...');
                const validationResponse = await fetch('/api/validate-dev-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({ dev_code: devCode })
                });

                const validationData = await validationResponse.json();
                console.log('Dev code validation response:', validationData);

                if (!validationResponse.ok || !validationData.valid) {
                    alert(validationData.error || 'Invalid developer registration code.');
                    window.hideLoadingOverlay();
                    setIsRegistering(false);
                    return;
                }

                console.log('Developer code validated successfully. Proceeding with Firebase user creation.');
            }
            
            // Create user in Firebase - only after dev code validation passes
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log('Firebase user created successfully');

            // Get the token
            const token = await user.getIdToken();
            console.log('Got token from Firebase');
            localStorage.setItem('authToken', token);

            // Register with backend
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Requested-With': 'XMLHttpRequest'
                },                body: JSON.stringify({
                    username,
                    email,
                    role,
                    dev_code: role === 'dev' ? devCode : undefined
                })
            });

            console.log('Registration response status:', response.status);
            if (!response.ok) {
                let errorMessage = 'Registration failed';
                try {
                    const data = await response.json();
                    errorMessage = data.error || errorMessage;
                } catch (e) {
                    console.error('Failed to parse error response:', e);
                }
                // Delete the Firebase user if backend registration fails
                await user.delete();
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('Registration successful:', data);

            if (data.redirect) {
                console.log('Redirecting to:', data.redirect);
                window.location.href = data.redirect;            } else {
                // If no redirect URL, go to public events page as fallback
                console.log('No redirect URL provided, defaulting to public events page');
                window.location.href = '/public-events';
            }
        } catch (error) {
            console.error('Error during registration:', error);
            if (error.code === 'auth/email-already-in-use') {
                alert('An account with this email already exists');
            } else if (error.code === 'auth/invalid-email') {
                alert('Invalid email format');
            } else if (error.code === 'auth/operation-not-allowed') {
                alert('Email/password accounts are not enabled. Please contact support.');
            } else if (error.code === 'auth/weak-password') {
                alert('Password is too weak');
            } else {
                alert(error.message || 'Registration failed. Please try again');
            }
        } finally {
            window.hideLoadingOverlay();
            setIsRegistering(false); // Reset registration state
        }
    });
}
