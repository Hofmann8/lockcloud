/**
 * Responsive Image Loading Utilities
 * 
 * Provides functions for calculating optimal image sizes and building S3 URLs
 * with image processing parameters to reduce bandwidth usage.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

export interface ImageSizeOptions {
  width: number;
  quality: number;
}

export interface ImageUrlOptions {
  width?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
}

/**
 * Calculate optimal image size based on device screen width and pixel density
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 * 
 * @returns Object containing optimal width and quality parameters
 */
export function getOptimalImageSize(): ImageSizeOptions {
  // Default values for SSR or when window is not available
  if (typeof window === 'undefined') {
    return {
      width: 1200,
      quality: 85,
    };
  }

  const screenWidth = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;

  // Mobile devices (< 768px)
  if (screenWidth < 768) {
    return {
      width: Math.min(800, Math.round(screenWidth * dpr)),
      quality: 80,
    };
  }

  // Tablet devices (768px - 1024px)
  if (screenWidth < 1024) {
    return {
      width: Math.min(1200, Math.round(screenWidth * dpr)),
      quality: 85,
    };
  }

  // Desktop devices (>= 1024px)
  return {
    width: Math.min(1920, Math.round(screenWidth * dpr)),
    quality: 90,
  };
}

/**
 * Detect browser support for modern image formats
 * 
 * @returns The best supported image format
 */
function detectBestImageFormat(): 'webp' | 'avif' | 'jpeg' {
  if (typeof window === 'undefined') {
    return 'jpeg';
  }

  // Check for AVIF support
  const avifSupport = document.createElement('canvas').toDataURL('image/avif').indexOf('data:image/avif') === 0;
  if (avifSupport) {
    return 'avif';
  }

  // Check for WebP support
  const webpSupport = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0;
  if (webpSupport) {
    return 'webp';
  }

  return 'jpeg';
}

/**
 * Build S3 image URL with processing parameters
 * 
 * Supports Bitiful S3 image processing parameters for resizing and quality adjustment.
 * Also supports format conversion to WebP and AVIF for better compression.
 * 
 * Requirements: 7.2, 7.3, 7.4, 7.5
 * 
 * @param s3Key - The S3 object key
 * @param options - Optional image processing parameters
 * @returns Complete S3 URL with processing parameters
 */
export function buildS3ImageUrl(s3Key: string, options?: ImageUrlOptions): string {
  const baseUrl = process.env.NEXT_PUBLIC_S3_BASE_URL || 'https://funkandlove-cloud2.s3.bitiful.net';
  
  // If no options provided, return base URL
  if (!options || (!options.width && !options.quality && !options.format)) {
    return `${baseUrl}/${s3Key}`;
  }

  // Build image processing parameters
  const params: string[] = [];

  // Add resize parameter
  if (options.width) {
    params.push(`image/resize,w_${options.width}`);
  }

  // Add quality parameter
  if (options.quality) {
    params.push(`image/quality,q_${options.quality}`);
  }

  // Add format conversion parameter
  if (options.format) {
    params.push(`image/format,${options.format}`);
  }

  // Combine parameters with x-oss-process
  const processParam = params.length > 0 ? `x-oss-process=${params.join('/')}` : '';
  
  return processParam ? `${baseUrl}/${s3Key}?${processParam}` : `${baseUrl}/${s3Key}`;
}

/**
 * Build optimized S3 image URL with automatic format detection and optimal sizing
 * 
 * This is a convenience function that combines getOptimalImageSize and buildS3ImageUrl
 * with automatic format detection.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 * 
 * @param s3Key - The S3 object key
 * @param customOptions - Optional custom overrides for width, quality, or format
 * @returns Optimized S3 URL
 */
export function buildOptimizedImageUrl(
  s3Key: string,
  customOptions?: Partial<ImageUrlOptions>
): string {
  const optimalSize = getOptimalImageSize();
  const bestFormat = detectBestImageFormat();

  const options: ImageUrlOptions = {
    width: customOptions?.width ?? optimalSize.width,
    quality: customOptions?.quality ?? optimalSize.quality,
    format: customOptions?.format ?? bestFormat,
  };

  return buildS3ImageUrl(s3Key, options);
}
