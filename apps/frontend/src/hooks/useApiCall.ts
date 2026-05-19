import { useState, useCallback } from 'react';
import axios from 'axios';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook genérico para chamadas de API com estado padronizado.
 *
 * Resolve a inconsistência de tratamento de erros entre páginas
 * (prioridade MEDIA identificada no CLAUDE.md).
 *
 * @example
 * const { data, loading, error, execute } = useApiCall<User[]>();
 *
 * useEffect(() => {
 *   execute(() => userService.getAll());
 * }, []);
 */
export function useApiCall<T>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (apiCall: () => Promise<T>): Promise<T> => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await apiCall();
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message as string | undefined) ?? err.message
        : err instanceof Error
          ? err.message
          : 'Erro inesperado';
      setState({ data: null, loading: false, error: message });
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
