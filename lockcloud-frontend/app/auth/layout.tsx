import { Toaster } from 'react-hot-toast';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-primary-white flex items-center justify-center p-4">
      <Toaster position="top-center" />
      
      {/* Main auth container */}
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <img
              src="https://funkandlove-main.s3.bitiful.net/public/icon.png"
              alt="Funk & Love"
              className="w-20 h-20 mx-auto hand-drawn-card"
            />
          </div>
          <h1 className="text-4xl font-bold text-primary-black mb-2 font-handwritten">
            LockCloud
          </h1>
          <p className="text-lg text-accent-gray">
            Funk & Love 云存储
          </p>
        </div>

        {/* Auth form card with hand-drawn style */}
        <div className="hand-drawn-border bg-primary-white p-8 shadow-lg hand-drawn-card">
          {children}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-sm text-accent-gray">
          <p>浙江大学 DFM Locking 舞队</p>
          <p className="mt-1">建设者：Hofmann</p>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-10 left-10 w-16 h-16 border-2 border-accent-orange rounded-full opacity-20 hand-drawn-border" />
        <div className="absolute bottom-10 right-10 w-20 h-20 border-2 border-accent-green rounded-lg opacity-20 hand-drawn-border transform rotate-12" />
        <div className="absolute top-1/3 right-20 w-12 h-12 border-2 border-accent-blue rounded-full opacity-20 hand-drawn-border" />
      </div>
    </div>
  );
}
