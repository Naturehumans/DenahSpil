import api from './axios';

export const getAllEquipments = async () => {
  const response = await api.get('/equipments/all');
  return response.data;
};

export const getEquipmentsByFloor = async (floorId) => {
  const response = await api.get(`/floors/${floorId}/equipments`);
  return response.data;
};

export const getExpiringEquipments = async (days = 30) => {
  const response = await api.get(`/equipments/expiring?days=${days}`);
  return response.data;
};

export const getEquipmentStats = async () => {
  const response = await api.get('/equipments/stats');
  return response.data;
};

export const createEquipment = async (floorId, data) => {
  const response = await api.post(`/floors/${floorId}/equipments`, data);
  return response.data;
};

export const updateEquipment = async (equipmentId, data) => {
  const response = await api.put(`/equipments/${equipmentId}`, data);
  return response.data;
};

export const updateEquipmentPosition = async (equipmentId, position_x, position_y) => {
  const response = await api.patch(`/equipments/${equipmentId}/position`, { position_x, position_y });
  return response.data;
};

export const deleteEquipment = async (equipmentId, destination) => {
  const url = destination ? `/equipments/${equipmentId}?destination=${destination}` : `/equipments/${equipmentId}`;
  const response = await api.delete(url);
  return response.data;
};
