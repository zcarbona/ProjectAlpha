'use client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

const iconFix = () => {
  const iconDefault = L.Icon.Default as unknown as { _getIconUrl?: () => string };
  delete iconDefault._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

export default function MapDashboard({ pickup, dropoff }: { pickup?: { lat: number; lng: number; address: string }; dropoff?: { lat: number; lng: number; address: string } }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    iconFix();
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return <div className="h-96 w-full bg-gray-100 rounded-2xl animate-pulse" />;

  const center = pickup ? [pickup.lat, pickup.lng] : [30.0444, 31.2357];

  return (
    <div className="h-96 w-full rounded-2xl overflow-hidden shadow-inner">
      <MapContainer center={center as [number, number]} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]}>
            <Popup>{pickup.address || 'Pickup'}</Popup>
          </Marker>
        )}
        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]}>
            <Popup>{dropoff.address || 'Dropoff'}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
