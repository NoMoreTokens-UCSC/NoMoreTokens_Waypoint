/** True when the app talks to a real backend (the demo's local data is not in use). */
export const realBackend = !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== ''
