/**
 * Authentication Layout
 * 
 * Layout container for authentication-related pages (login, callback).
 * Provides consistent styling and structure for auth screens.
 * 
 * Requirements: 1.1
 */

import { Stack } from 'expo-router';
import { View, StyleSheet, Image, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView 
      style={[
        styles.container, 
        { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }
      ]}
    >
      <View style={styles.content}>
        {/* Logo and branding */}
        <View style={styles.header}>
          <Image
            source={{ uri: 'https://funkandlove-main.s3.bitiful.net/public/icon.png' }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: isDark ? '#ffffff' : '#1a1a1a' }]}>
            LockCloud
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#888888' : '#666666' }]}>
            Funk & Love 云存储
          </Text>
        </View>

        {/* Auth form container */}
        <View 
          style={[
            styles.formContainer, 
            { 
              backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
              borderColor: isDark ? '#3a3a3a' : '#e0e0e0',
            }
          ]}
        >
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent', flex: 1 },
              animation: 'fade',
            }}
          />
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: isDark ? '#666666' : '#999999' }]}>
            浙江大学 DFM Locking 舞队
          </Text>
          <Text style={[styles.footerText, { color: isDark ? '#666666' : '#999999' }]}>
            建设者：Hofmann
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  formContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    minHeight: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 12,
    marginTop: 4,
  },
});
