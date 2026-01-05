/**
 * useHaptics - Hook for haptic feedback on important actions
 * 
 * Requirements: 12.6 - Use haptic feedback for important actions
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Haptic feedback types for different interactions
 */
export type HapticFeedbackType =
  | 'light'      // Light tap - for subtle interactions
  | 'medium'     // Medium tap - for standard interactions
  | 'heavy'      // Heavy tap - for significant actions
  | 'success'    // Success notification
  | 'warning'    // Warning notification
  | 'error'      // Error notification
  | 'selection'; // Selection change

/**
 * Hook for triggering haptic feedback
 * 
 * @returns Object with haptic feedback functions
 */
export function useHaptics() {
  /**
   * Trigger haptic feedback based on type
   */
  const trigger = useCallback(async (type: HapticFeedbackType = 'light') => {
    // Haptics only work on native platforms
    if (Platform.OS === 'web') {
      return;
    }

    try {
      switch (type) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'selection':
          await Haptics.selectionAsync();
          break;
        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      // Silently fail if haptics are not available
      console.debug('Haptic feedback not available:', error);
    }
  }, []);

  /**
   * Light impact feedback - for subtle interactions
   * Use for: tab switches, minor selections, hover states
   */
  const lightImpact = useCallback(async () => {
    await trigger('light');
  }, [trigger]);

  /**
   * Medium impact feedback - for standard interactions
   * Use for: button presses, toggles, standard actions
   */
  const mediumImpact = useCallback(async () => {
    await trigger('medium');
  }, [trigger]);

  /**
   * Heavy impact feedback - for significant actions
   * Use for: important confirmations, drag-and-drop, long press
   */
  const heavyImpact = useCallback(async () => {
    await trigger('heavy');
  }, [trigger]);

  /**
   * Success notification feedback
   * Use for: successful operations, completed uploads, saved changes
   */
  const success = useCallback(async () => {
    await trigger('success');
  }, [trigger]);

  /**
   * Warning notification feedback
   * Use for: warnings, confirmations needed, attention required
   */
  const warning = useCallback(async () => {
    await trigger('warning');
  }, [trigger]);

  /**
   * Error notification feedback
   * Use for: errors, failed operations, validation failures
   */
  const error = useCallback(async () => {
    await trigger('error');
  }, [trigger]);

  /**
   * Selection change feedback
   * Use for: picker changes, checkbox toggles, selection changes
   */
  const selection = useCallback(async () => {
    await trigger('selection');
  }, [trigger]);

  return {
    trigger,
    lightImpact,
    mediumImpact,
    heavyImpact,
    success,
    warning,
    error,
    selection,
  };
}

/**
 * Standalone haptic functions for use outside of React components
 */
export const haptics = {
  /**
   * Trigger light impact feedback
   */
  light: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Silently fail
    }
  },

  /**
   * Trigger medium impact feedback
   */
  medium: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      // Silently fail
    }
  },

  /**
   * Trigger heavy impact feedback
   */
  heavy: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e) {
      // Silently fail
    }
  },

  /**
   * Trigger success notification feedback
   */
  success: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      // Silently fail
    }
  },

  /**
   * Trigger warning notification feedback
   */
  warning: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (e) {
      // Silently fail
    }
  },

  /**
   * Trigger error notification feedback
   */
  error: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (e) {
      // Silently fail
    }
  },

  /**
   * Trigger selection change feedback
   */
  selection: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.selectionAsync();
    } catch (e) {
      // Silently fail
    }
  },
};

export default useHaptics;
