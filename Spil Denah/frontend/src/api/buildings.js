import api from './axios';

export const getBuildings = async () => {
  const response = await api.get('/buildings');
  return response.data;
};

export const createBuilding = async (data) => {
  const response = await api.post('/buildings', data);
  return response.data;
};
export const updateBuilding = async (id, data) => {
  const response = await api.put(`/buildings/${id}`, data);
  return response.data;
};

export const deleteBuilding = async (id) => {
  const response = await api.delete(`/buildings/${id}`);
  return response.data;
};
