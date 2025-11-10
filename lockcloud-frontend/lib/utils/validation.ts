/**
 * Validate ZJU email format
 */
export function isZJUEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@zju\.edu\.cn$/;
  return emailRegex.test(email);
}

/**
 * Validate file naming convention: YYYY-MM-activity_uploader_index.ext
 */
export function isValidFileName(filename: string): boolean {
  const fileNameRegex = /^\d{4}-\d{2}-[a-zA-Z0-9-]+_[a-zA-Z0-9]+_\d{2}\.[a-zA-Z0-9]+$/;
  return fileNameRegex.test(filename);
}

/**
 * Validate verification code (6 digits)
 */
export function isValidVerificationCode(code: string): boolean {
  const codeRegex = /^\d{6}$/;
  return codeRegex.test(code);
}

/**
 * Validate password strength (minimum 8 characters)
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * Parse file name to extract components
 */
export function parseFileName(filename: string): {
  year: string;
  month: string;
  activity: string;
  uploader: string;
  index: string;
  extension: string;
} | null {
  const match = filename.match(/^(\d{4})-(\d{2})-([a-zA-Z0-9-]+)_([a-zA-Z0-9]+)_(\d{2})\.([a-zA-Z0-9]+)$/);
  
  if (!match) return null;
  
  return {
    year: match[1],
    month: match[2],
    activity: match[3],
    uploader: match[4],
    index: match[5],
    extension: match[6],
  };
}
