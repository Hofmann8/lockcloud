import Ionicons from '@expo/vector-icons/Ionicons';
import Animated from 'react-native-reanimated';

export function HelloWave() {
  return (
    <Animated.View
      style={{
        marginTop: -6,
        animationName: {
          '50%': { transform: [{ rotate: '25deg' }] },
        },
        animationIterationCount: 4,
        animationDuration: '300ms',
      }}>
      <Ionicons name="hand-left" size={28} color="#f97316" />
    </Animated.View>
  );
}
