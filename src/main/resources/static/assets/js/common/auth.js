function saveCurrentUser(user) {
    storage.set('currentUser', user);
}

function saveAccessToken(token) {
    storage.set('accessToken', token);
}

function getAccessToken() {
    return storage.get('accessToken');
}

function getCurrentUser() {
    return storage.get('currentUser');
}

function requireCurrentUser() {
    const user = getCurrentUser();
    const token = getAccessToken();
    if (!user || !token) {
        window.location.href = '../pages/login.html';
        return null;
    }
    return user;
}

async function logout() {
    try {
        const token = getAccessToken();
        if (token) {
            await apiRequest('/auth/logout', {
                method: 'POST'
            });
        }
    } catch (error) {
    }
    storage.remove('currentUser');
    storage.remove('accessToken');
    storage.remove('joinedSessionId');
    storage.remove('currentGroup');
    window.location.href = '../pages/login.html';
}
