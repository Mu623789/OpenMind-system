const API_BASE_URL = '/api';

async function apiRequest(path, options = {}) {
    const token = storage.get('accessToken');
    const response = await fetch(API_BASE_URL + path, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(options.headers || {})
        },
        ...options
    });
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
        if (!response.ok) {
            throw new Error('Request failed with status ' + response.status);
        }
        return response;
    }
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Request failed');
    }
    return result.data;
}
