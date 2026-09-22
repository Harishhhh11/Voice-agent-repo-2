// Google Identity Services (GSI) Client Helper

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
];

export interface GoogleUserSession {
  accessToken: string;
  expiresAt: number;
  email?: string;
  name?: string;
  picture?: string;
}

let cachedSession: GoogleUserSession | null = null;

const STORAGE_KEY = "apex_google_oauth_token";
const USER_KEY = "apex_google_user_profile";

export function getStoredGoogleSession(): GoogleUserSession | null {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { token: string; expiresAt: number };
    if (data.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
    const user = userRaw ? JSON.parse(userRaw) : {};
    cachedSession = {
      accessToken: data.token,
      expiresAt: data.expiresAt,
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
    return cachedSession;
  } catch {
    return null;
  }
}

export function clearGoogleSession() {
  cachedSession = null;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
}

export function saveGoogleSession(token: string, expiresInSeconds: number, profile?: { email?: string; name?: string; picture?: string }) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  cachedSession = {
    accessToken: token,
    expiresAt,
    email: profile?.email,
    name: profile?.name,
    picture: profile?.picture,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt }));
  if (profile) {
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
  }
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<{ email?: string; name?: string; picture?: string }> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
    }
  } catch (err) {
    console.warn("Could not fetch user profile from Google", err);
  }
  return {};
}
