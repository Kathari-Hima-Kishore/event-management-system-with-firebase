// Modal handling
const modal = document.getElementById('eventModal');
const closeBtn = document.querySelector('.close');
const eventForm = document.getElementById('eventForm');

closeBtn?.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

let currentEventId = null;

// Global variable to track if image should be deleted
let deleteCurrentImage = false;

// Add event listener for delete image button
document.addEventListener('DOMContentLoaded', () => {
    const deleteImageBtn = document.getElementById('deleteImageBtn');
    if (deleteImageBtn) {
        deleteImageBtn.addEventListener('click', () => {
            const currentImageContainer = document.getElementById('currentImageContainer');
            deleteCurrentImage = true;
            currentImageContainer.style.display = 'none';
            
            // Show confirmation
            Swal.fire({
                icon: 'success',
                title: 'Image Removed',
                text: 'The image will be removed when you save the event.',
                timer: 2000,
                showConfirmButton: false,
                background: 'rgba(255, 255, 255, 0.9)',
                backdrop: 'rgba(0, 0, 0, 0.4)',
                customClass: {
                    popup: 'swal2-popup-glass',
                    title: 'swal2-title-glass',
                    content: 'swal2-content-glass'
                }
            });
        });
    }
});

function showEventModal(event = null) {
    currentEventId = event?.id || null;
    deleteCurrentImage = false; // Reset the delete flag
    const form = document.getElementById('eventForm');
    const currentImageContainer = document.getElementById('currentImageContainer');
    const currentImage = document.getElementById('currentImage');
    const deleteImageBtn = document.getElementById('deleteImageBtn');
    
    if (event) {
        // Editing existing event
        form.querySelector('#title').value = event.title;
        form.querySelector('#description').value = event.description;
        form.querySelector('#date').value = event.date;
        form.querySelector('#location').value = event.location;
        
        // Handle current image display
        if (event.imageUrl) {
            currentImage.src = event.imageUrl;
            currentImageContainer.style.display = 'block';
        } else {
            currentImageContainer.style.display = 'none';
        }
    } else {
        // Creating new event
        form.reset();
        currentImageContainer.style.display = 'none';
    }
    
    modal.style.display = 'block';
}

// Make showEventModal globally available for admin dashboard
window.showEventModal = showEventModal;

// Edit event function - loads event data and shows modal
async function editEvent(eventId) {
    showLoading();
    try {
        const response = await fetch(`/api/events/${eventId}`);
        if (!response.ok) {
            throw new Error('Failed to load event data');
        }
        const event = await response.json();
        
        // Format the date for datetime-local input
        if (event.date) {
            const date = new Date(event.date);
            const formattedDate = date.toISOString().slice(0, 16);
            event.date = formattedDate;
        }
        
        showEventModal(event);
    } catch (error) {
        console.error('Error loading event for editing:', error);
        showError('Failed to load event data');
    } finally {
        hideLoading();
    }
}

// Make editEvent globally available
window.editEvent = editEvent;

// Delete event function - renamed to avoid conflict with main.js
async function deleteEventWithConfirmation(eventId) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This action cannot be undone!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        background: 'rgba(255, 255, 255, 0.9)',
        backdrop: 'rgba(0, 0, 0, 0.4)',
        customClass: {
            popup: 'swal2-popup-glass',
            title: 'swal2-title-glass',
            content: 'swal2-content-glass',
            confirmButton: 'swal2-confirm-button-glass',
            cancelButton: 'swal2-cancel-button-glass'
        }
    });    if (result.isConfirmed) {
        showLoading();
        try {
            // Call the deleteEvent function from main.js (renamed to avoid conflict)
            await window.deleteEventAPI(eventId);
            await loadEvents(); // Reload events after deletion
            
            Swal.fire({
                title: 'Deleted!',
                text: 'Event has been deleted.',
                icon: 'success',
                background: 'rgba(255, 255, 255, 0.9)',
                backdrop: 'rgba(0, 0, 0, 0.4)',
                customClass: {
                    popup: 'swal2-popup-glass',
                    title: 'swal2-title-glass',
                    content: 'swal2-content-glass',
                    confirmButton: 'swal2-confirm-button-glass'
                }
            });
        } catch (error) {
            console.error('Error deleting event:', error);
            showError('Failed to delete event');
        } finally {
            hideLoading();
        }
    }
}

// Make deleteEventWithConfirmation globally available as deleteEvent for the HTML templates
window.deleteEvent = deleteEventWithConfirmation;

// Upload image to Flask backend (store in Firebase RTDB as base64)
async function uploadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64 = e.target.result.split(',')[1]; // Remove data:image/...;base64,
            try {
                const response = await fetch('/api/upload-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_name: file.name,
                        image_base64: base64
                    })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    resolve('data:' + file.type + ';base64,' + base64);
                } else {
                    reject(data.error || 'Failed to upload image');
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

eventForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const eventData = {
        title: formData.get('title'),
        description: formData.get('description'),
        date: formData.get('date'),
        location: formData.get('location')
    };    // Handle image upload and deletion
    const imageFile = formData.get('image');
    if (imageFile && imageFile.size > 0) {
        // New image uploaded
        try {
            const imageUrl = await uploadImage(imageFile);
            eventData.imageUrl = imageUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            showError('Failed to upload image');
            return;
        }
    } else if (deleteCurrentImage) {
        // Delete existing image
        eventData.imageUrl = null;
        deleteCurrentImage = false; // Reset the flag
    }
    // If neither new image nor delete flag, keep existing image (don't set imageUrl property)

    try {
        if (currentEventId) {
            await window.updateEvent(currentEventId, eventData);
        } else {
            await window.createEvent(eventData);
        }
        modal.style.display = 'none';
        await loadEvents(); // Reload events
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to save event');
    }
});

