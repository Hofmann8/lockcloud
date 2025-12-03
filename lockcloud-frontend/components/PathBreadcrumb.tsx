'use client';

import { useRouter } from 'next/navigation';

interface PathBreadcrumbProps {
  activityType?: string;
  activityTypeDisplay?: string;
  activityDate?: string; // Format: YYYY-MM-DD
  filename?: string;
  className?: string;
}

export function PathBreadcrumb({
  activityDate,
  filename,
  className = '',
}: PathBreadcrumbProps) {
  const router = useRouter();

  // Parse year and month from activity_date
  const year = activityDate ? activityDate.split('-')[0] : null;
  const month = activityDate ? activityDate.split('-')[1] : null;

  // Build path segments - new structure: year/month only
  const segments: Array<{
    label: string;
    isActive: boolean;
    onClick?: () => void;
  }> = [];

  // Year segment
  if (year) {
    segments.push({
      label: `${year}年`,
      isActive: false,
      onClick: () => {
        router.push(`/files?year=${year}`);
      },
    });
  }

  // Month segment
  if (month && year) {
    segments.push({
      label: `${parseInt(month)}月`,
      isActive: false,
      onClick: () => {
        router.push(`/files?year=${year}&month=${parseInt(month)}`);
      },
    });
  }

  // Filename segment (current page, not clickable)
  if (filename) {
    segments.push({
      label: filename,
      isActive: true,
    });
  }

  // If no segments, don't render anything
  if (segments.length === 0) {
    return null;
  }

  return (
    <nav
      className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm overflow-x-auto scrollbar-hide pb-2 ${className}`}
      aria-label="文件路径导航"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <ol className="flex items-center gap-1.5 sm:gap-2 list-none m-0 p-0">
        {segments.map((segment, index) => (
          <li key={index} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {segment.onClick ? (
              <button
                onClick={segment.onClick}
                className="text-accent-blue hover:text-accent-blue/80 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2 rounded px-1 transition-colors font-medium truncate max-w-[120px] sm:max-w-[180px] md:max-w-[250px] lg:max-w-none touch-manipulation"
                title={segment.label}
                aria-label={`导航到 ${segment.label}`}
              >
                {segment.label}
              </button>
            ) : (
              <span
                className={`font-medium truncate max-w-[120px] sm:max-w-[180px] md:max-w-[250px] lg:max-w-none ${
                  segment.isActive ? 'text-primary-black' : 'text-accent-gray'
                }`}
                title={segment.label}
                aria-current={segment.isActive ? 'page' : undefined}
              >
                {segment.label}
              </span>
            )}
            
            {/* Separator */}
            {index < segments.length - 1 && (
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4 text-accent-gray shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
