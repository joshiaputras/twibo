import { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import FloatingChat from './FloatingChat';
import { useDynamicFavicon } from '@/hooks/useDynamicFavicon';

const Layout = ({ children }: { children: ReactNode }) => {
  useDynamicFavicon();
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
      <FloatingChat />
    </div>
  );
};

export default Layout;
