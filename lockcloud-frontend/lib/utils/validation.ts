/**
 * Validate file naming convention: YYYY-MM-activity_uploader_index.ext
 */
export function isValidFileName(filename: string): boolean {
  const fileNameRegex = /^\d{4}-\d{2}-[a-zA-Z0-9-]+_[a-zA-Z0-9]+_\d{2}\.[a-zA-Z0-9]+$/;
  return fileNameRegex.test(filename);
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
