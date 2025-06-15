// Event handling functions for anonymous users
let currentEvents = [];
let isProcessingImage = false;

// Load events when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check for Windows-specific features
    const isWindows = navigator.platform.indexOf('Win') > -1;
    if (isWindows) {
        // Add Windows-specific event listeners
        window.addEventListener('focus', () => {
            // Refresh data when window regains focus
            loadEvents();
        });
    }
    
    loadEvents();
    setupModalHandling();
    setupEventUpdates();
});

// Modal handling
function setupModalHandling() {
    const modal = document.getElementById('eventModal');
    const closeBtn = document.querySelector('.close');

    closeBtn?.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Make all functions needed by inline event handlers available globally
window.showEventModal = function(event = null) {
    const modal = document.getElementById('eventModal');
    const form = document.getElementById('eventForm');
    
    if (event) {
        // Editing existing event
        form.querySelector('#title').value = event.title;
        form.querySelector('#description').value = event.description;
        form.querySelector('#date').value = event.date;
        form.querySelector('#location').value = event.location;
        form.setAttribute('data-event-id', event.id);
    } else {
        // Creating new event
        form.reset();
        form.removeAttribute('data-event-id');
    }
    
    modal.style.display = 'block';
};

// Delete event function for regular dashboard
window.deleteEventFromDashboard = async function(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) {
        return;
    }

    showLoadingOverlay();
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please login again');
            window.location.href = '/login';
            return;
        }

        // Use the main.js deleteEvent API function
        await window.deleteEventAPI(eventId);
        loadEvents();
    } catch (error) {
        console.error('Error deleting event:', error);
        alert('Failed to delete event');
    } finally {
        hideLoadingOverlay();
    }
};

// Make it available as deleteEvent for backward compatibility with HTML templates
window.deleteEvent = window.deleteEventFromDashboard;

