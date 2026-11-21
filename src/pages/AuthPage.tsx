import React, { useState } from 'react';
import { ArrowLeft, Mail, Lock, User as UserIcon, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, registerWithEmail } from '../firebase';
import { useStudio } from '../context/StudioContext';
import { VlogSparkLogo } from '../components/Logo';

export function AuthPage() {
  const { navigate, notify } = useStudio();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      notify('Signed in with Google. Welcome to VlogSpark AI 2.0.', 'success');
      navigate('dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      if (msg.includes('popup-closed-by-user')) {
        setError('Sign-in popup was closed before completing.');
      } else {
        setError('Could not sign in with Google. Please allow popups and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError('Please enter your email address and password.');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
        notify('Signed in to VlogSpark AI 2.0.', 'success');
        navigate('dashboard');
      } else {
        await registerWithEmail(name, email.trim(), password);
        setInfo(
          'Account created! Check your inbox for the verification email so cloud project saves are unlocked, or use Google Sign-In for instant verified access.',
        );
        notify('Account created successfully.', 'success');
        navigate('dashboard');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('operation-not-allowed')) {
        setError(
          'Email/Password sign-in is not yet enabled in your Firebase Console (Authentication → Sign-in method → Email/Password). Use Google Sign-In above right away.',
        );
      } else if (msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        setError('Invalid email or password. Please check your credentials.');
      } else if (msg.includes('email-already-in-use')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError('Authentication failed. Verify your details or sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen studio-canvas-bg text-slate-100 flex flex-col">
      <header className="max-w-7xl w-full mx-auto px-6 h-16 flex items-center justify-between">
        <button onClick={() => navigate('landing')} className="focus-visible:outline-none">
          <VlogSparkLogo />
        </button>
        <button
          onClick={() => navigate('landing')}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md studio-panel rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold text-white mb-1.5">
            {mode === 'login' ? 'Sign in to VlogSpark AI' : 'Create your creator account'}
          </h1>
          <p className="text-sm text-slate-400 mb-6">
            Save scripts, scene storyboards, recordings, and video exports privately in your workspace.
          </p>

          {/* Primary Google Sign-In */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.65z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3c-1.07.72-2.44 1.15-4.05 1.15-3.12 0-5.76-2.1-6.7-4.93H1.3v3.1A12 12 0 0 0 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.31A7.2 7.2 0 0 1 4.92 12c0-.8.14-1.58.38-2.31V6.59H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.41l4-3.1z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.3 6.59l4 3.1c.94-2.83 3.58-4.93 6.7-4.93z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
            <div className="flex-1 h-px bg-slate-800" />
            <span>or use email</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0A1026] border border-slate-800 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Creator Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your display name"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A1026] border border-slate-700/80 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="creator@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A1026] border border-slate-700/80 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A1026] border border-slate-700/80 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
            >
              {loading
                ? 'Authenticating...'
                : mode === 'login'
                  ? 'Sign In with Email'
                  : 'Create Creator Account'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
