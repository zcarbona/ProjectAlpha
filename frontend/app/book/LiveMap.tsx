'use client';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';

type Props = {
  selectedVehicle: string;
};

const cairoCenter: [number, number] = [30.0444, 31.2357];

const truckIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2554/2554978.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const activeTruckIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2554/2554978.png',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-black.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapController() {
  const map = useMap();

  useEffect(() => {
    map.setView(cairoCenter, 10);
  }, [map]);

  return null;
}

function UseMyLocationButton() {
  const map = useMap();

  const requestLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          map.setView([lat, lng], 13);
        },
        () => {
          map.setView(cairoCenter, 10);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    }
  };

  return (
    <button className="naqlUseLocation" onClick={requestLocation} title="Use My Location">
      📍
    </button>
  );
}

type BackendTruck = {
  id: number;
  vehicle_class: string;
  capacity: string;
  plate_number: string | null;
  current_lat: number | null;
  current_lng: number | null;
  latitude: number | null;
  longitude: number | null;
};

type TruckMarker = {
  id: number;
  name: string;
  position: [number, number];
};

function pickLocation(truck: BackendTruck): [number, number] | null {
  if (truck.current_lat != null && truck.current_lng != null) {
    return [truck.current_lat, truck.current_lng];
  }
  if (truck.latitude != null && truck.longitude != null) {
    return [truck.latitude, truck.longitude];
  }
  return null;
}

const vehicleClassFor = (id: string): string => (id === 'xlarge' ? 'xl' : id);

export default function LiveMap({ selectedVehicle }: Props) {
  const [trucks, setTrucks] = useState<TruckMarker[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTrucks() {
      try {
        const cls = vehicleClassFor(selectedVehicle);
        const url = cls
          ? `/api/v1/trucks?vehicle_class=${encodeURIComponent(cls)}`
          : '/api/v1/trucks';
        const res = await fetch(url);
        const data: BackendTruck[] = await res.json();

        const mapped: TruckMarker[] = (data || [])
          .map((truck) => {
            const pos = pickLocation(truck);
            if (!pos) return null;
            return {
              id: truck.id,
              name: truck.plate_number
                ? `Truck ${truck.plate_number}`
                : `Truck #${truck.id}`,
              position: pos,
            } as TruckMarker;
          })
          .filter((t): t is TruckMarker => t !== null);

        if (!cancelled) setTrucks(mapped);
      } catch {
        if (!cancelled) setTrucks([]);
      }
    }

    loadTrucks();
    const interval = setInterval(loadTrucks, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedVehicle]);

  const handleMyLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserPos([lat, lng]);
        },
        () => {
          setUserPos(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    }
  };

  return (
    <MapContainer
      center={cairoCenter}
      zoom={10}
      zoomControl={true}
      scrollWheelZoom={true}
      className="naqlMap"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController />

      <button
        className="naqlUseLocation"
        onClick={handleMyLocation}
        title="Use My Location"
      >
        📍
      </button>

      {userPos && (
        <Marker position={userPos} icon={userIcon}>
          <Popup><strong>You are here</strong></Popup>
        </Marker>
      )}

      {trucks.map((truck) => (
        <Marker
          key={truck.id}
          position={truck.position}
          icon={activeTruckIcon}
        >
          <Popup>
            <strong>{truck.name}</strong>
            <br />
            Vehicle: {selectedVehicle}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}