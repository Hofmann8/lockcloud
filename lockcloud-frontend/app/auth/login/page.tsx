'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { zhCN } from '@/locales/zh-CN';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface ApiError {
  response?: {
    data?: {
      error?: {
        message?: string;
      };
    };
  };
}

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore(state => state.login);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Validate email
  const validateEmail = (email: string): boolean => {
    if (!email) {
      setErrors(prev => ({ ...prev, email: zhCN.auth.emailRequired }));
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrors(prev => ({ ...prev, email: zhCN.auth.emailInvalid }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, email: '' }));
    return true;
  };

  // Validate password
  const validatePassword = (password: string): boolean => {
    if (!password) {
      setErrors(prev => ({ ...prev, password: zhCN.auth.passwordRequired }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, password: '' }));
    return true;
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const isEmailValid = validateEmail(formData.email);
    const isPasswordValid = validatePassword(formData.password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setIsLoading(true);
    try {
      await login(formData.email, formData.password);
      toast.success(zhCN.auth.loginSuccess);
      
      // Redirect to files page
      setTimeout(() => {
        router.push('/files');
      }, 500);
    } catch (error) {
      const message = (error as ApiError).response?.data?.error?.message || zhCN.auth.loginFailed;
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary-black mb-2">
          {zhCN.auth.login}
        </h1>
        <p className="text-accent-gray">
          欢迎回到 LockCloud
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email input */}
        <Input
          label={zhCN.auth.email}
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder={zhCN.auth.emailPlaceholder}
          error={errors.email}
          disabled={isLoading}
          autoComplete="email"
        />

        {/* Password input */}
        <Input
          label={zhCN.auth.password}
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder={zhCN.auth.passwordPlaceholder}
          error={errors.password}
          disabled={isLoading}
          autoComplete="current-password"
        />

        {/* Submit button */}
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? zhCN.common.loading : zhCN.auth.login}
        </Button>
      </form>

      {/* Link to register */}
      <div className="text-center text-sm">
        <span className="text-accent-gray">还没有账号？</span>
        {' '}
        <Link
          href="/auth/register"
          className="text-accent-blue hover:underline font-medium"
        >
          {zhCN.auth.register}
        </Link>
      </div>
    </div>
  );
}
