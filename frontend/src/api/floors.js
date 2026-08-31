import api from './axios';

export const getFloors = async (buildingId) => {
  const response = await api.get(`/buildings/${buildingId}/floors`);
  return response.data;
};

export const createFloor = async (buildingId, formData) => {
  const response = await api.post(`/buildings/${buildingId}/floors`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const updateFloor = async (floorId, data) => {
  const response = await api.put(`/floors/${floorId}`, data);
  return response.data;
};

export const deleteFloor = async (floorId) => {
  const response = await api.delete(`/floors/${floorId}`);
  return response.data;
};
