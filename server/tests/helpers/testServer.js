process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-integration-tests-0123456789';
process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
process.env.CLIENT_URL = 'http://localhost:5173';
delete process.env.GEMINI_API_KEY; // AI o'chirilgan holatni sinaymiz — bu eng muhim ssenariy

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../../app');

let mongod;
let server;
let baseUrl;

const start = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = createApp({ isProd: false, enableRateLimit: false });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
};

const stop = async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};

/** Kichik fetch o'rovi — cookie'ni saqlaydi va tokenni qo'shadi */
const makeClient = () => {
  let token = null;
  let cookie = null;

  const request = async (method, path, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (cookie) headers.cookie = cookie;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: res.status, data };
  };

  return {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b),
    put: (p, b) => request('PUT', p, b),
    del: (p) => request('DELETE', p),
    setToken: (t) => {
      token = t;
    },
    getToken: () => token,
    register: async (email = `u${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.uz`) => {
      const res = await request('POST', '/api/auth/register', {
        name: 'Test User',
        email,
        password: 'password12345',
      });
      if (res.data?.token) token = res.data.token;
      return res;
    },
  };
};

module.exports = { start, stop, makeClient, getBaseUrl: () => baseUrl };
