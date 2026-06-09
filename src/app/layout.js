// src/app/layout.js
import ErudaLoader from '@/components/ErudaLoader';

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="/live2dcubismcore.min.js" async crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <ErudaLoader />}
      </body>
    </html>
  );
}