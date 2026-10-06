const PUBLIC_AUTH_PATHS = new Set([
  '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout',
  '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-email', '/api/auth/google',
]);

/** Share cookie rotation, independently of any individual query's lifetime. */
export const createSessionQuery = (rawBaseQuery, { credentials, logout, onMissingCookie }) => {
  let refreshPromise;
  const refreshAccessToken = (api, extraOptions) => {
    if (!refreshPromise) {
      const userId = api.getState().auth.user?._id;
      const requestToken = api.getState().auth.token;
      const signal = new AbortController().signal;
      refreshPromise = rawBaseQuery({ url: '/api/auth/refresh', method: 'POST' }, { ...api, signal }, extraOptions)
        .then(refresh => {
          const auth = api.getState().auth;
          // A logout or a different login while the request ran takes precedence.
          if (!auth.isAuthenticated || auth.user?._id !== userId) {
            return { error: { status: 'CUSTOM_ERROR', error: 'Session changed' } };
          }
          if (auth.token !== requestToken) {
            return auth.token ? { data: { ...auth.user, token: auth.token } }
              : { error: { status: 'CUSTOM_ERROR', error: 'Session changed' } };
          }
          if (refresh.data?.token) {
            api.dispatch(credentials({ user: refresh.data, token: refresh.data.token }));
          } else if (refresh.error?.status === 401) {
            if (refresh.error.data?.code === 'NO_REFRESH_COOKIE') onMissingCookie?.();
            api.dispatch(logout());
          }
          return refresh;
        })
        .finally(() => { refreshPromise = undefined; });
    }
    return refreshPromise;
  };

  const baseQuery = async (args, api, extraOptions) => {
    const url = typeof args === 'string' ? args : args.url;
    const isPublic = PUBLIC_AUTH_PATHS.has(url.split('?')[0]);
    const auth = api.getState().auth;
    if (!isPublic && !auth.token && auth.isAuthenticated) {
      const refresh = await refreshAccessToken(api, extraOptions);
      // Preserve a network/503 error; don't turn it into a misleading 401.
      if (!refresh.data?.token) return { error: refresh.error || { status: 'CUSTOM_ERROR', error: 'Session unavailable' } };
    }
    const requestToken = api.getState().auth.token;
    let result = await rawBaseQuery(args, api, extraOptions);
    if (!isPublic && result.error?.status === 401) {
      const current = api.getState().auth;
      if (!current.isAuthenticated) return result;
      if (current.token && current.token !== requestToken) {
        return rawBaseQuery(args, api, extraOptions);
      }
      const refresh = await refreshAccessToken(api, extraOptions);
      result = refresh.data?.token
        ? await rawBaseQuery(args, api, extraOptions)
        : { error: refresh.error || { status: 'CUSTOM_ERROR', error: 'Session unavailable' } };
    }
    return result;
  };
  return { baseQuery, refreshAccessToken };
};
