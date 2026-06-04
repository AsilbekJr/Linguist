import React from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const UpgradeModal = ({ open, onOpenChange, message }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <Sparkles className="w-5 h-5 text-primary" />
            Pro tarifga o\'ting
          </DialogTitle>
          <DialogDescription>
            {message || 'Kunlik AI limiti tugadi. Cheksiz mashq va tezroq o\'rganish uchun Pro tarifni faollashtiring.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button asChild className="rounded-full font-bold">
            <Link to="/pricing" onClick={() => onOpenChange(false)}>
              Tariflarni ko\'rish
            </Link>
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Keyinroq
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
