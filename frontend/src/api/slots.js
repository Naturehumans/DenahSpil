import api from './axios';

export const getAllSlots = async () => {
  const response = await api.get('/slots');
  return response.data;
};

export const getSlotsByFloor = async (floorId) => {
  const response = await api.get(`/floors/${floorId}/slots`);
  return response.data;
};

export const createSlot = async (floorId, data) => {
  const response = await api.post(`/floors/${floorId}/slots`, data);
  return response.data;
};

export const updateSlotPosition = async (slotId, positionX, positionY) => {
  let x = positionX;
  let y = positionY;
  if (typeof positionX === 'object' && positionX !== null) {
    x = positionX.position_x ?? positionX.x;
    y = positionX.position_y ?? positionX.y;
  }
  const response = await api.patch(`/slots/${slotId}/position?position_x=${x}&position_y=${y}`);
  return response.data;
};

export const deleteSlot = async (slotId) => {
  const response = await api.delete(`/slots/${slotId}`);
  return response.data;
};

export const assignItemToSlot = async (slotId, brand = '', modelNumber = '') => {
  const params = new URLSearchParams();
  if (brand) params.append('brand', brand);
  if (modelNumber) params.append('model_number', modelNumber);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await api.post(`/slots/${slotId}/assign${query}`);
  return response.data;
};

export const moveItemBetweenSlots = async (fromSlotId, toSlotId) => {
  const response = await api.post(`/slots/${fromSlotId}/move-to/${toSlotId}`);
  return response.data;
};

export const unassignItemFromSlot = async (slotId, destination) => {
  const url = destination ? `/slots/${slotId}/unassign?destination=${destination}` : `/slots/${slotId}/unassign`;
  const response = await api.delete(url);
  return response.data;
};
