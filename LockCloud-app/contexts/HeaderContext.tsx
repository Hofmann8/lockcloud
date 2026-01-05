/**
 * Header Context
 * 
 * Provides shared animated values for header animations.
 * This allows the header to animate on the UI thread without JS involvement.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

interface HeaderContextType {
  scrollY: SharedValue<number>;
}

const HeaderContext = createContext<HeaderContextType | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const scrollY = useSharedValue(0);
  
  return (
    <HeaderContext.Provider value={{ scrollY }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeaderContext() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeaderContext must be used within HeaderProvider');
  }
  return context;
}