// Loading state management
let isLoading = false;

function showLoading() {
    isLoading = true;
    document.body.style.cursor = 'wait';
    window.showLoadingOverlay();
}

function hideLoading() {
    isLoading = false;
    document.body.style.cursor = 'default';
    window.hideLoadingOverlay();
}

// Check admin approval status
async function checkAdminStatus() {
    try {
        const response = await fetch('/api/dashboard-data');
        const data = await response.json();
        
        console.log('[admin_dashboard.js] Dashboard data response:', data);
        
        // Ensure the user is an admin before proceeding with the approval check
        if (data.success && data.user && data.user.role === 'admin') {
            if (!data.user.is_approved) {
                console.log('[admin_dashboard.js] Admin not approved, redirecting to pending page');
                window.location.href = '/admin_pending';
                return false;
            }
            console.log('[admin_dashboard.js] Admin approved, proceeding with dashboard');
            return true; // Admin is approved
        } else if (data.success && data.user) {
            // If it's a non-admin user who somehow reached here, redirect them
            console.log('[admin_dashboard.js] Non-admin user detected:', data.user.role);
            // Let the server handle the redirection instead of doing it in JavaScript
            // This prevents incorrect redirections
            window.location.href = '/dashboard';
            return false;
        }
        
        // If not successful or no user data, redirect to login
        console.log('[admin_dashboard.js] No valid user data, redirecting to login');
        window.location.href = '/login';
        return false;
        
    } catch (error) {
        console.error('Error checking admin status:', error);
        // On error, redirect to login to be safe
        window.location.href = '/login';
        return false;
    }
}

// Load events
async function loadEvents() {
    // Only attempt to load events if admin status check passes (meaning user is an approved admin)
    if (!await checkAdminStatus()) return;
    
    showLoading();
    try {
        const response = await fetch('/events', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const events = await response.json();
        
        const eventsList = document.getElementById('eventsList');
        eventsList.innerHTML = '';
        
        events.forEach(event => {
            const eventCard = createEventCard(event);
            eventsList.appendChild(eventCard);
        });
    } catch (error) {
        console.error('Error loading events:', error);
        showError('Failed to load events');
    } finally {
        hideLoading();
    }
}

// Load user statistics
async function loadUserStats() {
     // Only attempt to load user stats if admin status check passes
    if (!await checkAdminStatus()) return;
    
    showLoading();
    try {
        const response = await fetch('/api/dashboard-data');
        const data = await response.json();
        
        if (data.success && data.user) {
            updateUserInfo(data.user);
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
        showError('Failed to load user statistics');
    } finally {
        hideLoading();
    }
}

function showError(message) {
    const errorDiv = createErrorElement();
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function createErrorElement() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #ff4444;
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 1000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    return errorDiv;
}

function updateUserInfo(user) {
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        usernameElement.textContent = user.username || 'Admin';
    }
}

function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.setAttribute('data-event-id', event.id);
    
    const isCreator = event.isCreator;
    
    let imageHtml = '';
    if (event.imageUrl) {
        imageHtml = `<img src="${event.imageUrl}" alt="${event.title}" class="event-image">`;
    }

    card.innerHTML = `
        ${imageHtml}
        <div class="event-content">
            <h3>${event.title}</h3>
            <p>${event.description}</p>
            <p>Date: ${new Date(event.date).toLocaleString()}</p>
            <p>Location: ${event.location}</p>
            <p>Enrollments: ${event.enrollments || 0}</p>
            <div class="event-actions">
                <button onclick="showEventStats('${event.id}')" class="btn-secondary">View Stats</button>
                ${isCreator ? `
                    <button onclick="editEvent('${event.id}')" class="btn-primary">Edit</button>
                    <button onclick="deleteEvent('${event.id}')" class="btn-danger">Delete</button>
                ` : ''}
            </div>
        </div>
    `;
    
    return card;
}

async function showEventStats(eventId) {
    showLoading();
    try {
        const stats = await window.getEventStats(eventId);
        const event = stats.event_details;
        
        Swal.fire({
            title: 'Event Statistics',
            html: `
                <div class="event-stats">
                    <h3>${event.title}</h3>
                    <p><strong>Date:</strong> ${new Date(event.date).toLocaleString()}</p>
                    <p><strong>Location:</strong> ${event.location}</p>
                    <p><strong>Total Enrollments:</strong> ${stats.total_enrollments}</p>
                    ${stats.isCreator ? `
                        <h4>Enrolled Users:</h4>
                        <ul>
                            ${stats.users.map(user => `
                                <li>${user.username} (${user.email})</li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            `,
            width: '600px',
            background: 'rgba(255, 255, 255, 0.9)',
            backdrop: 'rgba(0, 0, 0, 0.4)',
            customClass: {
                popup: 'swal2-popup-glass',
                title: 'swal2-title-glass',
                content: 'swal2-content-glass',
                confirmButton: 'swal2-confirm-button-glass'
            }
        });
    } catch (error) {
        console.error('Error showing event stats:', error);
        showError('Failed to load event statistics');
    } finally {
        hideLoading();
    }
}

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', async () => {
    if (await checkAdminStatus()) {
        await loadEvents();
        await loadUserStats();
    }
});
