/**
 * VideoPlayer - 简洁视频播放器
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Animated,
  StatusBar,
  Dimensions,
  BackHandler,
  Modal,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { setStatusBarHidden } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';

// 可选导入
let NavigationBar: any = null;
try { NavigationBar = require('expo-navigation-bar'); } catch {}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// Bitiful HLS 转码 URL
function toBitifulHLSUrl(originalUrl: string): string {
  if (!originalUrl.includes('.bitiful.net') && !originalUrl.includes('s3.bitiful')) {
    return originalUrl;
  }
  const baseUrl = originalUrl.replace(/!style:[^/]+\/[^?]+/, '');
  return `${baseUrl}!style:medium/auto_medium.m3u8`;
}

interface VideoPlayerProps {
  url: string;
  filename: string;
  posterUrl?: string;
}

export function VideoPlayer({ url, filename, posterUrl }: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [dimensions, setDimensions] = useState(Dimensions.get('screen'));

  const [status, setStatus] = useState<AVPlaybackStatusSuccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [rateBeforeLongPress, setRateBeforeLongPress] = useState(1.0);
  const [isMirrored, setIsMirrored] = useState(false);
  
  // 保存切换全屏时的状态
  const savedPosition = useRef(0);
  const wasPlaying = useRef(false);

  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const doubleTapAnim = useRef(new Animated.Value(0)).current;

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const lastTapX = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPlaying = status?.isPlaying ?? false;
  const position = (status?.positionMillis ?? 0) / 1000;
  const duration = (status?.durationMillis ?? 0) / 1000;
  const buffered = (status?.playableDurationMillis ?? 0) / 1000;

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ screen }) => setDimensions(screen));
    return () => sub.remove();
  }, []);

  const exitFullscreen = useCallback(async () => {
    // 保存当前状态
    savedPosition.current = position;
    wasPlaying.current = isPlaying;
    
    setIsFullscreen(false);
    setShowSpeedMenu(false);
    setStatusBarHidden(false, 'fade');
    NavigationBar?.setVisibilityAsync?.('visible');
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, [position, isPlaying]);

  const enterFullscreen = useCallback(async () => {
    // 保存当前状态
    savedPosition.current = position;
    wasPlaying.current = isPlaying;
    
    setIsFullscreen(true);
    setStatusBarHidden(true, 'fade');
    NavigationBar?.setVisibilityAsync?.('hidden');
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  }, [position, isPlaying]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showSpeedMenu) { setShowSpeedMenu(false); return true; }
      if (isFullscreen) { exitFullscreen(); return true; }
      return false;
    });
    return () => handler.remove();
  }, [isFullscreen, showSpeedMenu, exitFullscreen]);

  useEffect(() => {
    return () => { 
      setStatusBarHidden(false, 'fade');
      NavigationBar?.setVisibilityAsync?.('visible');
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); 
    };
  }, []);

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!isPlaying || showSpeedMenu) return;
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, [isPlaying, showSpeedMenu]);

  useEffect(() => {
    if (showControls && isPlaying) resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [showControls, isPlaying, resetHideTimer]);

  const handlePlaybackStatusUpdate = useCallback((s: AVPlaybackStatus) => {
    if (s.isLoaded) {
      setStatus(s);
      setIsLoading(false);
      setHasError(false);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    if (isPlaying) await videoRef.current.pauseAsync();
    else await videoRef.current.playAsync();
  }, [isPlaying]);

  const seekBy = useCallback(async (sec: number) => {
    if (!videoRef.current) return;
    const newPos = Math.max(0, Math.min(position + sec, duration));
    await videoRef.current.setPositionAsync(newPos * 1000);
  }, [position, duration]);

  const seekTo = useCallback(async (sec: number) => {
    if (!videoRef.current) return;
    await videoRef.current.setPositionAsync(Math.max(0, Math.min(sec, duration)) * 1000);
  }, [duration]);

  const setSpeed = useCallback(async (speed: number) => {
    if (!videoRef.current) return;
    await videoRef.current.setRateAsync(speed, true);
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
  }, []);

  const startLongPress = useCallback(async () => {
    if (!videoRef.current) return;
    setRateBeforeLongPress(playbackRate);
    await videoRef.current.setRateAsync(2.0, true);
    setIsLongPressing(true);
  }, [playbackRate]);

  const endLongPress = useCallback(async () => {
    if (!videoRef.current || !isLongPressing) return;
    await videoRef.current.setRateAsync(rateBeforeLongPress, true);
    setIsLongPressing(false);
  }, [isLongPressing, rateBeforeLongPress]);

  const formatTime = (sec: number) => {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleVideoPress = useCallback((e: any) => {
    const now = Date.now();
    const { locationX } = e.nativeEvent;
    const w = isFullscreen ? dimensions.height : dimensions.width;

    if (now - lastTap.current < 280 && Math.abs(locationX - lastTapX.current) < 80) {
      lastTap.current = 0;
      if (locationX < w * 0.33) {
        seekBy(-10);
        setDoubleTapSide('left');
        Animated.sequence([
          Animated.timing(doubleTapAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(doubleTapAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => setDoubleTapSide(null));
      } else if (locationX > w * 0.67) {
        seekBy(10);
        setDoubleTapSide('right');
        Animated.sequence([
          Animated.timing(doubleTapAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(doubleTapAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => setDoubleTapSide(null));
      } else {
        togglePlay();
      }
    } else {
      lastTap.current = now;
      lastTapX.current = locationX;
      setTimeout(() => {
        if (Date.now() - lastTap.current >= 250) {
          setShowControls(v => !v);
          setShowSpeedMenu(false);
        }
      }, 280);
    }
  }, [isFullscreen, dimensions, seekBy, togglePlay, doubleTapAnim]);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(startLongPress, 500);
  }, [startLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    endLongPress();
  }, [endLongPress]);

  const handleProgressPress = useCallback((e: any) => {
    if (duration <= 0) return;
    const { locationX } = e.nativeEvent;
    const w = isFullscreen ? dimensions.height - 40 : dimensions.width - 24;
    const pct = Math.max(0, Math.min(1, locationX / w));
    seekTo(pct * duration);
  }, [duration, isFullscreen, dimensions, seekTo]);

  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  if (hasError) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={40} color="rgba(255,255,255,0.6)" />
        <ThemedText style={styles.errorText}>播放失败</ThemedText>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setHasError(false); setIsLoading(true); }}>
          <ThemedText style={styles.retryText}>重试</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  // 渲染播放器内容
  const renderPlayer = (inModal: boolean) => (
    <View style={[styles.player, inModal && styles.fullscreenPlayer]}>
      <TouchableWithoutFeedback 
        onPress={handleVideoPress} 
        onPressIn={handleTouchStart} 
        onPressOut={handleTouchEnd}
      >
        <View style={[styles.videoWrap, isMirrored && styles.mirrored]}>
          <Video
            ref={videoRef}
            source={{ uri: toBitifulHLSUrl(url) }}
            posterSource={posterUrl ? { uri: posterUrl } : undefined}
            usePoster={!!posterUrl}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={wasPlaying.current}
            positionMillis={savedPosition.current * 1000}
            rate={playbackRate}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            onError={() => { setIsLoading(false); setHasError(true); }}
          />
        </View>
      </TouchableWithoutFeedback>

      {isLoading && <View style={styles.overlay}><ActivityIndicator size="large" color="#fff" /></View>}

      {isLongPressing && (
        <View style={styles.speedBadge}>
          <Ionicons name="play-forward" size={14} color="#fff" />
          <ThemedText style={styles.speedBadgeText}>2x</ThemedText>
        </View>
      )}

      {doubleTapSide && (
        <Animated.View style={[styles.doubleTap, doubleTapSide === 'left' ? styles.dtLeft : styles.dtRight, { opacity: doubleTapAnim }]}>
          <MaterialCommunityIcons name={doubleTapSide === 'left' ? 'rewind-10' : 'fast-forward-10'} size={28} color="#fff" />
        </Animated.View>
      )}

      {showControls && (
        <View style={[styles.controls, !inModal && styles.controlsSmall]}>
          {inModal && (
            <View style={styles.topBar}>
              <TouchableOpacity onPress={exitFullscreen} style={styles.backBtn} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <ThemedText style={styles.title} numberOfLines={1}>{filename}</ThemedText>
              <TouchableOpacity onPress={() => setIsMirrored(!isMirrored)} style={[styles.mirrorBtn, isMirrored && styles.mirrorBtnActive]} activeOpacity={0.7}>
                <ThemedText style={styles.mirrorText}>镜像</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {inModal && (
            <View style={styles.centerArea}>
              <TouchableOpacity onPress={togglePlay} style={styles.bigPlay}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.bottomBar, inModal && styles.bottomBarFs]}>
            <TouchableWithoutFeedback onPress={handleProgressPress}>
              <View style={styles.progressWrap}>
                <View style={styles.progressBg}>
                  <View style={[styles.progressBuf, { width: `${bufPct}%` }]} />
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <View style={[styles.thumb, { left: `${pct}%` }]} />
              </View>
            </TouchableWithoutFeedback>

            <View style={styles.row}>
              <TouchableOpacity onPress={togglePlay} style={styles.btn}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
              </TouchableOpacity>
              <ThemedText style={styles.time}>{formatTime(position)} / {formatTime(duration)}</ThemedText>
              <View style={styles.spacer} />
              {inModal && (
                <TouchableOpacity onPress={() => setShowSpeedMenu(true)} style={styles.btn}>
                  <ThemedText style={styles.speedText}>{playbackRate}x</ThemedText>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={inModal ? exitFullscreen : enterFullscreen} style={styles.btn}>
                <Ionicons name={inModal ? 'contract' : 'expand'} size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showSpeedMenu && (
        <TouchableWithoutFeedback onPress={() => setShowSpeedMenu(false)}>
          <View style={styles.menuOverlay}>
            <View style={styles.menu}>
              {SPEED_OPTIONS.map(s => (
                <TouchableOpacity key={s} style={[styles.menuItem, playbackRate === s && styles.menuItemActive]} onPress={() => setSpeed(s)}>
                  <ThemedText style={[styles.menuText, playbackRate === s && styles.menuTextActive]}>{s}x</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );

  return (
    <>
      <View style={styles.container}>
        {!isFullscreen && renderPlayer(false)}
      </View>
      <Modal visible={isFullscreen} animationType="fade" supportedOrientations={['landscape']} statusBarTranslucent onRequestClose={exitFullscreen}>
        <StatusBar hidden />
        {renderPlayer(true)}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', aspectRatio: 16/9, backgroundColor: '#000' },
  player: { flex: 1, backgroundColor: '#000' },
  fullscreenPlayer: { flex: 1 },
  videoWrap: { flex: 1 },
  mirrored: { transform: [{ scaleX: -1 }] },
  video: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#fff', marginTop: 8 },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16 },
  retryText: { color: '#fff', fontSize: 13 },
  speedBadge: { position: 'absolute', top: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, zIndex: 10 },
  speedBadgeText: { color: '#fff', fontSize: 12 },
  doubleTap: { position: 'absolute', top: '50%', marginTop: -24, backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 30, zIndex: 10 },
  dtLeft: { left: 40 },
  dtRight: { right: 40 },
  controls: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', zIndex: 5 },
  controlsSmall: { justifyContent: 'flex-end' },
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingTop: 12, backgroundColor: 'rgba(0,0,0,0.5)' },
  backBtn: { padding: 10, marginLeft: 4 },
  title: { flex: 1, color: '#fff', fontSize: 14, marginLeft: 8 },
  mirrorBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, marginRight: 8 },
  mirrorBtnActive: { backgroundColor: '#f97316' },
  mirrorText: { color: '#fff', fontSize: 12 },
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bigPlay: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  bottomBar: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomBarFs: { paddingHorizontal: 20, paddingBottom: 16 },
  progressWrap: { height: 24, justifyContent: 'center', marginBottom: 2 },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1.5, overflow: 'hidden' },
  progressBuf: { position: 'absolute', height: '100%', backgroundColor: 'rgba(255,255,255,0.5)' },
  progressFill: { position: 'absolute', height: '100%', backgroundColor: '#f97316' },
  thumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#f97316', marginLeft: -7, top: 5 },
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  time: { color: '#fff', fontSize: 11, marginLeft: 4 },
  spacer: { flex: 1 },
  speedText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  menuOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20, zIndex: 20 },
  menu: { backgroundColor: 'rgba(30,30,30,0.95)', borderRadius: 10, padding: 8 },
  menuItem: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6 },
  menuItemActive: { backgroundColor: '#f97316' },
  menuText: { color: '#fff', fontSize: 13, textAlign: 'center' },
  menuTextActive: { fontWeight: '600' },
});

export default VideoPlayer;
