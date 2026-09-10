/**
 * Ray-casting algorithm to determine if a point is inside a polygon.
 * @param {Object} point - {x, y}
 * @param {Array} polygon - [{x, y}, {x, y}, ...]
 * @returns {boolean}
 */
export const isPointInPolygon = (point, polygon) => {
  let isInside = false;
  const { x, y } = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }

  return isInside;
};

/**
 * Calculates the centroid of a polygon.
 * @param {Array} polygon - [{x, y}, {x, y}, ...]
 * @returns {Object} - {x, y}
 */
export const getPolygonCentroid = (polygon) => {
  if (!polygon || polygon.length === 0) return { x: 0, y: 0 };
  
  let x = 0;
  let y = 0;
  
  // Calculate average of points (simple centroid for non-self-intersecting polygons)
  for (const point of polygon) {
    x += point.x;
    y += point.y;
  }
  
  return {
    x: x / polygon.length,
    y: y / polygon.length
  };
};

/**
 * Given a point and a list of room polygons, returns the name of the room
 * the point is inside, or empty string if it's not in any room.
 * @param {Object} point - {x, y}
 * @param {Array} roomPolygons - [{name, coordinates}, ...]
 * @returns {string}
 */
export const getRoomNameFromCoordinates = (point, roomPolygons) => {
  if (!roomPolygons || !Array.isArray(roomPolygons)) return "";
  
  for (const room of roomPolygons) {
    if (room.coordinates && isPointInPolygon(point, room.coordinates)) {
      return room.name;
    }
  }
  
  return "";
};
