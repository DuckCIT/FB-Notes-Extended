import en from './en.json';
import vi from './vi.json';

export type LanguageCode = 'vi' | 'en';

type Dict = Record<string, string>;

const dictionaries: Record<LanguageCode, Dict> = {
  en: en as Dict,
  vi: vi as Dict,
};

export const DEFAULT_LANGUAGE: LanguageCode = 'vi';

export const resolveInitialLanguage = (): LanguageCode => {
  const nav = (typeof navigator !== 'undefined' ? navigator.language : '') || '';
  const lower = nav.toLowerCase();
  if (lower.startsWith('vi')) return 'vi';
  if (lower.startsWith('en')) return 'en';
  return DEFAULT_LANGUAGE;
};

export const formatTemplate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = params[key];
    return v === undefined || v === null ? '' : String(v);
  });
};

export const createTranslator = (language: LanguageCode) => {
  const dict = dictionaries[language] || dictionaries[DEFAULT_LANGUAGE];
  return (key: string, params?: Record<string, string | number>): string => {
    const value = dict[key] ?? dictionaries[DEFAULT_LANGUAGE][key] ?? key;
    return formatTemplate(value, params);
  };
};
