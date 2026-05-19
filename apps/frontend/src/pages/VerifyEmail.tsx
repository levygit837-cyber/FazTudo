import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import api from '../services/api';

export default function VerifyEmail() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de verificação não encontrado.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await api.post('/auth/verify-email', { token });
        if (response.data.success) {
          setStatus('success');
          setMessage(response.data.message || 'Email verificado com sucesso!');
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Falha na verificação.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.message ||
          'Token inválido ou expirado. Solicite um novo email de verificação.'
        );
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="mx-auto w-16 h-16 mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Verificando seu email...
            </h2>
            <p className="text-gray-500 dark:text-gray-400">Aguarde um momento.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto w-16 h-16 mb-4 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Email verificado!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
            <Link
              to="/login"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Fazer login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Falha na verificação
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
            <div className="space-y-3">
              <Link
                to="/login"
                className="block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ir para login
              </Link>
              <p className="text-sm text-gray-400">
                Faça login para solicitar um novo email de verificação.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
