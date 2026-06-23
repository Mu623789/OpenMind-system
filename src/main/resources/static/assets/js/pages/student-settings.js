document.addEventListener('DOMContentLoaded', function () {
    const user = requireCurrentUser();
    if (!user) {
        return;
    }

    const message = qs('#message');
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    const isTeacher = user.role === 'TEACHER';

    var avatarEl = qs('#profileAvatar');
    renderProfileAvatar(user);
    selectCurrentAvatar(user);

    qs('#profileName').textContent = user.name || '-';
    qs('#profileEmail').textContent = user.email || '';
    qs('#profileNameSummary').textContent = user.name || '-';
    qs('#profileEmailSummary').textContent = user.email || '-';
    updatePersonalitySummary(user.personality, isTeacher);
    updateCoinSummary(isTeacher ? null : 'Loading...');

    var badge = qs('#profileRoleBadge');
    badge.textContent = isTeacher ? 'Teacher' : 'Student';
    badge.style.background = isTeacher ? 'var(--violet-100)' : 'rgba(45,212,191,.15)';
    badge.style.color = isTeacher ? 'var(--violet-600)' : 'var(--teal-600)';

    if (isTeacher) {
        qs('#avatarSection').style.display = 'none';
        qs('#personalitySection').style.display = 'none';
        updateCoinSummary('-');
    } else if (user.personality) {
        var selected = document.querySelector('input[name="personality"][value="' + user.personality + '"]');
        if (selected) {
            selected.checked = true;
        }
    }

    if (!isTeacher) {
        loadProfileCoins();
    }

    qs('#backButton').addEventListener('click', function () {
        if (from === 'discussion-room') {
            window.location.href = './discussion-room.html';
            return;
        }
        if (from === 'teacher-dashboard') {
            window.location.href = './teacher-dashboard.html';
            return;
        }
        if (from === 'teacher-session') {
            var sid = params.get('sessionId');
            window.location.href = './teacher-session.html' + (sid ? '?sessionId=' + sid : '');
            return;
        }
        window.location.href = isTeacher ? './teacher-dashboard.html' : './waiting-room.html';
    });

    if (!isTeacher) {
        qs('#avatarForm').addEventListener('submit', async function (event) {
            event.preventDefault();
            try {
                var avatar = qs('input[name="avatar"]:checked');
                if (!avatar) {
                    throw new Error('Please select an avatar');
                }
                var updatedUser = await apiRequest('/students/avatar', {
                    method: 'POST',
                    body: JSON.stringify({ avatar: avatar.value })
                });
                updatedUser = Object.assign({}, getCurrentUser() || user, updatedUser);
                saveCurrentUser(updatedUser);
                renderProfileAvatar(updatedUser);
                showMessage(message, 'Avatar updated');
            } catch (error) {
                showMessage(message, error.message, true);
            }
        });

        qs('#personalityForm').addEventListener('submit', async function (event) {
            event.preventDefault();
            try {
                var personality = qs('input[name="personality"]:checked');
                if (!personality) {
                    throw new Error('Please select E or I');
                }
                var updatedUser = await apiRequest('/students/personality', {
                    method: 'POST',
                    body: JSON.stringify({ personality: personality.value })
                });
                updatedUser = Object.assign({}, getCurrentUser() || user, updatedUser);
                saveCurrentUser(updatedUser);
                updatePersonalitySummary(updatedUser.personality, false);
                showMessage(message, 'Profile updated');
            } catch (error) {
                showMessage(message, error.message, true);
            }
        });
    }

    function renderProfileAvatar(profile) {
        var avatarSrc = getProfileAvatarSrc(profile);
        if (avatarSrc) {
            avatarEl.textContent = '';
            avatarEl.style.background = 'rgba(255, 255, 255, .82)';
            avatarEl.style.overflow = 'hidden';
            avatarEl.style.padding = '8px';
            avatarEl.innerHTML = '<img src="' + avatarSrc + '" alt="Selected avatar" style="width:100%;height:100%;object-fit:contain;display:block;">';
        } else {
            var initial = (user.name || '?').trim().charAt(0).toUpperCase();
            avatarEl.textContent = initial;
            avatarEl.style.background = isTeacher
                ? 'linear-gradient(135deg, #312e81, var(--violet-600))'
                : 'linear-gradient(135deg, #042f2e, var(--teal-500))';
        }
    }

    function selectCurrentAvatar(profile) {
        if (!profile || !profile.avatar) {
            return;
        }
        var selected = qs('input[name="avatar"][value="' + profile.avatar + '"]');
        if (selected) {
            selected.checked = true;
        }
    }

    function getProfileAvatarSrc(profile) {
        if (profile && profile.avatar) {
            return '../assets/images/avatars/' + profile.avatar;
        }
        var normalizedName = (profile && profile.name ? profile.name : '').trim().toLowerCase();
        if (normalizedName === 'student_alice' || normalizedName === 'alice') {
            return '../assets/images/avatars/alice-kitty.png';
        }
        if (normalizedName === 'student_bob' || normalizedName === 'bob') {
            return '../assets/images/avatars/bob-drawing.png';
        }
        return '';
    }

    function updatePersonalitySummary(personality, teacher) {
        if (teacher) {
            qs('#profilePersonalitySummary').textContent = 'Teacher';
            return;
        }
        if (personality === 'E') {
            qs('#profilePersonalitySummary').textContent = 'E - Extrovert';
            return;
        }
        if (personality === 'I') {
            qs('#profilePersonalitySummary').textContent = 'I - Introvert';
            return;
        }
        qs('#profilePersonalitySummary').textContent = 'Not selected';
    }

    async function loadProfileCoins() {
        try {
            var sessions = await apiRequest('/students/my-sessions');
            var totalCoins = 0;
            (sessions || []).forEach(function (session) {
                totalCoins += calculateRoundCoins(session.totalSpeakingSeconds || 0, session.durationMinutes || 0);
            });
            updateCoinSummary(totalCoins);
        } catch (error) {
            updateCoinSummary('-');
            console.error(error);
        }
    }

    function calculateRoundCoins(score, durationMinutes) {
        if (!durationMinutes) {
            return 0;
        }
        var sessionDurationSeconds = Math.max(1, durationMinutes * 60);
        var progress = Math.max(0, Math.min(100, ((score || 0) / sessionDurationSeconds) * 100));
        var passedFlags = [20, 40, 60, 80].filter(function (checkpoint) {
            return progress >= checkpoint;
        }).length;
        return passedFlags * 10;
    }

    function updateCoinSummary(value) {
        var coinSummary = qs('#profileCoinsSummary');
        if (!coinSummary) {
            return;
        }
        var textNode = coinSummary.querySelector('span');
        if (textNode) {
            textNode.textContent = value === null ? '-' : value;
        }
    }
});
