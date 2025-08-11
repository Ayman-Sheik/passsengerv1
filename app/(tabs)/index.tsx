import { createClient } from "@supabase/supabase-js";
import React, { useEffect, useState, useRef } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

// Define location type
type LocationType = {
  latitude: number;
  longitude: number;
};

// Create Supabase client
const supabase = createClient(
  "https://ltdxlajzilbvmipcuqxd.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0ZHhsYWp6aWxidm1pcGN1cXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NTQxMDEsImV4cCI6MjA3MDMzMDEwMX0.si0smbCAHPa7w9qbhzErQpo8rWJ7_vyZWPYXyJrHzBE"
);

export default function App() {
  const [location, setLocation] = useState<LocationType | null>(null);
  const mapRef = useRef<MapView>(null);
  const hasFocused = useRef(false); // track if map focused initially

  useEffect(() => {
    // Fetch initial location once
    supabase
      .from("driver_locations")
      .select("latitude, longitude")
      .eq("driver_id", "driver_1")
      .single()
      .then(({ data, error }) => {
        if (!error && data && data.latitude && data.longitude) {
          const loc = {
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
          };
          setLocation(loc);

          if (mapRef.current && !hasFocused.current) {
            hasFocused.current = true;
            mapRef.current.animateToRegion(
              {
                ...loc,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              },
              1000 // 1 second animation
            );
          }
        } else if (error) {
          console.error("Initial fetch error:", error);
        }
      });

    // Subscribe to realtime driver location updates
    const channel = supabase
      .channel("driver_location_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: "driver_id=eq.driver_1",
        },
        (payload) => {
          const newData = payload.new as Partial<LocationType>;
          if (newData.latitude && newData.longitude) {
            setLocation({
              latitude: Number(newData.latitude),
              longitude: Number(newData.longitude),
            });
            // Do NOT animate map here to keep user control
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <View style={styles.container}>
      {location ? (
        <>
          <MapView
            ref={mapRef}
            style={styles.map}
            // No region or initialRegion prop here
          >
            <Marker
              coordinate={location}
              title="Driver 1"
              description="Live location"
            />
          </MapView>
          <View style={styles.infoBox}>
            <Text>Lat: {location.latitude.toFixed(6)}</Text>
            <Text>Lng: {location.longitude.toFixed(6)}</Text>
          </View>
        </>
      ) : (
        <Text>Loading location...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  infoBox: {
    position: "absolute",
    bottom: 20,
    left: 10,
    right: 10,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 8,
    elevation: 4,
  },
});
