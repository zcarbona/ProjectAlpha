'use client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, useCallback } from 'react';

const iconFix = () => {
  const iconDefault = L.Icon.Default as unknown as { _getIconUrl?: () => string };
  delete iconDefault._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

const truckIcons: Record<string, L.Icon> = {};
function colorForClass(vehicleClass: string): string {
  switch (vehicleClass) {
    case 'small': return 'blue';
    case 'medium': return 'green';
    case 'large': return 'orange';
    case 'xl': return 'red';
    default: return 'blue';
  }
}
function getTruckIcon(vehicleClass: string): L.Icon {
  const c = colorForClass(vehicleClass);
  if (!truckIcons[c]) {
    truckIcons[c] = new L.Icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${c}.png`,
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [38, 62],
      iconAnchor: [19, 62],
      popupAnchor: [1, -44],
      shadowSize: [62, 62],
    });
  }
  return truckIcons[c];
}

const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-black.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [32, 52],
  iconAnchor: [16, 52],
  popupAnchor: [1, -38],
  shadowSize: [52, 52],
});

export interface TruckLocation {
  id: number;
  plate_number: string | null;
  vehicle_class: string;
  capacity: string;
  lat: number;
  lng: number;
}

function pickLocation(truck: any): { lat: number; lng: number } | null {
  if (truck.current_lat != null && truck.current_lng != null) {
    return { lat: truck.current_lat, lng: truck.current_lng };
  }
  if (truck.latitude != null && truck.longitude != null) {
    return { lat: truck.latitude, lng: truck.longitude };
  }
  return null;
}

interface TruckMapProps {
  trucks: TruckLocation[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onTruckClick?: (truck: TruckLocation) => void;
  userPos?: { lat: number; lng: number } | null;
  locLoading?: boolean;
  locError?: boolean;
  onRetryLocation?: () => void;
}

export function TruckMap({ trucks, center, zoom = 6, onTruckClick, userPos, locLoading, locError, onRetryLocation }: TruckMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    iconFix();
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-96 w-full bg-gray-100 rounded-2xl animate-pulse" />;
  }

  const egyptCenter = center ?? { lat: 26.8206, lng: 30.8025 };

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden shadow-inner relative">
      <MapContainer
        center={[egyptCenter.lat, egyptCenter.lng] as [number, number]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        minZoom={4}
        maxZoom={18}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userPos && (
          <Marker
            position={[userPos.lat, userPos.lng] as [number, number]}
            icon={userIcon}
          >
            <Popup><strong>You are here</strong></Popup>
          </Marker>
        )}
        {trucks.map((truck) => (
          <Marker
            key={truck.id}
            position={[truck.lat, truck.lng] as [number, number]}
            icon={getTruckIcon(truck.vehicle_class)}
            eventHandlers={{
              click: () => onTruckClick?.(truck),
            }}
          >
            <Popup>
              <div>
                <strong>{truck.vehicle_class.toUpperCase()} Truck</strong>
                <br />
                Plate: {truck.plate_number || 'N/A'}
                <br />
                Capacity: {truck.capacity}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {locLoading && (
        <div className="absolute top-3 left-3 z-[1000] bg-white text-xs font-bold px-3 py-2 rounded-lg shadow-lg">
          Getting location...
        </div>
      )}
      {locError && onRetryLocation && (
        <button
          onClick={onRetryLocation}
          className="location-btn"
        >
          Use My Location
        </button>
      )}
    </div>
  );
}

export default function TruckMapWithUser({
  vehicleClass,
  onTruckClick,
}: {
  vehicleClass?: string;
  onTruckClick?: (truck: TruckLocation) => void;
}) {
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [trucks, setTrucks] = useState<TruckLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [locError, setLocError] = useState(false);
  const [locLoading, setLocLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadTrucks = useCallback(async () => {
    try {
      const url = vehicleClass
        ? `/api/v1/trucks?vehicle_class=${encodeURIComponent(vehicleClass)}`
        : '/api/v1/trucks';
      const res = await fetch(url);
      const data = await res.json();
      const mapped: TruckLocation[] = (data || [])
        .map((t: any) => {
          const loc = pickLocation(t);
          if (!loc) return null;
          return {
            id: t.id,
            plate_number: t.plate_number ?? null,
            vehicle_class: t.vehicle_class,
            capacity: t.capacity,
            lat: loc.lat,
            lng: loc.lng,
          };
        })
        .filter((t: TruckLocation | null): t is TruckLocation => t !== null);
      setTrucks(mapped);
    } catch {
      setTrucks([]);
    } finally {
      setLoading(false);
    }
  }, [vehicleClass]);

  const requestLocation = useCallback(() => {
    setLocError(false);
    setLocLoading(true);
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocError(false);
          setLocLoading(false);
        },
        () => {
          setUserPos(null);
          setLocError(true);
          setLocLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    } else {
      setUserPos(null);
      setLocError(true);
      setLocLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    loadTrucks();
    requestLocation();
  }, [loadTrucks, requestLocation, mounted]);

  if (!mounted || loading) {
    return <div className="h-96 w-full bg-gray-100 rounded-2xl animate-pulse" />;
  }

  return (
    <TruckMap
      trucks={trucks}
      center={userPos ?? { lat: 26.8206, lng: 30.8025 }}
      zoom={userPos ? 13 : 6}
      onTruckClick={onTruckClick}
      userPos={userPos}
      locLoading={locLoading}
      locError={locError}
      onRetryLocation={requestLocation}
    />
  );
}