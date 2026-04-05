import axios from 'axios';
import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

const configuredBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
const expoHostUri =
  (Constants.expoConfig as any)?.hostUri ||
  (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
  (Constants as any)?.manifest?.debuggerHost ||
  '';
const expoHost = String(expoHostUri || '').split(':')[0];

const scriptUrl: string = (NativeModules as any)?.SourceCode?.scriptURL || '';
const scriptUrlHost = scriptUrl ? String(scriptUrl).replace(/^https?:\/\//, '').split('/')[0].split(':')[0] : '';

const API_BASE_URL = configuredBaseUrl
  ? configuredBaseUrl
  : expoHost
    ? `http://${expoHost}:5000/api`
    : 'http://10.0.2.2:5000/api';

let runtimeBaseUrl = API_BASE_URL;

export const api = axios.create({
  baseURL: runtimeBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getApiBaseUrl = () => runtimeBaseUrl;

export const setApiBaseUrl = (url: string) => {
  runtimeBaseUrl = url;
  api.defaults.baseURL = url;
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const getAuthBaseCandidates = () => {
  const expoLanBase = expoHost ? `http://${expoHost}:5000/api` : '';
  const scriptHostBase = scriptUrlHost ? `http://${scriptUrlHost}:5000/api` : '';
  return unique([
    configuredBaseUrl,
    runtimeBaseUrl,
    expoLanBase,
    scriptHostBase,
    'http://10.0.2.2:5000/api',
    'http://10.0.3.2:5000/api',
    'http://localhost:5000/api',
    'http://127.0.0.1:5000/api',
  ]);
};

export const loginWithBaseFallback = async (email: string, password: string) => {
  const candidates = getAuthBaseCandidates();
  let lastError: any = null;

  for (const base of candidates) {
    try {
      const response = await axios.post(
        `${base}/auth/login`,
        { email, password },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      setApiBaseUrl(base);
      return response.data;
    } catch (err: any) {
      const status = Number(err?.response?.status || 0);
      // If auth endpoint is reachable and credentials are rejected, don't mask it as network failure.
      if (status === 401 || status === 400) {
        setApiBaseUrl(base);
        throw err;
      }
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error('Unable to connect to any API host candidate.');
};

export const withAuthHeader = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
