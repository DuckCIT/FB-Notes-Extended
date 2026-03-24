import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, Music, Users, Clock3, X, Github, Languages, Trash2 } from 'lucide-react';
import { FacebookTokens } from '../lib/tokens';
import { processNoteInput } from '../lib/noteProcessor';
import { createTranslator, resolveInitialLanguage, type LanguageCode } from './i18n';

const MAX_DESCRIPTION_LENGTH = 10000;
const POPUP_STATE_KEY = 'popupComposerStateV2';
const POPUP_LANGUAGE_KEY = 'popupLanguageV1';
const MUSIC_PAGE_SIZE = 12;
const GITHUB_URL = 'https://github.com/DuckCIT/FB-Notes-Extended';

const DURATION_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '1h', value: 60 * 60 },
  { label: '6h', value: 6 * 60 * 60 },
  { label: '24h', value: 24 * 60 * 60 },
  { label: '3d', value: 3 * 24 * 60 * 60 },
];

type AudienceSetting = 'DEFAULT' | 'FRIENDS' | 'PUBLIC' | 'CONTACTS' | 'CUSTOM';
type FriendItem = {
  id: string;
  name: string;
  imageUri?: string;
};
type MusicItem = {
  id: string;
  songId?: string;
  audioClusterId?: string;
  title: string;
  artist: string;
  imageUri?: string;
  durationMs?: number;
};

type PersistedState = {
  audienceSetting: AudienceSetting;
  durationSeconds: number;
  customDurationMinutes: string;
  selectedFriendIds: string[];
  selectedFriends: FriendItem[];
  selectedMusic: MusicItem | null;
  musicStartTime: number;
};

type CurrentNoteStatus = {
  richStatusId?: string | null;
  avatarUri?: string;
  description?: string | null;
  noteType?: string | null;
  visibility?: string | null;
  expirationTime?: number | null;
  musicTitle?: string | null;
  musicArtist?: string | null;
  customAudienceNames?: string[];
  customAudienceSize?: number | null;
  defaultAudienceSetting?: string | null;
};

