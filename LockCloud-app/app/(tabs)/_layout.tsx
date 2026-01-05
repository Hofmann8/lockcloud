import { Tabs, usePathname } from 'expo-router';
import React, { useEffect } from 'react';
import { View, useColorScheme } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SharedHeader } from '@/components/SharedHeader';
import { HeaderProvider } from '@/contexts/HeaderContext';
import { Colors } from '@/constants/theme';
import { useHeaderStore } from '@/stores/headerStore';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const setActiveTab = useHeaderStore((s) => s.setActiveTab);

  // Update active tab when route changes
  useEffect(() => {
    const tab = pathname.replace('/', '') || 'index';
    setActiveTab(tab);
  }, [pathname, setActiveTab]);

  return (
    <HeaderProvider>
      <View style={{ flex: 1 }}>
        <SharedHeader />
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
            tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarStyle: {
              borderTopWidth: 0.5,
              borderTopColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            },
          }}
        >
      <Tabs.Screen
        name="index"
        options={{
          title: '文件',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={28} 
              name={focused ? 'folder.fill' : 'folder'} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: '上传',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={28} 
              name={focused ? 'arrow.up.circle.fill' : 'arrow.up.circle'} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: '请求',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={28} 
              name={focused ? 'bell.fill' : 'bell'} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={28} 
              name={focused ? 'person.fill' : 'person'} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
    </View>
    </HeaderProvider>
  );
}
