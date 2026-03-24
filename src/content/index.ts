const PADDING_START = "\u200c";
const PADDING_END = "\u{e0061}";
const CHARS = [
  "\u{e0062}", "\u{e0063}", "\u{e0064}", "\u{e0065}", "\u{e0066}", "\u{e0067}",
  "\u{e0068}", "\u{e0069}", "\u{e006a}", "\u{e006b}", "\u{e006c}", "\u{e006d}",
  "\u{e006e}", "\u{e006f}", "\u{e0070}", "\u{e0071}", "\u{e0072}", "\u{e0073}",
  "\u{e0074}", "\u{e0075}", "\u{e0076}", "\u{e0077}", "\u{e0078}", "\u{e0079}",
  "\u{e007a}", "\u{e007f}",
];

const encodedPattern = new RegExp(`${PADDING_START}([${CHARS.join('')}]+?)${PADDING_END}`);
const CHARS_MAP = CHARS.reduce<Record<string, number>>((curr, val, i) => {
  curr[val] = i;
  return curr;
}, {});

const lenCalc = (base: number, chars: number): number => {
  let len = 0;
  let curr = 1;
  while (curr < chars) {
    curr *= base;
    len++;
  }
  return len;
};

const UNICODE_CHARS = 1114112;
const BASE = CHARS.length;
const LEN = lenCalc(BASE, UNICODE_CHARS);

const decodeChar = (encodedChar: number[]): string => {
  encodedChar = encodedChar.reverse();
  let curr = 1;
  let charCode = 0;
  for (const digit of encodedChar) {
    charCode += digit * curr;
    curr *= BASE;
  }
  return String.fromCodePoint(charCode);
};

const decode = (s: string): string => {
  const match = encodedPattern.exec(s);
  if (!match) return s;

  s = match[1];
  let curr: number[] = [];
  let res = '';

  for (const c of s) {
    curr.push(CHARS_MAP[c]);
    if (curr.length >= LEN) {
      res += decodeChar(curr);
      curr = [];
    }
  }
  return res;
};

const hasEncodedContent = (s: string): boolean => encodedPattern.test(s);

console.debug('[IFBN] content script loaded v1.0.1');

let observerEnabled = true;

const initObserver = () => {
  chrome.storage.local.get(['observerEnabled'], (result) => {
    observerEnabled = result.observerEnabled !== false;
    if (observerEnabled) {
      startObserver();
    }
  });
};

chrome.storage.onChanged.addListener((changes) => {
  if (changes.observerEnabled !== undefined) {
    observerEnabled = changes.observerEnabled.newValue;
    if (observerEnabled) {
      startObserver();
    } else {
      stopObserver();
    }
  }
});

let mutationObserver: MutationObserver | null = null;

const startObserver = () => {
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  mutationObserver = new MutationObserver((mutations) => {
    if (!observerEnabled) return;
    
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processNode(node as Element);
        }
      }
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  processExistingNotes();
};

const stopObserver = () => {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
};

const processNode = (node: Element) => {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
  
  let textNode: Text | null;
  while ((textNode = walker.nextNode() as Text | null)) {
    if (textNode.textContent && hasEncodedContent(textNode.textContent)) {
      textNodes.push(textNode);
    }
  }

  for (const tn of textNodes) {
    decodeTextNode(tn);
  }
};

const processExistingNotes = () => {
  const allTextNodes: Text[] = [];
  const walker = document.createTreeWalker(
    document.body, 
    NodeFilter.SHOW_TEXT, 
    {
      acceptNode: (node) => {
        if (node.textContent && hasEncodedContent(node.textContent)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  let textNode: Text | null;
  while ((textNode = walker.nextNode() as Text | null)) {
    allTextNodes.push(textNode);
  }

  for (const tn of allTextNodes) {
    decodeTextNode(tn);
  }
};

const decodeTextNode = (textNode: Text) => {
  const content = textNode.textContent;
  if (!content) return;

  const decoded = decode(content);
  if (decoded !== content) {
    const span = document.createElement('span');
    span.className = 'ifbn-decoded-note';
    span.style.cssText = 'display: inline;';
    
    const visiblePart = content.split(PADDING_START)[0] || '';
    span.innerHTML = `${escapeHtml(visiblePart)} <span style="background: rgba(139,92,246,0.2); color: #a78bfa; padding: 1px 4px; border-radius: 3px; font-size: 0.9em;">🔒 ${escapeHtml(decoded)}</span>`;
    
    textNode.parentNode?.replaceChild(span, textNode);
  }
};

const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initObserver);
} else {
  initObserver();
}