const formatDuration = (durationMs?: number): string => {
  if (!durationMs || durationMs <= 0) return '--:--';
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatDurationFromSeconds = (seconds: number): string => {
  if (seconds <= 0) return '0m';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const AUDIENCE_OPTIONS: Array<{ key: string; value: AudienceSetting }> = [
  { key: 'audience.default', value: 'DEFAULT' },
  { key: 'audience.friends', value: 'FRIENDS' },
  { key: 'audience.public', value: 'PUBLIC' },
  { key: 'audience.contacts', value: 'CONTACTS' },
  { key: 'audience.custom', value: 'CUSTOM' },
];

const App: React.FC = () => {
  const [tokens, setTokens] = useState<FacebookTokens | null>(null);
  const [tokenStatus, setTokenStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [noteText, setNoteText] = useState('');
  const [duration, setDuration] = useState(86400);
  const [customDurationMinutes, setCustomDurationMinutes] = useState('');
  const [audienceSetting, setAudienceSetting] = useState<AudienceSetting>('DEFAULT');

  const [friendQuery, setFriendQuery] = useState('');
  const [friendItems, setFriendItems] = useState<FriendItem[]>([]);
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendNextCursor, setFriendNextCursor] = useState<string | null>(null);
  const [friendHasNextPage, setFriendHasNextPage] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<FriendItem[]>([]);

  const [musicQuery, setMusicQuery] = useState('');
  const [musicItems, setMusicItems] = useState<MusicItem[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [visibleMusicCount, setVisibleMusicCount] = useState(MUSIC_PAGE_SIZE);
  const [selectedMusic, setSelectedMusic] = useState<MusicItem | null>(null);
  const [musicStartTime, setMusicStartTime] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [encodedLength, setEncodedLength] = useState(0);
  const [currentNoteStatus, setCurrentNoteStatus] = useState<CurrentNoteStatus | null>(null);
  const [currentStatusLoading, setCurrentStatusLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [activeModal, setActiveModal] = useState<'audience' | 'duration' | 'music' | null>(null);
  const [showFriendsModal, setShowFriendsModal] = useState(false);

  const [language, setLanguage] = useState<LanguageCode>(resolveInitialLanguage());
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const musicListRef = useRef<HTMLDivElement | null>(null);
  const friendsListRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    chrome.storage.local.get([POPUP_LANGUAGE_KEY], (res) => {
      const saved = res?.[POPUP_LANGUAGE_KEY] as LanguageCode | undefined;
      if (saved === 'vi' || saved === 'en') {
        setLanguage(saved);
      }
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.set({ [POPUP_LANGUAGE_KEY]: language });
  }, [language]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-lang-menu]')) return;
      setShowLanguageMenu(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const visibleMusicItems = useMemo(
    () => musicItems.slice(0, visibleMusicCount),
    [musicItems, visibleMusicCount]
  );

  useEffect(() => {
    chrome.storage.local.get([POPUP_STATE_KEY], (res) => {
      const saved = res?.[POPUP_STATE_KEY] as PersistedState | undefined;
      if (!saved) return;
      if (saved.audienceSetting) setAudienceSetting(saved.audienceSetting);
      if (typeof saved.durationSeconds === 'number' && saved.durationSeconds > 0) setDuration(saved.durationSeconds);
      if (typeof saved.customDurationMinutes === 'string') setCustomDurationMinutes(saved.customDurationMinutes);
      if (Array.isArray(saved.selectedFriendIds)) setSelectedFriendIds(saved.selectedFriendIds);
      if (Array.isArray(saved.selectedFriends)) setSelectedFriends(saved.selectedFriends);
      if (saved.selectedMusic) {
        const hasMusicCluster = Boolean(saved.selectedMusic.songId || saved.selectedMusic.audioClusterId);
        setSelectedMusic(hasMusicCluster ? saved.selectedMusic : null);
      }
      if (typeof saved.musicStartTime === 'number') setMusicStartTime(saved.musicStartTime);
    });
  }, []);

  useEffect(() => {
    const state: PersistedState = {
      audienceSetting,
      durationSeconds: duration,
      customDurationMinutes,
      selectedFriendIds,
      selectedFriends,
      selectedMusic,
      musicStartTime,
    };
    chrome.storage.local.set({ [POPUP_STATE_KEY]: state });
  }, [audienceSetting, duration, customDurationMinutes, selectedFriendIds, selectedFriends, selectedMusic, musicStartTime]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_TOKENS' }, (response) => {
      if (chrome.runtime.lastError || response?.error) {
        setTokenStatus('error');
      } else if (response?.tokens) {
        setTokens(response.tokens);
        setTokenStatus('ready');
      } else {
        setTokenStatus('error');
      }
    });
  }, []);

  useEffect(() => {
    const processed = processNoteInput(noteText);
    setEncodedLength(processed.fullDescription.length);
  }, [noteText]);

  useEffect(() => {
    if (result) {
      setShowToast(true);
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const handleSearchMusic = useCallback((query: string) => {
    if (!tokens || tokenStatus !== 'ready') return;

    setMusicLoading(true);
    chrome.runtime.sendMessage({
      type: 'SEARCH_MUSIC',
      tokens,
      query,
      count: 100,
    }, (response) => {
      setMusicLoading(false);
      if (chrome.runtime.lastError) {
        setResult({ type: 'error', message: chrome.runtime.lastError.message || 'Music search failed' });
        return;
      }

      if (response?.success) {
        setMusicItems(Array.isArray(response.items) ? response.items : []);
        setVisibleMusicCount(MUSIC_PAGE_SIZE);
      } else {
        setResult({ type: 'error', message: response?.error || 'Music search failed' });
      }
    });
  }, [tokens, tokenStatus]);

  const handleSearchFriends = useCallback((query: string, cursor: string | null = null) => {
    if (!tokens || tokenStatus !== 'ready') return;

    setFriendLoading(true);
    chrome.runtime.sendMessage({
      type: 'SEARCH_FRIENDS',
      tokens,
      query,
      cursor,
      count: 20,
    }, (response) => {
      setFriendLoading(false);
      if (chrome.runtime.lastError) {
        setResult({ type: 'error', message: chrome.runtime.lastError.message || 'Friend search failed' });
        return;
      }

      if (response?.success) {
        const incoming = Array.isArray(response.items) ? response.items as FriendItem[] : [];
        setFriendItems((prev) => {
          if (!cursor) return incoming;
          const map = new Map(prev.map((item) => [item.id, item]));
          for (const item of incoming) {
            map.set(item.id, item);
          }
          return Array.from(map.values());
        });
        setFriendNextCursor(typeof response.nextCursor === 'string' ? response.nextCursor : null);
        setFriendHasNextPage(Boolean(response.hasNextPage));

        setSelectedFriends((prev) => {
          if (prev.length === 0) return prev;
          const lookup = new Map(incoming.map((f) => [f.id, f]));
          return prev.map((f) => lookup.get(f.id) || f);
        });
      } else {
        setResult({ type: 'error', message: response?.error || 'Friend search failed' });
      }
    });
  }, [tokens, tokenStatus]);

  useEffect(() => {
    if (tokenStatus === 'ready' && tokens) {
      handleSearchMusic('');

      setCurrentStatusLoading(true);
      chrome.runtime.sendMessage({
        type: 'GET_CURRENT_NOTE_STATUS',
        tokens,
      }, (response) => {
        setCurrentStatusLoading(false);
        if (chrome.runtime.lastError || !response?.success) {
          return;
        }
        setCurrentNoteStatus(response.status || null);
      });
    }
  }, [tokenStatus, tokens, handleSearchMusic]);

  useEffect(() => {
    if (audienceSetting === 'CUSTOM' && tokenStatus === 'ready' && tokens && friendItems.length === 0) {
      handleSearchFriends('', null);
    }
  }, [audienceSetting, tokenStatus, tokens, friendItems.length, handleSearchFriends]);

  const toggleFriendSelection = useCallback((friend: FriendItem) => {
    setSelectedFriendIds((prev) => {
      if (prev.includes(friend.id)) {
        return prev.filter((id) => id !== friend.id);
      }
      return [...prev, friend.id];
    });

    setSelectedFriends((prev) => {
      if (prev.some((f) => f.id === friend.id)) {
        return prev.filter((f) => f.id !== friend.id);
      }
      return [friend, ...prev].slice(0, 30);
    });
  }, []);

  const removeSelectedFriend = useCallback((friendId: string) => {
    setSelectedFriendIds((prev) => prev.filter((id) => id !== friendId));
    setSelectedFriends((prev) => prev.filter((f) => f.id !== friendId));
  }, []);

  const applyCustomDuration = useCallback((minutesText: string) => {
    const parsed = Number(minutesText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    const seconds = Math.floor(parsed * 60);
    setDuration(seconds);
  }, []);

  const handleMusicListScroll = useCallback(() => {
    const el = musicListRef.current;
    if (!el || musicLoading) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (nearBottom && visibleMusicCount < musicItems.length) {
      setVisibleMusicCount((prev) => Math.min(prev + MUSIC_PAGE_SIZE, musicItems.length));
    }
  }, [musicLoading, visibleMusicCount, musicItems.length]);

  const handleFriendsListScroll = useCallback(() => {
    const el = friendsListRef.current;
    if (!el || friendLoading || !friendHasNextPage || !friendNextCursor) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (nearBottom) {
      handleSearchFriends(friendQuery, friendNextCursor);
    }
  }, [friendLoading, friendHasNextPage, friendNextCursor, handleSearchFriends, friendQuery]);

  const handleSubmit = useCallback(async () => {
    if (!tokens || isSubmitting) return;

    const processed = processNoteInput(noteText);
    const descriptionText = processed.fullDescription.trim();
    const hasSelectedMusic = Boolean(selectedMusic?.id);
    const hasMusicCluster = Boolean(selectedMusic?.songId || selectedMusic?.audioClusterId);

    if (!descriptionText && !hasSelectedMusic) {
      setResult({ type: 'error', message: t('share.error.empty') });
      return;
    }

    if (hasSelectedMusic && !hasMusicCluster) {
      setResult({ type: 'error', message: t('share.error.missing_song') });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    chrome.runtime.sendMessage({
      type: 'CREATE_NOTE',
      tokens,
      description: descriptionText || null,
      duration,
      audienceSetting,
      selectedFriendIds,
      selectedMusic,
      musicStartTime: selectedMusic ? musicStartTime : 0,
    }, (response) => {
      setIsSubmitting(false);
      if (chrome.runtime.lastError) {
        setResult({ type: 'error', message: chrome.runtime.lastError.message || 'Background worker not available' });
        return;
      }

      if (response?.success) {
        setResult({ type: 'success', message: t('share.success') });
        setNoteText('');

        setCurrentStatusLoading(true);
        chrome.runtime.sendMessage({
          type: 'GET_CURRENT_NOTE_STATUS',
          tokens,
        }, (statusResponse) => {
          setCurrentStatusLoading(false);
          if (chrome.runtime.lastError || !statusResponse?.success) {
            return;
          }
          setCurrentNoteStatus(statusResponse.status || null);
        });
      } else {
        setResult({ type: 'error', message: response?.error || t('share.error.failed') });
      }
    });
  }, [tokens, noteText, duration, audienceSetting, selectedFriendIds, selectedMusic, musicStartTime, isSubmitting, t]);

  const charPercentage = (encodedLength / MAX_DESCRIPTION_LENGTH) * 100;
  const charStatus = charPercentage < 50 ? 'safe' : charPercentage < 80 ? 'warning' : 'danger';
  const selectedFriendLookup = useMemo(
    () => new Set(selectedFriendIds),
    [selectedFriendIds]
  );

  const previewText = useMemo(() => {
    const text = (currentNoteStatus?.description || '').trim();
    if (text) return text;
    if (currentNoteStatus?.musicTitle) return `🎵 ${currentNoteStatus.musicTitle}`;
    return t('preview.placeholder');
  }, [currentNoteStatus, t]);

  const isPreviewPlaceholder = useMemo(() => {
    const text = (currentNoteStatus?.description || '').trim();
    if (text) return false;
    if (currentNoteStatus?.musicTitle) return false;
    return true;
  }, [currentNoteStatus]);

  const canDeleteNote = useMemo(() => {
    const id = (currentNoteStatus?.richStatusId || '').trim();
    return Boolean(id) && !isPreviewPlaceholder;
  }, [currentNoteStatus, isPreviewPlaceholder]);

  const refreshCurrentNoteStatus = useCallback(() => {
    if (!tokens) return;
    setCurrentStatusLoading(true);
    chrome.runtime.sendMessage({
      type: 'GET_CURRENT_NOTE_STATUS',
      tokens,
    }, (statusResponse) => {
      setCurrentStatusLoading(false);
      if (chrome.runtime.lastError || !statusResponse?.success) {
        return;
      }
      setCurrentNoteStatus(statusResponse.status || null);
    });
  }, [tokens]);

  const handleDeleteNote = useCallback(() => {
    if (!tokens || isDeleting) return;
    const richStatusId = (currentNoteStatus?.richStatusId || '').trim();
    if (!richStatusId) return;

    setIsDeleting(true);
    chrome.runtime.sendMessage({
      type: 'DELETE_NOTE',
      tokens,
      richStatusId,
    }, (response) => {
      setIsDeleting(false);
      if (chrome.runtime.lastError) {
        setResult({ type: 'error', message: chrome.runtime.lastError.message || 'Delete note failed' });
        return;
      }
      if (response?.success) {
        refreshCurrentNoteStatus();
      } else {
        setResult({ type: 'error', message: response?.error || 'Delete note failed' });
      }
    });
  }, [tokens, isDeleting, currentNoteStatus, refreshCurrentNoteStatus]);

  const shareLabel = useMemo(() => {
    if (isPreviewPlaceholder) {
      return '';
    }
    const visibility = (currentNoteStatus?.visibility || currentNoteStatus?.defaultAudienceSetting || '').toUpperCase();
    if (visibility === 'PUBLIC') return t('status.share.public');
    if (visibility === 'FRIENDS') return t('status.share.friends');
    if (visibility === 'CONTACTS') return t('status.share.contacts');
    if (visibility === 'CUSTOM') {
      const names = Array.isArray(currentNoteStatus?.customAudienceNames) ? currentNoteStatus.customAudienceNames : [];
      if (names.length === 0) return t('status.share.custom.no_names');
      const first = names.slice(0, 2).join(', ');
      const remaining = names.length - 2;
      return remaining > 0
        ? t('status.share.custom.with_names_more', { names: first, remaining })
        : t('status.share.custom.with_names', { names: first });
    }
    return t('status.share.default');
  }, [currentNoteStatus, isPreviewPlaceholder, t]);

  const expiryLabelShort = useMemo(() => {
    if (isPreviewPlaceholder) return '';
    const ts = currentNoteStatus?.expirationTime;
    if (!ts) return '';
    const target = new Date(ts * 1000);
    if (Number.isNaN(target.getTime())) return '';

    const now = Date.now();
    const diffMs = Math.max(0, target.getTime() - now);
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const hours = totalHours;
    const datePart = target.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });

    return t('status.expiry.with_hours', { date: datePart, hours });
  }, [currentNoteStatus, isPreviewPlaceholder, t]);



  return (
    <div className="container">

      <div className="note-preview-stage">
        {canDeleteNote && (
          <button
            className={`preview-delete-btn ${isDeleting ? 'is-loading' : ''}`}
            onClick={handleDeleteNote}
            disabled={currentStatusLoading || isDeleting}
            title="Delete note"
            type="button"
          >
            <Trash2 size={14} />
          </button>
        )}
        <div className="note-bubble-preview" ref={bubbleRef}> 
          {currentNoteStatus?.musicTitle && !currentStatusLoading && (
            <div className="bubble-music-title-row">
              <Music size={13} />
              <span>{currentNoteStatus.musicTitle}</span>
            </div>
          )}
          {currentNoteStatus?.musicArtist && !currentStatusLoading && (
            <div className="bubble-music-artist-row">{currentNoteStatus.musicArtist}</div>
          )}
          <div
            className={`bubble-note-content ${isPreviewPlaceholder ? 'is-placeholder' : ''} ${currentStatusLoading ? 'is-shimmer' : ''}`}
          >
            {currentStatusLoading ? '' : previewText}
          </div>
          <div className="bubble-pointer-dots" aria-hidden="true">
            <span className="pointer-dot dot-large" />
            <span className="pointer-dot dot-small" />
          </div>
        </div>
        <div className="note-avatar-preview">
          {currentStatusLoading ? (
            <div className="note-avatar-img avatar-shimmer" />
          ) : currentNoteStatus?.avatarUri ? (
            <img src={currentNoteStatus.avatarUri} alt="Avatar" className="note-avatar-img" />
          ) : (
            <div className="note-avatar-fallback"></div>
          )}
        </div>
        <div className="note-preview-meta">
          <div className="bubble-meta-line">{currentStatusLoading ? t('preview.loading') : shareLabel}</div>
          <div className="bubble-meta-line secondary">{currentStatusLoading ? '' : expiryLabelShort}</div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <span className="section-title">{t('composer.title')}</span>
        </div>
        <div className="section-content">
          <div className="note-composer">
            <div className="composer-scroll">
              <textarea
                className="note-textarea"
                placeholder={t('composer.placeholder')}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={tokenStatus !== 'ready'}
              />
              <div className="char-counter">
                <div className="char-bar-container">
                  <div 
                    className={`char-bar ${charStatus}`}
                    style={{ width: `${Math.min(charPercentage, 100)}%` }}
                  />
                </div>
                <span className="char-text">{encodedLength} / {MAX_DESCRIPTION_LENGTH}</span>
              </div>
              <div className="char-counter-footer">
                <div className="action-buttons-row">
                  <div className="action-left" data-lang-menu>
                    <button
                      className="icon-btn"
                      onClick={() => chrome.tabs.create({ url: GITHUB_URL })}
                      disabled={tokenStatus !== 'ready'}
                      title={t('action.github')}
                      type="button"
                    >
                      <Github size={14} />
                    </button>
                    <div className="lang-menu-wrapper" data-lang-menu>
                      <button
                        className={`icon-btn ${showLanguageMenu ? 'has-value' : ''}`}
                        onClick={() => setShowLanguageMenu((v) => !v)}
                        title={t('action.language')}
                        type="button"
                      >
                        <Languages size={14} />
                        <span className="icon-badge">{language.toUpperCase()}</span>
                      </button>
                      {showLanguageMenu && (
                        <div className="lang-menu" role="menu">
                          <button
                            className={`lang-option ${language === 'vi' ? 'active' : ''}`}
                            onClick={() => {
                              setLanguage('vi');
                              setShowLanguageMenu(false);
                            }}
                            type="button"
                          >
                            {t('lang.vi')}
                          </button>
                          <button
                            className={`lang-option ${language === 'en' ? 'active' : ''}`}
                            onClick={() => {
                              setLanguage('en');
                              setShowLanguageMenu(false);
                            }}
                            type="button"
                          >
                            {t('lang.en')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className={`icon-btn ${audienceSetting !== 'DEFAULT' ? 'has-value' : ''}`}
                    onClick={() => setActiveModal('audience')}
                    disabled={tokenStatus !== 'ready'}
                    title="Audience"
                  >
                    <Users size={14} />
                    {audienceSetting !== 'DEFAULT' && (
                      <span className="icon-badge">
                        {audienceSetting === 'CUSTOM' ? `${selectedFriendIds.length}` : audienceSetting.charAt(0)}
                      </span>
                    )}
                  </button>
                  <button
                    className={`icon-btn ${duration !== 86400 ? 'has-value' : ''}`}
                    onClick={() => setActiveModal('duration')}
                    disabled={tokenStatus !== 'ready'}
                    title="Duration"
                  >
                    <Clock3 size={14} />
                    {duration !== 86400 && (
                      <span className="icon-badge">{formatDurationFromSeconds(duration)}</span>
                    )}
                  </button>
                  <button
                    className={`icon-btn ${selectedMusic ? 'has-value' : ''}`}
                    onClick={() => setActiveModal('music')}
                    disabled={tokenStatus !== 'ready'}
                    title="Music"
                  >
                    <Music size={14} />
                    {selectedMusic && <span className="icon-badge">♪</span>}
                  </button>
                  <button
                    className={`action-btn ${result?.type === 'success' ? 'success' : ''}`}
                    onClick={handleSubmit}
                    disabled={tokenStatus !== 'ready' || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={12} className="spinner" />
                        <span>{t('share.submitting')}</span>
                      </>
                    ) : (
                      <span>{t('share.button')}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Audience Modal */}
      {activeModal === 'audience' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{t('audience.title')}</span>
              <button className="modal-close" onClick={() => setActiveModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="audience-options">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`audience-option ${audienceSetting === opt.value ? 'active' : ''}`}
                    onClick={() => {
                      setAudienceSetting(opt.value as AudienceSetting);
                      if (opt.value === 'CUSTOM') {
                        setShowFriendsModal(true);
                      } else {
                        // Clear custom friends when switching away from CUSTOM
                        setSelectedFriendIds([]);
                        setSelectedFriends([]);
                      }
                    }}
                  >
                    {t(opt.key)}
                    {opt.value === 'CUSTOM' && selectedFriendIds.length > 0 && (
                      <span className="option-badge">{selectedFriendIds.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duration Modal */}
      {activeModal === 'duration' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{t('duration.title')}</span>
              <button className="modal-close" onClick={() => setActiveModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="duration-selector">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`duration-btn ${duration === opt.value ? 'active' : ''}`}
                    onClick={() => {
                      setDuration(opt.value);
                      setCustomDurationMinutes('');
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="duration-custom-row">
                <input
                  className="duration-custom-input"
                  type="number"
                  min="1"
                  step="1"
                  value={customDurationMinutes}
                  onChange={(e) => setCustomDurationMinutes(e.target.value)}
                  placeholder={t('duration.custom_placeholder')}
                />
                <button
                  className="duration-custom-btn"
                  onClick={() => applyCustomDuration(customDurationMinutes)}
                  disabled={!customDurationMinutes}
                >
                  {t('duration.apply')}
                </button>
              </div>
              <div className="duration-current">{t('duration.current', { duration: formatDurationFromSeconds(duration) })}</div>
            </div>
          </div>
        </div>
      )}

      {/* Music Modal */}
      {activeModal === 'music' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{t('music.title')}</span>
              <button className="modal-close" onClick={() => setActiveModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {selectedMusic && (() => {
                const maxSec = selectedMusic.durationMs ? Math.floor(selectedMusic.durationMs / 1000) - 30 : 0;
                const clampedStart = Math.min(musicStartTime, maxSec);
                const formatSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
                return (
                  <div className="music-selected-wrapper">
                    <div className="music-selected">
                      <div className="music-selected-text">
                        <strong>{selectedMusic.title}</strong>
                        <span>{selectedMusic.artist || 'Unknown artist'}</span>
                      </div>
                      <button
                        className="music-clear-btn"
                        onClick={() => { setSelectedMusic(null); setMusicStartTime(0); }}
                      >
                        {t('music.clear')}
                      </button>
                    </div>
                    {maxSec > 0 && (
                      <div className="music-timeline">
                        <span className="music-timeline-label">{t('music.start_time')}</span>
                        <div className="music-timeline-slider-wrap">
                          <input
                            id="music-timeline-slider"
                            type="range"
                            className="music-timeline-slider"
                            min={0}
                            max={maxSec}
                            step={1}
                            value={clampedStart}
                            style={{ '--slider-value': `${maxSec > 0 ? Math.round((clampedStart / maxSec) * 100) : 0}%` } as React.CSSProperties}
                            onChange={(e) => setMusicStartTime(Number(e.target.value))}
                          />
                          <div className="music-timeline-times">
                            <span className="music-timeline-current">{formatSec(clampedStart)}</span>
                            <span className="music-timeline-total">{formatSec(maxSec)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="music-search-row">
                <input
                  className="music-search-input"
                  value={musicQuery}
                  onChange={(e) => setMusicQuery(e.target.value)}
                  placeholder={t('music.search_placeholder')}
                  disabled={musicLoading}
                />
                <button
                  className="music-search-btn"
                  onClick={() => handleSearchMusic(musicQuery)}
                  disabled={musicLoading}
                >
                  {musicLoading ? '...' : t('music.search')}
                </button>
              </div>
              <div className="music-list" ref={musicListRef} onScroll={handleMusicListScroll}>
                {visibleMusicItems.map((item) => (
                  <button
                    key={`${item.id}-${item.songId || ''}`}
                    className={`music-item ${selectedMusic?.id === item.id ? 'active' : ''}`}
                    onClick={() => { setSelectedMusic(item); setMusicStartTime(0); }}
                  >
                    <div className="music-item-top">
                      {item.imageUri ? (
                        <img src={item.imageUri} alt={item.title} className="music-cover" loading="lazy" />
                      ) : (
                        <div className="music-cover music-cover-placeholder">♪</div>
                      )}
                      <div className="music-item-text">
                        <span className="music-item-title">{item.title}</span>
                        <span className="music-item-artist">{item.artist || 'Unknown artist'}</span>
                      </div>
                      <span className="music-item-duration">{formatDuration(item.durationMs)}</span>
                    </div>
                  </button>
                ))}
                {!musicLoading && musicItems.length === 0 && (
                  <div className="music-empty">{t('music.empty')}</div>
                )}
                {musicItems.length > visibleMusicCount && (
                  <div className="music-loading-more">{t('music.load_more')}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Friends Modal */}
      {showFriendsModal && (
        <div className="modal-overlay" onClick={() => setShowFriendsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{t('friends.title', { count: selectedFriendIds.length })}</span>
              <button className="modal-close" onClick={() => setShowFriendsModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {selectedFriends.length > 0 && (
                <div className="selected-friends-chips">
                  {selectedFriends.map((friend) => (
                    <button
                      key={friend.id}
                      className="friend-chip"
                      onClick={() => removeSelectedFriend(friend.id)}
                    >
                      <span>{friend.name}</span>
                      <X size={12} />
                    </button>
                  ))}
                </div>
              )}
              <div className="friends-search-row">
                <input
                  className="friends-search-input"
                  value={friendQuery}
                  onChange={(e) => setFriendQuery(e.target.value)}
                  placeholder={t('friends.search_placeholder')}
                  disabled={friendLoading}
                />
                <button
                  className="friends-search-btn"
                  onClick={() => handleSearchFriends(friendQuery, null)}
                  disabled={friendLoading}
                >
                  {friendLoading ? '...' : t('friends.search')}
                </button>
              </div>
              <div className="friends-list" ref={friendsListRef} onScroll={handleFriendsListScroll}>
                {friendItems.map((friend) => {
                  const active = selectedFriendLookup.has(friend.id);
                  return (
                    <button
                      key={friend.id}
                      className={`friend-item ${active ? 'active' : ''}`}
                      onClick={() => toggleFriendSelection(friend)}
                    >
                      {friendLoading ? (
                        <div className="friend-avatar avatar-shimmer" />
                      ) : friend.imageUri ? (
                        <img className="friend-avatar" src={friend.imageUri} alt={friend.name} loading="lazy" />
                      ) : (
                        <div className="friend-avatar friend-avatar-placeholder">👤</div>
                      )}
                      <span className="friend-name">{friend.name}</span>
                      <span className="friend-check">{active ? '✓' : ''}</span>
                    </button>
                  );
                })}
                {friendLoading && <div className="music-loading-more">{t('friends.loading')}</div>}
                {!friendLoading && friendItems.length === 0 && (
                  <div className="music-empty">{t('friends.empty')}</div>
                )}
              </div>
              {friendHasNextPage && (
                <div className="friends-pagination-hint">{t('music.load_more')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && result && (
        <div className={`toast ${result.type}`}>
          {result.message}
        </div>
      )}
    </div>
  );
};

export default App;
