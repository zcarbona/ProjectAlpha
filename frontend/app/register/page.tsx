'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'provider'>('customer');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, sendOtp, verifyOtp, resendOtp, login } = useAuth();
  const { t } = useLang();
  const router = useRouter();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await register(username, email, password, role, phoneNumber || undefined);
      await sendOtp(email);
      setStep('otp');
      setResendCooldown(60);
      setSuccessMsg(t('Verification code sent to your email.', 'تم إرسال رمز التحقق إلى بريدك الإلكتروني.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await verifyOtp(email, otpCode.trim());
      // Automatically login after successful verification
      await login(email, password);
      if (role === 'provider') {
        router.push('/provider');
      } else {
        router.push('/book');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await resendOtp(email);
      setResendCooldown(60);
      setSuccessMsg(t('A new code has been sent.', 'تم إرسال رمز جديد.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8" style={{ border: '1px solid #e5e7eb' }}>
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-3xl"
            style={{ background: '#e53935' }}
          >
            N
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2 text-center text-gray-900">
          {step === 'form' ? t('Join Naql', 'انضم إلى نقل') : t('Verify Email', 'تأكيد البريد الإلكتروني')}
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          {step === 'form'
            ? t('Create your account to start shipping or hauling', 'أنشئ حسابك للبدء في الشحن أو نقل البضائع')
            : t(`Enter the 6-digit code sent to ${email}`, `أدخل الرمز المكون من 6 أرقام المرسل إلى ${email}`)}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: '#b91c1c' }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', color: '#2e7d32' }}>
            {successMsg}
          </div>
        )}

        {step === 'form' ? (
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">{t('Username', 'اسم المستخدم')}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none"
                style={{ borderColor: '#e5e7eb' }}
                placeholder="e.g. johndoe"
                required
                minLength={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">{t('Email Address', 'البريد الإلكتروني')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none"
                style={{ borderColor: '#e5e7eb' }}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">{t('Phone Number (Optional)', 'رقم الهاتف (اختياري)')}</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full p-3 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none"
                style={{ borderColor: '#e5e7eb' }}
                placeholder="+201012345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">{t('Password', 'كلمة المرور')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none"
                style={{ borderColor: '#e5e7eb' }}
                placeholder="••••••••••••"
                required
                minLength={12}
              />
              <p className="text-xs text-gray-500 mt-1">{t('Min 12 characters', '١٢ حرفاً على الأقل')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">{t('I am a', 'أنا')}</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setRole('customer')}
                  className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                    role === 'customer'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl">📦</div>
                  <div className="font-semibold text-sm">{t('Customer', 'عميل')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('provider')}
                  className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                    role === 'provider'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl">🚛</div>
                  <div className="font-semibold text-sm">{t('Provider', 'سائق / مزود')}</div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full p-4 text-white rounded-xl font-bold disabled:opacity-50 transition-colors"
              style={{ background: '#e53935' }}
            >
              {loading ? t('Creating account...', 'جارٍ إنشاء الحساب...') : t('Continue to Verification', 'المتابعة للتحقق')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">{t('6-Digit Verification Code', 'رمز التحقق المكون من 6 أرقام')}</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full p-4 border rounded-lg bg-white text-gray-900 text-center tracking-widest text-2xl font-bold placeholder-gray-400 focus:outline-none"
                style={{ borderColor: '#e5e7eb' }}
                placeholder="123456"
                required
                maxLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full p-4 text-white rounded-xl font-bold disabled:opacity-50 transition-colors"
              style={{ background: '#e53935' }}
            >
              {loading ? t('Verifying...', 'جارٍ التحقق...') : t('Verify & Sign In', 'تحقق وتسجيل الدخول')}
            </button>

            <div className="flex items-center justify-between text-sm pt-2">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="text-gray-500 hover:text-gray-700"
              >
                &larr; {t('Edit Information', 'تعديل البيانات')}
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="font-semibold disabled:opacity-50"
                style={{ color: '#e53935' }}
              >
                {resendCooldown > 0
                  ? `${t('Resend in', 'إعادة الإرسال خلال')} ${resendCooldown}s`
                  : t('Resend Code', 'إعادة إرسال الرمز')}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          {t('Already have an account?', 'لديك حساب بالفعل؟')}{' '}
          <Link href="/login" className="font-semibold hover:opacity-80" style={{ color: '#e53935' }}>
            {t('Sign In', 'تسجيل الدخول')}
          </Link>
        </p>
      </div>
    </div>
  );
}
