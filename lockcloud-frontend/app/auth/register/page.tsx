'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { zhCN } from '@/locales/zh-CN';
import * as authApi from '@/lib/api/auth';
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

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    code: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Validate ZJU email
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
    
    if (!email.endsWith('@zju.edu.cn')) {
      setErrors(prev => ({ ...prev, email: zhCN.auth.emailMustBeZJU }));
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
    
    if (password.length < 8) {
      setErrors(prev => ({ ...prev, password: zhCN.auth.passwordTooShort }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, password: '' }));
    return true;
  };

  // Validate name
  const validateName = (name: string): boolean => {
    if (!name) {
      setErrors(prev => ({ ...prev, name: zhCN.auth.nameRequired }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, name: '' }));
    return true;
  };

  // Validate verification code
  const validateCode = (code: string): boolean => {
    if (!code) {
      setErrors(prev => ({ ...prev, code: zhCN.auth.codeRequired }));
      return false;
    }
    
    if (!/^\d{6}$/.test(code)) {
      setErrors(prev => ({ ...prev, code: zhCN.auth.codeInvalid }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, code: '' }));
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

  // Send verification code
  const handleSendCode = async () => {
    if (!validateEmail(formData.email)) {
      return;
    }

    setIsSendingCode(true);
    try {
      await authApi.sendCode(formData.email);
      toast.success(zhCN.auth.codeSent);
      setCodeSent(true);
      
      // Start countdown (60 seconds)
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      const message = (error as ApiError).response?.data?.error?.message || zhCN.auth.registerFailed;
      toast.error(message);
    } finally {
      setIsSendingCode(false);
    }
  };

  // Handle registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const isEmailValid = validateEmail(formData.email);
    const isPasswordValid = validatePassword(formData.password);
    const isNameValid = validateName(formData.name);
    const isCodeValid = validateCode(formData.code);

    if (!isEmailValid || !isPasswordValid || !isNameValid || !isCodeValid) {
      return;
    }

    setIsLoading(true);
    try {
      await authApi.register(formData);
      toast.success(zhCN.auth.registerSuccess);
      
      // Redirect to login page
      setTimeout(() => {
        router.push('/auth/login');
      }, 1000);
    } catch (error) {
      const message = (error as ApiError).response?.data?.error?.message || zhCN.auth.registerFailed;
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary-black mb-2">
          {zhCN.auth.register}
        </h1>
        <p className="text-accent-gray">
          {zhCN.auth.emailMustBeZJU}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email input with send code button */}
        <div>
          <Input
            label={zhCN.auth.email}
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder={zhCN.auth.emailPlaceholder}
            error={errors.email}
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="secondary"
            className="mt-2 w-full"
            onClick={handleSendCode}
            disabled={isSendingCode || countdown > 0 || isLoading}
          >
            {countdown > 0
              ? `${zhCN.auth.resendCode} (${countdown}s)`
              : isSendingCode
              ? zhCN.common.loading
              : zhCN.auth.sendCode}
          </Button>
        </div>

        {/* Verification code input */}
        <Input
          label={zhCN.auth.verificationCode}
          type="text"
          name="code"
          value={formData.code}
          onChange={handleChange}
          placeholder={zhCN.auth.codePlaceholder}
          error={errors.code}
          disabled={isLoading}
          maxLength={6}
        />

        {/* Name input */}
        <Input
          label={zhCN.auth.name}
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder={zhCN.auth.namePlaceholder}
          error={errors.name}
          disabled={isLoading}
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
        />

        {/* Submit button */}
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={isLoading || !codeSent}
        >
          {isLoading ? zhCN.common.loading : zhCN.auth.register}
        </Button>
      </form>

      {/* Link to login */}
      <div className="text-center text-sm">
        <span className="text-accent-gray">已有账号？</span>
        {' '}
        <Link
          href="/auth/login"
          className="text-accent-blue hover:underline font-medium"
        >
          {zhCN.auth.login}
        </Link>
      </div>
    </div>
  );
}