window.showEventStats = async function(eventId) {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please login again');
            window.location.href = '/login';
            return;
        }

        const response = await fetch(`/api/events/stats/${eventId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                alert('You can only view stats for events you created');
                return;
            }
            throw new Error('Failed to fetch stats');
        }
        
        const stats = await response.json();
        
        // Create and show stats modal
        const statsHtml = `
            <div class="modal" id="statsModal">
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>Event Statistics</h2>
                    <p>Total Enrollments: ${stats.total_enrollments}</p>
                    <h3>Enrolled Users:</h3>
                    <ul>
                        ${stats.users.map(user => `
                            <li>${user.username} (${user.email})</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
        
        // Remove existing stats modal if any
        const existingModal = document.getElementById('statsModal');
        if (existingModal) existingModal.remove();
        
        // Add new modal to body
        document.body.insertAdjacentHTML('beforeend', statsHtml);
        
        // Show modal and handle close
        const modal = document.getElementById('statsModal');
        modal.style.display = 'block';
        
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => modal.style.display = 'none';
        
        window.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
    } catch (error) {
        console.error('Error loading event stats:', error);
        alert('Failed to load event statistics');
    }
};

// Load events from the server
async function loadEvents() {
    showLoading();
    try {
        // First check if Firebase is initialized and user is authenticated
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
            // Get a fresh token
            const token = await currentUser.getIdToken(true);
            localStorage.setItem('authToken', token);
        } else {
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.log('No token found, redirecting to login');
                window.location.href = '/login';
                return;
            }
        }

        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/events', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.log('Token expired or invalid, redirecting to login');
                localStorage.removeItem('authToken');
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to fetch events');
        }

        const events = await response.json();
        currentEvents = events;
        displayEvents(events);
    } catch (error) {
        console.error('[fetchEvents] Error:', error);
        // Only redirect on auth errors
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            alert('Failed to load events. Please try again.');
        }
    } finally {
        hideLoading();
    }
}

// Display events in the grid
function displayEvents(events) {
    const container = document.getElementById('eventsGrid');
    if (!container) return;
    container.innerHTML = '';

    events.forEach(event => {
        const card = createEventCard(event);
        container.appendChild(card);
    });
}

// Create an event card
function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-card';
    
    let imageHtml = '';
    if (event.imageUrl) {
        imageHtml = `<img src="${event.imageUrl}" alt="${event.title}" class="event-image">`;
    }
    
    const userRole = document.querySelector('.dashboard').getAttribute('data-user-role');
    const isAdmin = userRole === 'admin';
    const eventForModal = { ...event };
    delete eventForModal.enrollments; // Remove enrollments to prevent JSON circular reference
    
    // Get creator information
    const creatorInfo = event.creator ? 
        `<p class="event-creator">Created by: ${event.creator.username}</p>` : '';
    
    card.innerHTML = `
        ${imageHtml}
        <div class="event-content">
            <h3>${event.title}</h3>
            <p class="event-description">${event.description}</p>
            <p class="event-datetime"><strong>Date:</strong> ${new Date(event.date).toLocaleString()}</p>
            <p class="event-location"><strong>Location:</strong> ${event.location}</p>
            ${creatorInfo}
            <div class="event-actions">
                ${isAdmin ? `
                    <button onclick="showEventStats('${event.id}')" class="btn-secondary">View Stats</button>
                    ${event.isCreator ? `
                        <button onclick="editEvent('${event.id}')" class="btn-primary">Edit</button>
                        <button onclick="deleteEvent('${event.id}')" class="btn-danger">Delete</button>
                    ` : ''}
                ` : `
                    ${event.currentUserEnrolled ? 
                        `<button class="btn-danger" onclick="handleEnrollment('${event.id}', ${event.currentUserEnrolled})">Un-enroll</button>` :
                        `<button class="btn-primary" onclick="handleEnrollment('${event.id}', ${event.currentUserEnrolled})">Enroll Now</button>`
                    }
                `}
            </div>
            ${event.enrollments > 0 ? `
            <div class="enrollment-count">
                <p>${event.enrollments} ${event.enrollments === 1 ? 'person' : 'people'} enrolled</p>
            </div>` : ''}
        </div>
    `;
    
    return card;
}

// Handle event form submission
document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please login again');
            window.location.href = '/login';
            return;
        }

        const form = e.target;
        const formData = new FormData(form);
        const eventData = {
            title: formData.get('title'),
            description: formData.get('description'),
            date: formData.get('date'),
            location: formData.get('location')
        };

        const response = await fetch('/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(eventData)
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('authToken');
                window.location.href = '/login';
                return;
            }
            const data = await response.json();
            throw new Error(data.error || 'Failed to create event');
        }

        const modal = document.getElementById('eventModal');
        modal.style.display = 'none';
        form.reset();
        await loadEvents(); // Refresh the events list
    } catch (error) {
        console.error('Error creating event:', error);
        alert(error.message || 'An error occurred while creating the event');
    } finally {
        hideLoading();
    }
});

// Upload image to Flask backend (store in Firebase RTDB as base64)
async function uploadImage(file) {
    if (isProcessingImage) {
        throw new Error('Another image is currently being processed. Please wait.');
    }
    
    return new Promise((resolve, reject) => {
        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
            reject('File size must be less than 5MB');
            return;
        }

        // Check file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            reject('Invalid file type. Please use JPEG, PNG, GIF, or WebP images.');
            return;
        }

        isProcessingImage = true;
        let worker = null;

        try {
            // Create a worker for image processing
            worker = new Worker('/static/js/image-worker.js');
            
            worker.onmessage = async function(e) {
                try {
                    if (e.data.error) {
                        throw new Error(e.data.error);
                    }

                    const base64 = e.data;
                    const response = await fetch('/api/upload-image', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: JSON.stringify({
                            image_name: file.name,
                            image_base64: base64
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    
                    const data = await response.json();
                    if (data.success) {
                        resolve('data:' + file.type + ';base64,' + base64);
                    } else {
                        reject(data.error || 'Failed to upload image');
                    }
                } catch (err) {
                    reject(err);
                } finally {
                    if (worker) {
                        worker.terminate();
                    }
                    isProcessingImage = false;
                }
            };

            worker.onerror = function(err) {
                reject(new Error('Image processing failed: ' + err.message));
                if (worker) {
                    worker.terminate();
                }
                isProcessingImage = false;
            };

            // Read file and send to worker
            const reader = new FileReader();
            reader.onload = function(e) {
                worker.postMessage({
                    imageData: e.target.result,
                    maxWidth: 1200,  // Max width for resizing
                    maxHeight: 1200, // Max height for resizing
                    quality: 0.8     // JPEG quality
                });
            };
            reader.onerror = function(err) {
                reject(new Error('Failed to read file: ' + err.message));
                if (worker) {
                    worker.terminate();
                }
                isProcessingImage = false;
            };
            reader.readAsDataURL(file);
        } catch (err) {
            if (worker) {
                worker.terminate();
            }
            isProcessingImage = false;
            reject(new Error('Failed to process image: ' + err.message));
        }
    });
}

// Loading indicator functions
function showLoading() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';
}

function hideLoading() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

// Dev functions for user management
async function approveUser(userId) {
    await updateUserStatus(userId, 'approve');
}

async function denyUser(userId) {
    await updateUserStatus(userId, 'deny');
}

async function banUser(userId) {
    await updateUserStatus(userId, 'ban', true);
}

async function unbanUser(userId) {
    await updateUserStatus(userId, 'ban', false);
}

async function updateUserStatus(userId, action, isBan = false) {
    showLoading();
    try {
        const endpoint = isBan ? '/dev/ban-user' : '/dev/approve-user';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                action: isBan ? (action === 'ban' ? 'ban' : 'unban') : action,
            }),
        });

        if (response.ok) {
            window.location.reload();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to update user status');
        }
    } catch (error) {
        console.error('Error updating user status:', error);
        alert('Failed to update user status');
    } finally {
        hideLoading();
    }
}

// Enrollment functionality
async function enrollInEvent(eventId) {
    showLoading();
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please login to enroll in events');
            window.location.href = '/login';
            return;
        }

        const response = await fetch(`/api/events/${eventId}/enroll`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            await loadEvents(); // Refresh events to update enrollment status
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to enroll in event');
        }
    } catch (error) {
        console.error('Error enrolling in event:', error);
        alert('Failed to enroll in event');
    } finally {
        hideLoading();
    }
}

async function unenrollFromEvent(eventId) {
    if (!confirm('Are you sure you want to un-enroll from this event?')) {
        return;
    }

    showLoading();
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please login again');
            window.location.href = '/login';
            return;
        }

        const response = await fetch(`/api/events/${eventId}/unenroll`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            await loadEvents(); // Refresh events to update enrollment status
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to un-enroll from event');
        }
    } catch (error) {
        console.error('Error un-enrolling from event:', error);
        alert('Failed to un-enroll from event');
    } finally {
        hideLoading();
    }
}

// Add real-time updates for events
function setupEventUpdates() {
    const eventsRef = firebase.database().ref('events');
    eventsRef.on('child_changed', (snapshot) => {
        const updatedEvent = snapshot.val();
        updatedEvent.id = snapshot.key;
        
        // Update the event in the current events array
        const index = currentEvents.findIndex(e => e.id === updatedEvent.id);
        if (index !== -1) {
            currentEvents[index] = updatedEvent;
            displayEvents(currentEvents);
        }
    });

    eventsRef.on('child_removed', (snapshot) => {
        const removedEventId = snapshot.key;
        
        // Remove the event from the current events array
        currentEvents = currentEvents.filter(e => e.id !== removedEventId);
        displayEvents(currentEvents);
    });
}
