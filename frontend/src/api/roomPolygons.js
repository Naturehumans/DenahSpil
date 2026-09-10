import api from './axios';

export const getRoomPolygonsByFloor = async (floorId) => {
  const response = await api.get(`/floors/${floorId}/room-polygons`);
  return response.data;
};

export const createRoomPolygon = async (floorId, data) => {
  const response = await api.post(`/floors/${floorId}/room-polygons`, data);
  return response.data;
};

export const deleteRoomPolygon = async (polygonId) => {
  const response = await api.delete(`/room-polygons/${polygonId}`);
  return response.data;
};
