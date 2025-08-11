import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { supabase } from "../constants/supabaseClient";

export default function LiveLocationClient() {
  const [driverLocation, setDriverLocation] = useState(null);

  // Change this to match the driver_id you use in the driver app
  const DRIVER_ID = "driver123";

  useEffect(() => {
    // Fetch the most recent location
    const fetchInitialLocation = async () => {
      let { data, error } = await supabase
        .from("driver_locations")
        .select("latitude, longitude")
        .eq("driver_id", DRIVER_ID)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setDriverLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
      }
    };

    fetchInitialLocation();

    // Listen for real-time updates
    const channel = supabase
      .channel("driver-location-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "driver_locations",
          filter: `driver_id=eq.${DRIVER_ID}`,
        },
        (payload) => {
          if (payload.new) {
            setDriverLocation({
              latitude: payload.new.latitude,
              longitude: payload.new.longitude,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <View style={styles.container}>
      {driverLocation ? (
        <MapView
          style={styles.map}
          region={{
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker coordinate={driverLocation} title="Driver" />
        </MapView>
      ) : (
        <Text style={{ textAlign: "center", marginTop: 20 }}>
          Waiting for driver location...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
