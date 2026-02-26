import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, CheckCircle, Book, Mic, LogOut, Home, Flame, BookHeart } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useDispatch } from 'react-redux';
import { logout } from '../features/auth/authSlice';

const Sidebar = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logout());
  };

  const navItems = [
    { id: '/', label: 'Asosiy', icon: Home },
    { id: '/review', label: 'Takrorlash', icon: CheckCircle },
    { id: '/challenge', label: '100 Days 🎯', icon: Flame },
    { id: '/topic', label: 'Daily Topics', icon: BookHeart },
    { id: '/movie-lab', label: 'Movie Lab 🎬', icon: Mic },
    { id: '/speaking', label: 'Speaking Lab', icon: Mic },
    { id: '/roleplay', label: 'Immersion', icon: Mic }, // Kept same icon or can use user-supplied
    { id: '/vocabulary', label: 'Mening Lug\'atim', icon: Book },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="mb-8 hidden md:block px-4">
        <h2 className="text-2xl font-black bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
          Linguist AI
        </h2>
      </div>
      
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.id}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm",
              isActive 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            end={item.id === '/'}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-border">
        {user && (
          <div className="mb-4 px-4">
            <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full group flex items-center justify-center gap-3 px-4 py-3.5 text-sm font-bold text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 rounded-xl transition-all duration-300 shadow-sm hover:shadow-red-500/25 mt-2"
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          Chiqish
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-md border-b border-border z-50 flex items-center px-4 justify-between">
        <div className="flex items-center">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="border-border hover:bg-secondary shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menyu</span>
              </Button>
            </SheetTrigger>
            
            <SheetContent side="left" className="w-[280px] p-6 bg-background border-r border-border">
              <SheetHeader className="mb-6 absolute left-6 top-6">
                <SheetTitle className="sr-only">Menyu</SheetTitle>
              </SheetHeader>
              <div className="mt-8 h-[calc(100vh-8rem)]">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>
          <div className="ml-4 font-black flex items-center text-lg bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Linguist AI
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 z-50 bg-card border-r border-border p-6 shadow-sm overflow-y-auto">
         <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
