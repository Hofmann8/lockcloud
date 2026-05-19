const DEFAULT_DEV_API_URL = 'http://localhost:5000';
const DEFAULT_PROD_API_URL = 'https://cloud.funk-and.love';

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const baseUrl =
    configured ||
    (process.env.NODE_ENV === 'production'
      ? DEFAULT_PROD_API_URL
      : DEFAULT_DEV_API_URL);

  return baseUrl.replace(/\/+$/, '');
}

