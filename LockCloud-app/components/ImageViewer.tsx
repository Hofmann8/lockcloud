/**
 * ImageViewer Component
 * 
 * Full-screen image viewer with pinch-to-zoom and pan support.
 * Uses react-native-gesture-handler and react-native-reanimated for smooth gestures.
 * 
 * Features:
 * - Full-screen display
 * - Pinch-to-zoom (1x to 4x)
 * - Pan/drag when zoomed
 * - Double-tap to zoom in/out
 * - Loading state with spinner
 * - Error handling with retry
 * 
 * Requirements: 4.2
 */

import { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  useColorScheme,
} from 'react-native';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/Icon';

// S3 base URL for images
const S3_BASE_URL = process.env.EXPO_PUBLIC_S3_BASE_URL || 'https://funkandlove-cloud2.s3.bitiful.net';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Zoom constraints
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

interface ImageViewerProps {
  /** S3 key for the image */
  s3Key: string;
  /** Alt text for accessibility */
  alt: string;
  /** Optional callback when close is requested */
  onClose?: () => void;
}

/**
 * ImageViewer - Full-screen image viewer with zoom and pan
 * 
 * Requirements: 4.2
 */
export function ImageViewer({ s3Key, alt, onClose }: ImageViewerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Animated values for zoom and pan
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Build optimized image URL
  const imageUrl = useMemo(() => {
    if (!s3Key) return null;
    // Use higher resolution for detail view
    return `${S3_BASE_URL}/${s3Key}?w=1200`;
  }, [s3Key]);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  // Handle image error
  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setRetryCount((prev) => prev + 1);
  }, []);

  // Clamp translation to keep image in bounds
  const clampTranslation = (
    tx: number,
    ty: number,
    currentScale: number
  ) => {
    'worklet';
    const maxTranslateX = Math.max(0, (SCREEN_WIDTH * currentScale - SCREEN_WIDTH) / 2);
    const maxTranslateY = Math.max(0, (SCREEN_HEIGHT * currentScale - SCREEN_HEIGHT) / 2);
    
    return {
      x: Math.min(Math.max(tx, -maxTranslateX), maxTranslateX),
      y: Math.min(Math.max(ty, -maxTranslateY), maxTranslateY),
    };
  };

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = Math.min(Math.max(savedScale.value * event.scale, MIN_SCALE), MAX_SCALE);
      scale.value = newScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      
      // Reset if zoomed out too much
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        savedScale.value = MIN_SCALE;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        const clamped = clampTranslation(
          savedTranslateX.value + event.translationX,
          savedTranslateY.value + event.translationY,
          scale.value
        );
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double tap gesture for quick zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to tap location
        const targetScale = DOUBLE_TAP_SCALE;
        scale.value = withSpring(targetScale);
        savedScale.value = targetScale;
        
        // Calculate offset to center on tap point
        const offsetX = (SCREEN_WIDTH / 2 - event.x) * (targetScale - 1);
        const offsetY = (SCREEN_HEIGHT / 2 - event.y) * (targetScale - 1);
        
        const clamped = clampTranslation(offsetX, offsetY, targetScale);
        translateX.value = withSpring(clamped.x);
        translateY.value = withSpring(clamped.y);
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
      }
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  // Animated style for the image
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const backgroundColor = colorScheme === 'dark' ? '#000' : '#000';
  const textColor = colorScheme === 'dark' ? '#fff' : '#fff';

  // Error state
  if (hasError) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.errorContainer}>
          <Icon name="warning" size={48} color="#f97316" />
          <ThemedText style={[styles.errorTitle, { color: textColor }]}>
            图片加载失败
          </ThemedText>
          <ThemedText style={[styles.errorMessage, { color: 'rgba(255,255,255,0.7)' }]}>
            无法加载图片 &quot;{alt}&quot;
          </ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <ThemedText style={styles.retryButtonText}>重试</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor }]}>
      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <ThemedText style={[styles.loadingText, { color: 'rgba(255,255,255,0.7)' }]}>
            加载图片中...
          </ThemedText>
        </View>
      )}

      {/* Image with gestures */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.imageContainer, animatedStyle]}>
          {imageUrl && (
            <Image
              key={`${imageUrl}-${retryCount}`}
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}
        </Animated.View>
      </GestureDetector>

      {/* Zoom hint */}
      {!isLoading && !hasError && (
        <View style={styles.hintContainer}>
          <ThemedText style={styles.hintText}>
            双击放大 · 捏合缩放
          </ThemedText>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#f97316',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
});

export default ImageViewer;
