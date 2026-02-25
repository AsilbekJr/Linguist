import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../features/auth/authSlice';
import { ThemeToggle } from '../ThemeToggle';
import Sidebar from '../Sidebar';
import { LogOut } from 'lucide-react';

const DashboardLayout = () => {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Sidebar (Optional: Keep Sidebar logic clean here or in Sidebar.jsx itself) */}
      <Sidebar user={user} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64 transition-all pb-24 md:pb-0">
        
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center justify-end px-4 md:px-8 gap-4 shadow-sm hidden md:flex">
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{user.name}</span>
              <span className="w-px h-4 bg-border"></span>
              <button 
                onClick={() => dispatch(logout())}
                className="group flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 rounded-lg transition-all duration-300 shadow-sm hover:shadow-red-500/25"
              >
                Chiqish
                <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          )}
          <ThemeToggle />
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 w-full max-w-[1400px] mx-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
