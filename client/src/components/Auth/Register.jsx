import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useRegisterMutation } from '../../features/api/apiSlice';
import { setCredentials } from '../../features/auth/authSlice';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, User, Lock, Mail } from "lucide-react";

const Register = ({ onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const dispatch = useDispatch();
  const [register, { isLoading }] = useRegisterMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const userData = await register({ name, email, password }).unwrap();
      dispatch(setCredentials({ user: userData, token: userData.token }));
    } catch (err) {
      console.error("Register Failed:", err);
      setErrorMsg(err?.data?.message || 'Registration failed.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-card p-8 rounded-3xl border shadow-xl relative overflow-hidden z-10 transition-all">
       <div className="text-center mb-8">
            <h2 className="text-3xl font-black bg-gradient-to-r from-primary via-emerald-500 to-teal-500 bg-clip-text text-transparent mb-2">Create Account</h2>
            <p className="text-muted-foreground">Start your language mastery journey</p>
       </div>

       {errorMsg && (
            <div className="bg-destructive/10 text-destructive text-sm font-bold p-3 rounded-xl text-center mb-6 border border-destructive/20 animate-in fade-in slide-in-from-top-2">
                {errorMsg}
            </div>
       )}

       <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative z-10">
          <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input 
                type="text" 
                placeholder="Full Name" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-12 h-14 rounded-2xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/20 text-lg transition-all"
              />
          </div>

          <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input 
                type="email" 
                placeholder="Email Address" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-12 h-14 rounded-2xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/20 text-lg transition-all"
              />
          </div>
          
          <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input 
                type="password" 
                placeholder="Password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-12 h-14 rounded-2xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/20 text-lg transition-all"
              />
          </div>

          <Button 
            type="submit" 
            disabled={isLoading}
            className="h-14 mt-4 rounded-2xl text-lg font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 transition-all group overflow-hidden relative"
          >
             {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-white" /> : 'Create Account'}
          </Button>
       </form>

       <div className="mt-8 text-center text-muted-foreground relative z-10 text-sm">
           Already have an account?{' '}
           <button 
             type="button" 
             onClick={onSwitchToLogin}
             className="text-primary font-bold hover:underline"
           >
               Log in here
           </button>
       </div>
    </div>
  );
};

export default Register;
