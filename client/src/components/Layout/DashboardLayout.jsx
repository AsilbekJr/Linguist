import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../features/auth/authSlice';
import { ThemeToggle } from '../ThemeToggle';
import Sidebar from '../Sidebar';
import { LogOut, ChevronDown } from 'lucide-react';

const DashboardLayout = () => {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Sidebar (Optional: Keep Sidebar logic clean here or in Sidebar.jsx itself) */}
      <Sidebar user={user} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64 transition-all pb-24 md:pb-0">
        
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center justify-end px-4 md:px-8 gap-4 shadow-sm hidden md:flex">
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 hover:bg-secondary px-2 py-1.5 rounded-full transition-colors focus:outline-none"
              >
                 <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                 </div>
                 <span className="text-sm font-bold text-foreground max-w-[100px] truncate">{user.name}</span>
                 <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                 <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-lg py-2 animate-in fade-in slide-in-from-top-2 z-50">
                    <div className="px-4 py-3 border-b border-border mb-2">
                       <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                       <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <button 
                      onClick={() => {
                          dispatch(logout());
                          setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <span>Chiqish</span>
                      <LogOut className="w-4 h-4" />
                    </button>
                 </div>
              )}
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
