import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Lock, Eye, EyeOff } from 'lucide-react';

const PasswordInput = ({
  value,
  onChange,
  placeholder = 'Password',
  required = true,
  className = '',
  id,
  autoComplete = 'current-password',
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative group ${className}`}>
      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary z-10 pointer-events-none" />
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="pl-12 pr-12 h-14 rounded-2xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/20 text-lg transition-all"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
        aria-label={visible ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
};

export default PasswordInput;
