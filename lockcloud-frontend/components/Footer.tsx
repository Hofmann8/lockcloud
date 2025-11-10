'use client';

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-600">
          {/* Left: Builder & Copyright */}
          <div className="flex items-center gap-4">
            <span>
              建设者：<span className="font-medium text-orange-500">Hofmann</span>
            </span>
            <span className="hidden sm:inline text-gray-300">|</span>
            <span>© {new Date().getFullYear()} Funk & Love. All rights reserved.</span>
          </div>

          {/* Right: Domain & Notice */}
          <div className="flex items-center gap-4">
            <span className="text-gray-500">仅供内部使用，请合理使用存储空间</span>
            <a
              href="https://cloud.funk-and.love"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-500 hover:text-blue-600 transition-colors"
            >
              cloud.funk-and.love
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
