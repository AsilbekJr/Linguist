import React, { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useGoogleLoginMutation } from '../../features/api/apiSlice';
import { setCredentials } from '../../features/auth/authSlice';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/** Google Identity Services skripti bir marta yuklanadi */
let scriptPromise = null;
const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Google skripti yuklanmadi'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

/**
 * `initialize` bir marta chaqiriladi (qayta chaqirish Google ogohlantirishini
 * beradi), javob esa hozir ko'rinib turgan tugmaning ishlovchisiga boradi.
 */
let initialized = false;
let currentHandler = null;

/**
 * "Google bilan davom etish" tugmasi.
 *
 * Tugmani Google o'zi chizadi (renderButton) — o'zimizning tugma bilan
 * One Tap/popup oqimi ishonchsiz va Google qoidalariga zid. Kalit
 * sozlanmagan bo'lsa (lokal ishlab chiqish) hech narsa ko'rsatilmaydi.
 */
const GoogleButton = ({ onSuccess, onError, text = 'continue_with' }) => {
  const containerRef = useRef(null);
  const dispatch = useDispatch();
  const [googleLogin] = useGoogleLoginMutation();
  const [failed, setFailed] = useState(false);
  // Ota komponent har chizilganda yangi funksiya beradi — ular effekt
  // bog'liqligida bo'lsa Google tugmasi har safar qayta chizilardi
  const handlersRef = useRef({ onSuccess, onError });
  useEffect(() => {
    handlersRef.current = { onSuccess, onError };
  }, [onSuccess, onError]);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;

    currentHandler = async ({ credential }) => {
      try {
        const data = await googleLogin(credential).unwrap();
        dispatch(setCredentials({ user: data, token: data.token }));
        handlersRef.current.onSuccess?.(data);
      } catch (err) {
        handlersRef.current.onError?.(err?.data?.message || "Google orqali kirib bo'lmadi. Qayta urinib ko'ring.");
      }
    };

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        if (!initialized) {
          window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (response) => currentHandler?.(response),
            ux_mode: 'popup',
            // Brauzerning yangi FedCM oynasi — uchinchi tomon cookie'lariga bog'liq emas
            use_fedcm_for_prompt: true,
          });
          initialized = true;
        }
        // Google kenglikni piksel bilan oladi (200–400)
        const width = Math.max(200, Math.min(400, Math.floor(containerRef.current.offsetWidth)));
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          width,
          locale: 'uz',
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, googleLogin, text]);

  if (!CLIENT_ID || failed) return null;

  return (
    <div className="space-y-4">
      {/* Google tugmasi o'z balandligini oladi; joy oldindan ajratiladi — sakrash bo'lmasin */}
      <div ref={containerRef} className="flex min-h-[44px] w-full justify-center" />
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        yoki
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
};

export default GoogleButton;
