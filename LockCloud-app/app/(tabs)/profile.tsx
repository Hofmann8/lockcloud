/**
 * Profile Tab Screen (我的)
 * 
 * Displays user profile information and settings.
 * Provides logout functionality.
 * 
 * Requirements: 1.5, 12.2
 */

import { StyleSheet, View, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      '确认退出',
      '确定要退出登录吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (!isAuthenticated || !user) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <ThemedText style={styles.subtitle}>请先登录</ThemedText>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <ThemedText style={styles.loginButtonText}>去登录</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>
              {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
            </ThemedText>
          </View>
        </View>
        
        <ThemedText type="title" style={styles.userName}>{user.name || '用户'}</ThemedText>
        <ThemedText style={styles.userEmail}>{user.email}</ThemedText>
        
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>角色</ThemedText>
            <ThemedText style={styles.infoValue}>{user.role || '普通用户'}</ThemedText>
          </View>
          {user.is_admin && (
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>权限</ThemedText>
              <ThemedText style={styles.infoValue}>管理员</ThemedText>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <ThemedText style={styles.logoutButtonText}>退出登录</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    marginBottom: 4,
  },
  userEmail: {
    opacity: 0.6,
    marginBottom: 24,
  },
  infoSection: {
    width: '100%',
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.3)',
  },
  infoLabel: {
    opacity: 0.6,
  },
  infoValue: {
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 32,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  subtitle: {
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
