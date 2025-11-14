'use client';

/**
 * Mobile Menu Button Component
 * 
 * A reusable button for opening the sidebar on mobile devices.
 * Hidden on desktop (lg breakpoint and above).
 */
export function MobileMenuButton() {
  const handleClick = () => {
    const event = new CustomEvent('openSidebar');
    window.dispatchEvent(event);
  };

  return (
    <button
      onClick={handleClick}
      className="lg:hidden p-2 rounded-lg border border-accent-gray/30 hover:bg-accent-gray/10 transition-colors flex items-center justify-center"
      aria-label="打开目录"
    >
      <svg 
        className="w-5 h-5 text-primary-black" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M4 6h16M4 12h16M4 18h16" 
        />
      </svg>
    </button>
  );
}
