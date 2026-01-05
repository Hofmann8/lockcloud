/**
 * Animated Splash Screen Component
 * 
 * Displays a Lottie animation during app startup.
 * Hides the native splash screen after animation completes.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, { FadeOut } from 'react-native-reanimated';

// Keep the native splash screen visible while we load
SplashScreen.preventAutoHideAsync();

interface AnimatedSplashScreenProps {
  children: React.ReactNode;
  isReady: boolean;
}

export function AnimatedSplashScreen({ children, isReady }: AnimatedSplashScreenProps) {
  const [animationFinished, setAnimationFinished] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Hide native splash screen when component mounts
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Handle animation completion
  const onAnimationFinish = useCallback(() => {
    setAnimationFinished(true);
  }, []);

  // Hide splash when both animation finished and app is ready
  useEffect(() => {
    if (animationFinished && isReady) {
      // Small delay for smooth transition
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [animationFinished, isReady]);

  return (
    <View style={styles.container}>
      {children}
      
      {showSplash && (
        <Animated.View
          style={styles.splashContainer}
          exiting={FadeOut.duration(300)}
        >
          <LottieView
            source={require('@/assets/animations/splash-animation.json')}
            autoPlay
            loop={false}
            onAnimationFinish={onAnimationFinish}
            style={styles.animation}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: 200,
    height: 200,
  },
});

export default AnimatedSplashScreen;
