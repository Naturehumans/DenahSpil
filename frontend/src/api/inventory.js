import api from './axios';

export const getAssets = async (status = null) => {
  const url = status ? `/assets?status=${status}` : '/assets';
  const response = await api.get(url);
  return response.data;
};

export const getInventoryLogs = async () => {
  const response = await api.get('/inventory-logs');
  return response.data;
};

export const deleteAsset = async (assetId) => {
  const response = await api.delete(`/assets/${assetId}`);
  return response.data;
};
