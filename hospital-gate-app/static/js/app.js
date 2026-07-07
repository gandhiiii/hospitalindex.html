let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            currentUser = await res.json();
            const userInfo = document.getElementById('userInfo');
            if (userInfo) {
                userInfo.innerHTML = `<strong>${currentUser.name}</strong><br><span style="font-size:11px;color:rgba(255,255,255,0.4)">${currentUser.role.toUpperCase()}</span>`;
            }
            if (currentUser.role !== 'admin') {
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            }
        }
    } catch (e) {
        console.error('Auth check failed', e);
    }

    updateLiveTime();
    setInterval(updateLiveTime, 1000);
    loadAlertCount();
});

function updateLiveTime() {
    const el = document.getElementById('liveTime');
    if (el) el.textContent = new Date().toLocaleString();
}

async function loadAlertCount() {
    try {
        const res = await fetch('/api/alerts/unread-count');
        const data = await res.json();
        const badge = document.getElementById('alertBadge');
        if (badge) {
            badge.textContent = data.count;
            badge.style.display = data.count > 0 ? 'inline' : 'none';
        }
    } catch (e) { /* ignore */ }
}
