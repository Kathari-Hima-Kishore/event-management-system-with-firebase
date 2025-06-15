// Update stats periodically
let updateStatsInterval;
let isUpdating = false;

function updateStats() {
    if (isUpdating) return;
    isUpdating = true;
    showLoadingOverlay();
    console.log('[DevDashboard] updateStats called');

    const token = localStorage.getItem('authToken');

    fetch('/dev/stats', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        console.log('[DevDashboard] /dev/stats response:', response.status);
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                clearInterval(updateStatsInterval);
                window.location.href = '/login';
            }
            throw new Error('Failed to fetch stats');
        }
        return response.json();
    })
    .then(stats => {
        console.log('[DevDashboard] Stats received:', stats);
        document.getElementById('totalUsers').textContent = stats.total_users;
        document.getElementById('pendingAdmins').textContent = stats.pending_admins;
        document.getElementById('bannedUsers').textContent = stats.banned_users;
    })
    .catch(error => {
        console.error('[DevDashboard] Error:', error);
        if (error.message === 'Authentication required') {
            clearInterval(updateStatsInterval);
            window.location.href = '/login';
        }
    })
    .finally(() => {
        hideLoadingOverlay();
        isUpdating = false;
    });
}

// Ban/unban user functionality
function banUser(userId) {
    updateUserStatus(userId, true);
}

function unbanUser(userId) {
    updateUserStatus(userId, false);
}

// Admin approval functionality
function approveAdmin(adminId, action) {
    const approve = action === 'approve';
    showLoadingOverlay();
    
    const token = localStorage.getItem('authToken');

    fetch('/dev/admin/approve', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            adminId: adminId,
            approve: approve
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            alert(data.error || `Failed to ${action} admin`);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert(`Failed to ${action} admin`);
    })
    .finally(() => {
        hideLoadingOverlay();
    });
}

function updateUserStatus(userId, isBanned) {
    showLoadingOverlay();
    const token = localStorage.getItem('authToken');
    return fetchWithLoading('/dev/user/status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            userId: userId,
            is_banned: isBanned
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            alert(data.error || 'Failed to update user status');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to update user status');
    })
    .finally(() => {
        hideLoadingOverlay();
    });
}

// Admin approval functionality
async function handleAdminApproval(adminId, approve) {
    showLoadingOverlay();
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetchWithLoading('/dev/admin/approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                adminId: adminId,
                approve: approve
            })
        });

        const data = await response.json();
        if (data.success) {
            location.reload();
        } else {
            alert(data.error || 'Failed to update admin status');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to update admin status');
    } finally {
        hideLoadingOverlay();
    }
}
