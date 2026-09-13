import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import * as z from 'zod';
import { GradientBackground } from '../components/gradient-background';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/theme-toggle';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '../components/ui/form';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { apiRequest } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { toastSuccess } from '../lib/toast';
import { ClubGroupType, Role, User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registrationSchema = loginSchema.extend({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  clubName: z.string().min(2, 'Club name is required'),
  groupCategory: z.enum(['A', 'B', 'C', 'other'], {
    required_error: "Please select a group category",
  }),
});

type LoginFormData = z.infer<typeof registrationSchema>;

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  // Forgot Password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (index: number, value: string) => {
    // Ensure only digits
    if (!/^\d*$/.test(value)) return;

    const newOtp = forgotOtp.split('');
    newOtp[index] = value.slice(-1);
    const combined = newOtp.join('');
    setForgotOtp(combined);

    // Auto-advance
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !forgotOtp[index] && index > 0) {
      // Auto-retreat
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      setForgotOtp(pasted);
      if (pasted.length === 6) {
        otpRefs.current[5]?.focus();
      } else {
        otpRefs.current[pasted.length]?.focus();
      }
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail) {
      setForgotError('Please enter your email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const response = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: forgotEmail },
      });
      setForgotSuccess(response.message || 'A 6-digit OTP has been sent to your email.');
      setForgotStep(2);
    } catch (err) {
      console.error(err);
      setForgotError(getErrorMessage(err, 'Failed to request OTP.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotOtp) {
      setForgotError('Please enter the OTP.');
      return;
    }

    setForgotLoading(true);
    try {
      const response = await apiRequest<{ message: string }>('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: forgotEmail, otp: forgotOtp },
      });
      setForgotSuccess(response.message || 'OTP verified.');
      setForgotStep(3);
    } catch (err) {
      console.error(err);
      setForgotError(getErrorMessage(err, 'Invalid OTP. Please try again.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotNewPassword || !forgotConfirmPassword) {
      setForgotError('Please fill in all fields.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    if (forgotNewPassword.length < 8) {
      setForgotError('Password must be at least 8 characters.');
      return;
    }

    setForgotLoading(true);
    try {
      const response = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: { email: forgotEmail, otp: forgotOtp, newPassword: forgotNewPassword },
      });
      
      // Since the backend just logged us in and set the cookie, fetch the profile
      const userProfile = await apiRequest<{
        id: string;
        email: string;
        name: string;
        role: Role;
        group?: ClubGroupType;
        clubId?: string;
        logoUrl: string | null;
        logoBg: string | null;
      }>('/api/auth/profile');

      toastSuccess(response.message || 'Password reset successfully. You are now logged in.');
      setForgotOpen(false);
      setForgotStep(1);
      setForgotEmail('');
      setForgotOtp('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      
      onLogin(userProfile as User);
    } catch (err) {
      console.error(err);
      setForgotError(getErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setForgotLoading(false);
    }
  };

  const form = useForm<LoginFormData>({
    resolver: zodResolver(isRegistering ? registrationSchema : loginSchema),
    defaultValues: {
      email: '',
      password: '',
      clubName: '',
      groupCategory: 'A',
    },
  });

  const handleSubmit = async (values: LoginFormData) => {
    setError('');

    try {
      if (isRegistering) {
        await apiRequest('/api/auth/register', {
          method: 'POST',
          body: {
            email: values.email,
            password: values.password,
            clubName: values.clubName,
            groupCategory: values.groupCategory,
          },
        });
        toastSuccess('Account created successfully! Signing you in...');
      }

      // 1. Call your custom backend login route instead of Supabase
      await apiRequest<{ message: string }>('/api/auth/login', {
        method: 'POST',
        body: {
          email: values.email,
          password: values.password,
        },
      });

      // 2. Fetch the profile data (cookie is sent automatically via credentials: include)

      // 3. Fetch the profile data using the new token
      const userProfile = await apiRequest<{
        id: string;
        email: string;
        name: string;
        role: Role;
        group?: ClubGroupType;
        clubId?: string;
        logoUrl: string | null;
        logoBg: string | null;
      }>('/api/auth/profile');

      toastSuccess(`Welcome back, ${userProfile.name}!`);
      
      onLogin(userProfile as User);

    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, 'Authentication failed.'));
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-bgMain dark:bg-transparent relative overflow-hidden">
      <GradientBackground />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <ThemeToggle />
      </div>

      {/* Back to Home Button */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="rounded-lg h-9 px-3 sm:px-4 font-semibold text-sm text-textPrimary hover:bg-hoverSoft/80 transition-all flex items-center gap-1.5 border border-borderSoft bg-card/90 backdrop-blur shadow-sm"
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="rounded-xl border-2 border-borderSoft shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.04)] bg-white/95 dark:bg-[#0A0F1F]/95 backdrop-blur-xl">
            {/* Header */}
            <div className="border-b border-borderSoft/50 dark:border-white/10 pb-8 pt-8 sm:pt-10 text-center px-6 sm:px-8">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex justify-center mb-5"
              >
                <Logo size="lg" showText={false} />
              </motion.div>
              <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary tracking-tight">SBG</h1>
              <p className="text-textSecondary mt-2 text-sm font-medium">
                Campus Life Made Easy
              </p>
            </div>

            {/* Form */}
            <div className="p-6 sm:p-8 space-y-6">
              <motion.h2
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg sm:text-xl font-bold text-textPrimary tracking-tight"
              >
                {isRegistering ? 'Club Registration' : 'Welcome Back'}
              </motion.h2>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">

                  {isRegistering && (
                    <>
                      <FormField
                        control={form.control}
                        name="clubName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="login-clubName" className="text-textSecondary font-semibold text-sm">Club Name</FormLabel>
                            <FormControl>
                              <Input id="login-clubName" placeholder="e.g. AI Club" className="h-11 rounded-xl" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="groupCategory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="login-groupCategory" className="text-textSecondary font-semibold text-sm">Group Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger id="login-groupCategory" className="h-11 rounded-xl border border-borderSoft bg-transparent px-3 py-2 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand w-full">
                                  <SelectValue placeholder="Select group category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-popover border-borderSoft">
                                <SelectItem value="A">Group A (Academic/Tech)</SelectItem>
                                <SelectItem value="B">Group B (Cultural)</SelectItem>
                                <SelectItem value="C">Group C (Sports)</SelectItem>
                                <SelectItem value="other">Others</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="login-email" className="text-textSecondary font-semibold text-sm">Email Address</FormLabel>
                        <div className="relative">
                          <Mail size={18} className="absolute left-3.5 top-3 text-textMuted z-10" />
                          <FormControl>
                            <Input
                              id="login-email"
                              type="email"
                              autoComplete="username email"
                              className="pl-11 h-11 rounded-md border-borderSoft bg-transparent focus:ring-2 focus:ring-brand/20 transition-all"
                              placeholder="club_name@dau.ac.in"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center">
                          <FormLabel htmlFor="login-password" className="text-textSecondary font-semibold text-sm">Password</FormLabel>
                          {!isRegistering && (
                            <button
                              type="button"
                              onClick={() => {
                                setForgotError('');
                                setForgotSuccess('');
                                setForgotEmail(form.getValues('email') || '');
                                setForgotOtp('');
                                setForgotNewPassword('');
                                setForgotConfirmPassword('');
                                setForgotStep(1);
                                setForgotOpen(true);
                              }}
                              className="text-xs font-semibold text-brand hover:text-brandLink hover:underline focus:outline-none cursor-pointer"
                            >
                              Forgot Password?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Lock size={18} className="absolute left-3.5 top-3 text-textMuted z-10" />
                          <FormControl>
                            <Input
                              id="login-password"
                              type="password"
                              autoComplete="current-password"
                              className="pl-11 h-11 rounded-md border-borderSoft bg-transparent focus:ring-2 focus:ring-brand/20 transition-all"
                              placeholder="Enter your password"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {error && (
                    <Alert variant="destructive" className="rounded-xl">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <motion.div whileTap={{ scale: 0.98 }} className="pt-2">
                    <Button
                      type="submit"
                      className="w-full rounded-md h-12 text-sm uppercase tracking-wide font-bold bg-gradient-button text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all"
                      disabled={form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting ? (
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          {isRegistering ? 'Create Account' : 'Sign In'}
                          <ArrowRight size={18} className="ml-1" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>
              </Form>

              {/* Registration toggle removed: admin-only now */}
            </div>
          </div>
      </motion.div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-lg bg-white/95 dark:bg-[#0A0F1F]/95 backdrop-blur-xl border border-borderSoft/50 dark:border-white/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-textPrimary">
              {forgotStep === 1 && 'Reset Password'}
              {forgotStep === 2 && 'Enter Verification Code'}
              {forgotStep === 3 && 'Create New Password'}
            </DialogTitle>
            <DialogDescription className="text-textMuted mt-1">
              {forgotStep === 1 && "Enter your official email address and we'll send you a 6-digit code."}
              {forgotStep === 2 && `We've sent a 6-digit code to ${forgotEmail}. Please enter it below.`}
              {forgotStep === 3 && "Please enter your new password."}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-textSecondary font-semibold text-sm">Email Address</Label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-3.5 text-textMuted z-10" />
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    placeholder="club_name@dau.ac.in"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="pl-11 h-12 rounded-xl"
                  />
                </div>
              </div>

              {forgotError && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription>{forgotError}</AlertDescription>
                </Alert>
              )}

              <DialogFooter className="pt-2 sm:space-x-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotOpen(false)}
                  className="rounded-xl h-11 text-sm font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="rounded-xl h-11 text-sm font-semibold bg-gradient-button text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all flex items-center justify-center min-w-[120px]"
                >
                  {forgotLoading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Send Code'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 py-2">
              <div className="space-y-4">
                <Label htmlFor="forgot-otp" className="text-textSecondary font-semibold text-sm text-center block">6-Digit Code</Label>
                <div className="flex justify-center gap-1.5 sm:gap-3">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <Input
                      key={index}
                      id={index === 0 ? "forgot-otp" : undefined}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      ref={(el) => { otpRefs.current[index] = el; }}
                      value={forgotOtp[index] || ''}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      aria-label={`Digit ${index + 1} of OTP`}
                      className="flex-1 min-w-0 max-w-[3rem] sm:max-w-[3.5rem] h-12 sm:h-14 md:h-16 text-center text-lg sm:text-xl md:text-2xl font-bold rounded-xl focus:scale-105 transition-all px-0"
                    />
                  ))}
                </div>
              </div>

              {forgotError && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription>{forgotError}</AlertDescription>
                </Alert>
              )}

              {forgotSuccess && (
                <Alert className="rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <AlertDescription>{forgotSuccess}</AlertDescription>
                </Alert>
              )}

              <DialogFooter className="pt-2 sm:space-x-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotStep(1)}
                  className="rounded-xl h-11 text-sm font-medium"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading || forgotOtp.length !== 6}
                  className="rounded-xl h-11 text-sm font-semibold bg-gradient-button text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all flex items-center justify-center min-w-[120px]"
                >
                  {forgotLoading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Verify Code'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4 py-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-new-password" className="text-textSecondary font-semibold text-sm">New Password</Label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-3.5 text-textMuted z-10" />
                    <Input
                      id="forgot-new-password"
                      type={showForgotNewPassword ? "text" : "password"}
                      required
                      placeholder="Enter new password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="pl-11 pr-10 h-12 rounded-xl"
                    />
                    <button
                      type="button"
                      aria-label="Toggle password visibility"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textPrimary cursor-pointer focus:outline-none"
                    >
                      {showForgotNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forgot-confirm-password" className="text-textSecondary font-semibold text-sm">Confirm Password</Label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-3.5 text-textMuted z-10" />
                    <Input
                      id="forgot-confirm-password"
                      type={showForgotConfirmPassword ? "text" : "password"}
                      required
                      placeholder="Confirm new password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="pl-11 pr-10 h-12 rounded-xl"
                    />
                    <button
                      type="button"
                      aria-label="Toggle password visibility"
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textPrimary cursor-pointer focus:outline-none"
                    >
                      {showForgotConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {forgotError && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription>{forgotError}</AlertDescription>
                </Alert>
              )}

              <DialogFooter className="pt-4 sm:space-x-2 flex justify-end gap-2">
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="rounded-xl h-11 text-sm font-semibold bg-gradient-button text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all flex items-center justify-center min-w-[120px] w-full"
                >
                  {forgotLoading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;