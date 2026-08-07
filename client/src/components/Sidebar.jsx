import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Home, Book, LogOut, Flame, BarChart3, CreditCard, BookHeart, Brain, GraduationCap, PenLine, MessageCircle, AudioLines, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useDispatch } from 'react-redux';
import { performLogout } from '../utils/authHelpers';

const Sidebar = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dispatch = useDispatch();

  const handleLogout = () => performLogout(dispatch);

  const primaryNav = [
    { id: '/', label: 'Bugun', icon: Home },
    { id: '/vocabulary', label: 'Lug\'at', icon: Book },
  ];

  const practiceNav = [
    { id: '/review', label: 'Takrorlash', icon: Brain },
    { id: '/topic', label: 'Kunlik sahna', icon: BookHeart },
    { id: '/listening', label: 'Tinglash', icon: Headphones },
    { id: '/practice', label: 'Amaliyot', icon: PenLine },
    { id: '/tutor', label: 'Ustoz AI', icon: GraduationCap },
    { id: '/roleplay', label: 'AI suhbat', icon: MessageCircle },
    { id: '/speaking', label: 'Speaking Lab', icon: AudioLines },
    { id: '/challenge', label: '100 kun', icon: Flame },
  ];

  const accountNav = [
    { id: '/analytics', label: 'Progress', icon: BarChart3 },
    { id: '/pricing', label: 'Tariflar', icon: CreditCard },
  ];

  const NavGroup = ({ title, items }) => (
    <div className="mb-4">
      {title && <p className="px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>}
      <div className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.id}
            to={item.id}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-sm",
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
      </div>
    </div>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="mb-6 hidden md:block px-4">
        <h2 className="text-2xl font-black bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
          Linguist AI
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto">
        <NavGroup items={primaryNav} />
        <NavGroup title="Mashq" items={practiceNav} />
        <NavGroup title="Hisob" items={accountNav} />
      </nav>

      <div className="mt-auto pt-6 border-t border-border">
        {user && (
          <div className="mb-4 px-4">
            <p className="text-sm font-bold truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-xl"
        >
          <LogOut className="w-5 h-5" />
          Chiqish
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-md border-b border-border z-50 flex items-center px-4 justify-between">
        <div className="flex items-center">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-4 bg-background">
              <SheetHeader><SheetTitle className="sr-only">Menyu</SheetTitle></SheetHeader>
              <div className="mt-8 h-[calc(100vh-8rem)]"><SidebarContent /></div>
            </SheetContent>
          </Sheet>
          <span className="ml-4 font-black text-lg bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Linguist AI
          </span>
        </div>
        <ThemeToggle />
      </div>

      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 z-50 bg-card border-r border-border p-4 lg:p-6 shadow-sm overflow-y-auto">
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
