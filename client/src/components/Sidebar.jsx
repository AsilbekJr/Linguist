import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, CheckCircle, Book, Mic, GraduationCap, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useDispatch } from 'react-redux';
import { logout } from '../features/auth/authSlice';

const Sidebar = ({ activeTab, onTabChange, user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logout());
  };

  const navItems = [
    { id: 'review-mode', label: 'Review', icon: CheckCircle },
    { id: 'dictionary', label: 'Dictionary', icon: Book },
    { id: 'speaking-lab', label: 'Speaking Lab', icon: Mic },
    { id: 'roleplay', label: 'Immersion', icon: Mic },
    { id: 'challenge-mode', label: '100 Days 🎯', icon: CheckCircle }, // Reused CheckCircle 
  ];

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-md border-b border-border z-50 flex items-center px-4 justify-between">
      <div className="flex items-center">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="border-primary/20 hover:bg-primary/20 shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <div className="ml-4 font-black flex items-center text-lg bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Linguist AI-Flow
          </div>
          <SheetContent side="left" className="w-[80%] max-w-[300px] bg-background/95 backdrop-blur-xl border-r-primary/20">
          <SheetHeader className="mb-8">
            <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent text-left pl-4">
              Linguist AI
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "secondary" : "ghost"}
                className={`w-full justify-start text-left font-medium ${activeTab === item.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent hover:text-accent-foreground'}`}
                onClick={() => {
                  onTabChange(item.id);
                  setIsOpen(false);
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            ))}
            
            <div className="mt-8 pt-4 border-t">
               {user && (
                 <div className="mb-4 px-2">
                    <p className="text-sm font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                 </div>
               )}
               <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={handleLogout}
               >
                 <LogOut className="mr-2 h-4 w-4" />
                 Dasturdan chiqish
               </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      </div>
      <ThemeToggle />
    </div>
  );
};

export default Sidebar;
