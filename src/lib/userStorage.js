/**
 * User & Guest Storage Manager
 * Ensures every guest gets a unique isolated device ID (guest_xxxx)
 * and every logged-in user gets an isolated account storage scope.
 */

export function getUserIdentity() {
  if (typeof window === 'undefined') {
    return { id: 'guest_ssr', isGuest: true, name: 'Guest' };
  }

  try {
    const rawUser = localStorage.getItem('freeyt_user_auth');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u && (u.email || u.uid)) {
        return {
          id: u.email || u.uid,
          isGuest: false,
          name: u.displayName || u.email?.split('@')[0] || 'Learner',
          email: u.email
        };
      }
    }
  } catch (e) {
    console.error("Error parsing user session:", e);
  }

  let guestId = localStorage.getItem('freeyt_guest_id');
  if (!guestId) {
    guestId = 'guest_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('freeyt_guest_id', guestId);
  }

  return {
    id: guestId,
    isGuest: true,
    name: 'Guest Learner'
  };
}

export function getUserStorageKey(prefix) {
  const user = getUserIdentity();
  return `${prefix}_${user.id}`;
}

export function getSubscriptions() {
  if (typeof window === 'undefined') return [];
  const key = getUserStorageKey('freeyt_subscribed_creators');
  try {
    const raw = localStorage.getItem(key);
    let subs = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(subs)) {
      subs = [];
      localStorage.setItem(key, JSON.stringify(subs));
    }
    return subs;
  } catch (e) {
    return [];
  }
}

export function setSubscriptions(subs) {
  if (typeof window === 'undefined') return;
  const key = getUserStorageKey('freeyt_subscribed_creators');
  localStorage.setItem(key, JSON.stringify(subs));
  window.dispatchEvent(new CustomEvent('subscriptionsChanged', { detail: subs }));
}

export function getWatchLater() {
  if (typeof window === 'undefined') return [];
  const key = getUserStorageKey('freeyt_watch_later');
  try {
    const raw = localStorage.getItem(key);
    let wl = raw ? JSON.parse(raw) : null;
    return Array.isArray(wl) ? wl : [];
  } catch (e) {
    return [];
  }
}

export function setWatchLater(wl) {
  if (typeof window === 'undefined') return;
  const key = getUserStorageKey('freeyt_watch_later');
  localStorage.setItem(key, JSON.stringify(wl));
  window.dispatchEvent(new CustomEvent('watchLaterChanged', { detail: wl }));
}

export function getWatchHistory() {
  if (typeof window === 'undefined') return [];
  const key = getUserStorageKey('freeyt_watch_history');
  try {
    const raw = localStorage.getItem(key);
    let history = raw ? JSON.parse(raw) : null;
    return Array.isArray(history) ? history : [];
  } catch (e) {
    return [];
  }
}

export function setWatchHistory(history) {
  if (typeof window === 'undefined') return;
  const key = getUserStorageKey('freeyt_watch_history');
  localStorage.setItem(key, JSON.stringify(history));
  window.dispatchEvent(new CustomEvent('watchHistoryChanged', { detail: history }));
}

export function getSiteViewsMap() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('freeyt_site_course_views');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function getCourseSiteViews(slug) {
  if (!slug || typeof window === 'undefined') return 0;
  const viewsMap = getSiteViewsMap();
  return Number(viewsMap[slug]) || 0;
}

export function recordCourseSiteView(slug) {
  if (!slug || typeof window === 'undefined') return;
  try {
    const viewsMap = getSiteViewsMap();
    viewsMap[slug] = (Number(viewsMap[slug]) || 0) + 1;
    localStorage.setItem('freeyt_site_course_views', JSON.stringify(viewsMap));
    window.dispatchEvent(new CustomEvent('siteViewsChanged', { detail: { slug, views: viewsMap[slug] } }));
  } catch (e) {
    console.error("Failed to record site view", e);
  }
}

export function getUserRating(slug) {
  if (!slug || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user_ratings');
    if (raw) {
      const ratings = JSON.parse(raw);
      return ratings[slug] || null;
    }
  } catch (e) {
    console.error("Error reading user rating:", e);
  }
  return null;
}

export function saveUserRating(slug, rating) {
  if (!slug || typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('user_ratings');
    const ratings = raw ? JSON.parse(raw) : {};
    
    if (rating === 0) {
      delete ratings[slug];
    } else {
      ratings[slug] = rating;
    }
    
    localStorage.setItem('user_ratings', JSON.stringify(ratings));
  } catch (e) {
    console.error("Error saving user rating:", e);
  }
}
