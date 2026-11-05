/** A campus location a class can be held at (stored under globals/locationConfig/locations). */
export interface LocationTag {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isPrimary: boolean;
  createdAt: number;
}
