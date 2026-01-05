/**
 * Login Page - 内嵌登录表单
 * 
 * 直接调用 SSO 的 /api/auth/login 接口进行登录
 * 
 * Requirements: 1.1, 1.2
 */

import { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TextInput,
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/authStore';

// SSO 服务地址
const SSO_BASE_URL = 'https://auth.funk-and.love';
// LockCloud 后端地址
const LOCKCLOUD_API_URL = 'https://cloud.funk-and.love';

export default function LoginPage() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isAuthenticated, setUser, setToken } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, redirect to main app
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('提示', '请输入邮箱');
      return;
    }
    if (!password) {
      Alert.alert('提示', '请输入密码');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: 调用 SSO 登录获取 SSO token
      const ssoResponse = await fetch(`${SSO_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const ssoData = await ssoResponse.json();

      if (!ssoResponse.ok || !ssoData.success) {
        Alert.alert('登录失败', ssoData.message || '邮箱或密码错误');
        return;
      }

      const ssoToken = ssoData.token;

      // Step 2: 用 SSO token 换取 LockCloud token
      const lockcloudResponse = await fetch(`${LOCKCLOUD_API_URL}/api/auth/sso/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: ssoToken,
        }),
      });

      const lockcloudData = await lockcloudResponse.json();

      if (!lockcloudResponse.ok || !lockcloudData.success) {
        Alert.alert('登录失败', lockcloudData.error?.message || '验证失败，请重试');
        return;
      }

      // 登录成功，保存 LockCloud token 和用户信息
      await setToken(lockcloudData.token);
      setUser(lockcloudData.user);
      
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('登录失败', '网络错误，请检查网络连接');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBackground = isDark ? '#1a1a1a' : '#f5f5f5';
  const inputBorder = isDark ? '#333' : '#e0e0e0';
  const textColor = isDark ? '#fff' : '#1a1a1a';
  const placeholderColor = isDark ? '#666' : '#999';

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>
          登录
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#888' : '#666' }]}>
          欢迎回到 LockCloud
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={[
            styles.input,
            { 
              backgroundColor: inputBackground,
              borderColor: inputBorder,
              color: textColor,
            }
          ]}
          placeholder="邮箱"
          placeholderTextColor={placeholderColor}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />

        <TextInput
          style={[
            styles.input,
            { 
              backgroundColor: inputBackground,
              borderColor: inputBorder,
              color: textColor,
            }
          ]}
          placeholder="密码"
          placeholderTextColor={placeholderColor}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          style={[
            styles.loginButton,
            isLoading && styles.loginButtonDisabled,
          ]}
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>登录</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.hint, { color: isDark ? '#666' : '#999' }]}>
          使用 Funk & Love 统一账号登录
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  form: {
    gap: 12,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  loginButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#888888',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
