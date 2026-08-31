import api from './axios';

export const getCategories = async () => {
  const response = await api.get('/equipment-categories');
  return response.data;
};

export const createCategory = async (data) => {
  const response = await api.post('/equipment-categories', data);
  return response.data;
};
export const updateCategory = async (categoryId, data) => {
  const response = await api.put(`/equipment-categories/${categoryId}`, data);
  return response.data;
};
export const deleteCategory = async (categoryId) => {
  const response = await api.delete(`/equipment-categories/${categoryId}`);
  return response.data;
};
