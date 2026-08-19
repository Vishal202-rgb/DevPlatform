import api from './api';

export const registerRequest = async ({ name, email, password }) => {
  const { data } = await api.post('/auth/register', { name, email, password });
  return data.data; // { user, token }
};

export const loginRequest = async ({ email, password }) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data.data; // { user, token }
};

export const logoutRequest = async () => {
  const { data } = await api.post('/auth/logout');
  return data;
};

export const fetchCurrentUser = async () => {
  const { data } = await api.get('/auth/me');
  return data.data.user;
};
