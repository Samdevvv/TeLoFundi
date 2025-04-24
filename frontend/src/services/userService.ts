// src/services/userService.ts
import api from "../api/apiClient";

export interface LoginPayload {
  email: string;
  password: string;
}
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export const login = (data: LoginPayload) =>
  api.post<LoginResponse>("/Users/login", data).then((res) => res.data);

export const register = (data: {
  email: string;
  password: string;
  tipoUsuario: string;
}) => api.post("/Users/register", data).then((res) => res.data);

export const refreshToken = (refreshToken: string) =>
  api
    .post<{ accessToken: string }>("/Users/refresh-token", { refreshToken })
    .then((res) => res.data.accessToken);

export const requestPasswordReset = (email: string) =>
  api.post("/Users/reset-password-request", { email });

export const resetPassword = (token: string, newPassword: string) =>
  api.post("/Users/reset-password", { token, newPassword });

// Endpoints protegidos (requieren Authorization)
// GET paginado de usuarios (solo admin)
export const getAllUsers = (page = 1, pageSize = 10) =>
  api
    .get<{
      data: any[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>("/Users", { params: { page, pageSize } })
    .then((res) => res.data);

// GET usuario por ID
export const getUserById = (id: number) =>
  api.get(`/Users/${id}`).then((res) => res.data);

// PUT actualizar usuario
export const updateUser = (
  id: number,
  payload: { email: string; telefono?: string; estaActivo?: boolean }
) => api.put(`/Users/${id}`, payload);

// DELETE usuario (solo admin)
export const deleteUser = (id: number) => api.delete(`/Users/${id}`);
