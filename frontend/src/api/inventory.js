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

<<<<<<< HEAD
export const addStockToInventory = async (data) => {
  const response = await api.post('/inventory/stock', data);
=======
/**
 * Delete ALL assets matching a category + brand + model (bulk delete entire brand card)
 */
export const deleteAssetsByBrand = async (data) => {
  const response = await api.post('/assets/delete-brand', data);
  return response.data;
};

/**
 * Delete ONE unit from a brand (reduces stock by 1). For AC, deletes the IN/OUT pair.
 */
export const deleteOneAssetByBrand = async (data) => {
  const response = await api.post('/assets/reduce-stock', data);
  return response.data;
};

export const addStockToInventory = async (data) => {
  const response = await api.post('/assets/add-stock', data);
>>>>>>> updatev2
  return response.data;
};

export const restoreAsset = async (data) => {
  const response = await api.post('/assets/restore', data);
  return response.data;
};
