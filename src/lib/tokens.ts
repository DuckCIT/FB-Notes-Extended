export interface FacebookTokens {
  fb_dtsg: string;
  jazoest: string;
  userId: string;
  lsd: string;
}

export const extractTokens = (cookie: string, html: string): FacebookTokens | null => {
  const userId = extractUserId(cookie);
  const fb_dtsg = sanitizeToken(extractFbDtsg(html));
  const jazoest = extractJazoest(fb_dtsg);
  const lsd = sanitizeToken(extractLsd(html));

  if (!userId || !fb_dtsg) {
    return null;
  }

  return { fb_dtsg, jazoest, userId, lsd };
};

const extractUserId = (cookie: string): string => {
  const regex = /c_user=(\d+);/gm;
  const match = regex.exec(cookie);
  return match ? match[1] : '';
};

const extractFbDtsg = (html: string): string => {
  const regex = /"DTSG(?:Initia|Init)l?Data",\[],\{"token":"([^"\\]{8,300})"/m;
  const match = regex.exec(html);
  return match ? match[1] : '';
};

const extractJazoest = (dtsg: string): string => {
  if (!dtsg) return '';
  let sum = 0;
  for (let i = 0; i < dtsg.length; i++) {
    sum += dtsg.charCodeAt(i);
  }
  return "2" + sum;
};

const extractLsd = (html: string): string => {
  let match = /name="lsd" value="([^"\\]{6,300})"/m.exec(html);
  if (match) return match[1];
  match = /"LSD",\[],\{"token":"([^"\\]{6,300})"/m.exec(html);
  return match ? match[1] : '';
};

const sanitizeToken = (value: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length < 6 || trimmed.length > 300) return '';
  // Tokens are short ASCII strings; reject anything that looks like embedded JSON/HTML/script.
  if (!/^[A-Za-z0-9:_\-]+$/.test(trimmed)) return '';
  return trimmed;
};

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
