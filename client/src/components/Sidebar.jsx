import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Home, BookOpen, Library, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const Sidebar = ({ activeTab, onTabChange }) => {
  const [open, setOpen] = useState(false);

  const menuItems = [
    { id: 'word-lab', label: 'Word Lab', icon: Home },
    { id: 'story-mode', label: 'Story Mode', icon: BookOpen },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'review', label: 'Review', icon: CheckCircle },
  ];

  return (
    <div className="md:hidden fixed top-4 left-4 z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-md border-primary/20 hover:bg-primary/20">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[80%] max-w-[300px] bg-background/95 backdrop-blur-xl border-r-primary/20">
          <SheetHeader className="mb-8">
            <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent text-left pl-4">
              Linguist AI
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            {menuItems.map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "secondary" : "ghost"}
                className={cn(
                  "justify-start gap-4 text-lg h-12 font-normal pl-4",
                  activeTab === item.id && "bg-primary/10 text-primary font-medium"
                )}
                onClick={() => {
                  onTabChange(item.id);
                  setOpen(false);
                }}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Sidebar;
