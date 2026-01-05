/**
 * LoadingAnimation Component
 * 
 * Displays a random emoji GIF for loading states.
 * Uses local assets from assets/loadings/
 */

import { useMemo } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { ThemedText } from './themed-text';

// Import all loading GIFs
const LOADING_GIFS = [
  require('@/assets/loadings/1.gif'),
  require('@/assets/loadings/2.gif'),
  require('@/assets/loadings/3.gif'),
  require('@/assets/loadings/4.gif'),
  require('@/assets/loadings/5.gif'),
  require('@/assets/loadings/6.gif'),
  require('@/assets/loadings/7.gif'),
  require('@/assets/loadings/8.gif'),
  require('@/assets/loadings/9.gif'),
  require('@/assets/loadings/10.gif'),
  require('@/assets/loadings/11.gif'),
  require('@/assets/loadings/12.gif'),
  require('@/assets/loadings/13.gif'),
  require('@/assets/loadings/14.gif'),
  require('@/assets/loadings/15.gif'),
  require('@/assets/loadings/16.gif'),
];

interface LoadingAnimationProps {
  text?: string;
  size?: number;
}

export function LoadingAnimation({ text = '加载中...', size = 100 }: LoadingAnimationProps) {
  // Pick a random GIF on mount
  const gifSource = useMemo(() => {
    const index = Math.floor(Math.random() * LOADING_GIFS.length);
    return LOADING_GIFS[index];
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={gifSource}
        style={[styles.gif, { width: size, height: size }]}
        resizeMode="contain"
      />
      <ThemedText style={styles.text}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  gif: {
    borderRadius: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
  },
});

export default LoadingAnimation;
