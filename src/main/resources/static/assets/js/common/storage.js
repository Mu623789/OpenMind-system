const storage = {
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },
    get(key) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    },
    remove(key) {
        localStorage.removeItem(key);
    }
};
